import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();

    // 일정 정보
    const { data: schedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (!schedule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 발제자 정보
    let presenter = null;
    if (schedule.presenter_id) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('id', schedule.presenter_id)
        .single();
      presenter = p;
    }

    // 책 정보
    let selected_book = null;
    if (schedule.selected_book_id) {
      const { data: b } = await supabase
        .from('books')
        .select('id, title, author, cover_url, selection_reason')
        .eq('id', schedule.selected_book_id)
        .single();
      selected_book = b;
    }

    // 제출물 (adminClient로 전체 조회 - RLS 우회)
    const { data: submissions } = await adminClient
      .from('meeting_submissions')
      .select('*')
      .eq('schedule_id', id);

    // 제출자 프로필 별도 조회
    if (submissions && submissions.length > 0) {
      const userIds = submissions.map((s: any) => s.user_id);
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id, name, avatar_url, role')
        .in('id', userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      for (const s of submissions as any[]) {
        s.profile = profileMap.get(s.user_id) || null;
      }
    }

    // 전체 멤버 (제출 현황용) - 게스트 포함, role 로 뱃지 구분
    const { data: allMembers } = await adminClient
      .from('profiles')
      .select('id, name, role')
      .in('role', ['admin', 'member', 'guest']);

    // 댓글
    let comments: any[] = [];
    if (submissions && submissions.length > 0) {
      const submissionIds = submissions.map((s: any) => s.id);
      const { data: commentsData } = await adminClient
        .from('submission_comments')
        .select('*')
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: true });

      // 댓글 작성자 프로필 조회
      if (commentsData && commentsData.length > 0) {
        const commentUserIds = [...new Set(commentsData.map((c: any) => c.user_id))];
        const { data: commentProfiles } = await adminClient
          .from('profiles')
          .select('id, name')
          .in('id', commentUserIds as string[]);
        const cpMap = new Map((commentProfiles || []).map((p: any) => [p.id, p]));
        for (const c of commentsData as any[]) {
          c.profile = cpMap.get(c.user_id) || null;
        }
      }
      comments = commentsData || [];
    }

    // 녹음 기록
    const { data: records } = await supabase
      .from('meeting_records')
      .select('*')
      .eq('schedule_id', id)
      .order('created_at', { ascending: false });

    // 게스트 참석 신청(RSVP) - 관리자에게만 개인정보 포함해 반환
    let rsvps: any[] = [];
    if (user) {
      const { data: me } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (me?.role === 'admin') {
        const { data: rsvpData } = await adminClient
          .from('meeting_rsvps')
          .select('*')
          .eq('schedule_id', id)
          .order('created_at', { ascending: false });
        rsvps = rsvpData || [];
      }
    }

    return NextResponse.json({
      schedule: { ...schedule, presenter, selected_book },
      submissions: submissions || [],
      allMembers: allMembers || [],
      comments,
      records: records || [],
      rsvps,
      currentUserId: user?.id || null
    });
  } catch (error) {
    console.error('Meeting detail API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'reveal') {
      // 권한 확인 (관리자 또는 발제자)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const { data: schedule } = await supabase
        .from('schedules')
        .select('presenter_id, selected_book_id')
        .eq('id', id)
        .single();

      const isAdmin = profile?.role === 'admin';
      const isPresenter = schedule?.presenter_id === user.id;

      if (!isAdmin && !isPresenter) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
      }

      // 책 상태 업데이트
      if (schedule?.selected_book_id) {
        await supabase
          .from('books')
          .update({ status: 'completed' })
          .eq('id', schedule.selected_book_id);
      }

      // 모임 공개 처리
      const { error } = await supabase
        .from('schedules')
        .update({ is_revealed: true })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_invite') {
      // 공개 초대 링크 on/off (관리자만)
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
      }

      const { error } = await adminClient
        .from('schedules')
        .update({ invite_public: !!body.invite_public })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, invite_public: !!body.invite_public });
    }

    if (action === 'update_description') {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const { data: schedule } = await adminClient
        .from('schedules')
        .select('presenter_id')
        .eq('id', id)
        .single();

      const isAdmin = profile?.role === 'admin';
      const isPresenter = schedule?.presenter_id === user.id;

      if (!isAdmin && !isPresenter) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
      }

      const { error } = await adminClient
        .from('schedules')
        .update({ description: body.description })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Meeting PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
