import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

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
        .select('id, name')
        .eq('id', schedule.presenter_id)
        .single();
      presenter = p;
    }

    // 책 정보
    let selected_book = null;
    if (schedule.selected_book_id) {
      const { data: b } = await supabase
        .from('books')
        .select('id, title, author, cover_url')
        .eq('id', schedule.selected_book_id)
        .single();
      selected_book = b;
    }

    // 제출물
    const { data: submissions } = await supabase
      .from('meeting_submissions')
      .select('*, profile:profiles(name, avatar_url)')
      .eq('schedule_id', id);

    // 전체 멤버 (제출 현황용)
    const { data: allMembers } = await supabase
      .from('profiles')
      .select('id, name')
      .in('role', ['admin', 'member']);

    // 댓글
    let comments: any[] = [];
    if (submissions && submissions.length > 0) {
      const submissionIds = submissions.map((s: any) => s.id);
      const { data: commentsData } = await supabase
        .from('submission_comments')
        .select('*, profile:profiles(name)')
        .in('submission_id', submissionIds)
        .order('created_at', { ascending: true });
      comments = commentsData || [];
    }

    // 녹음 기록
    const { data: records } = await supabase
      .from('meeting_records')
      .select('*')
      .eq('schedule_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      schedule: { ...schedule, presenter, selected_book },
      submissions: submissions || [],
      allMembers: allMembers || [],
      comments,
      records: records || [],
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Meeting PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
