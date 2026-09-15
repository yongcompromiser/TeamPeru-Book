import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { getViewer, isMember } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, scheduleId, bookId, candidateId } = body;

    // 후보 등록·투표·선정은 모두 모임 운영에 영향을 준다. 정회원만.
    const viewer = await getViewer();
    if (!isMember(viewer)) {
      return NextResponse.json(
        { error: '정회원만 책 후보·투표를 다룰 수 있습니다.' },
        { status: 403 }
      );
    }

    if (action === 'add_candidate') {
      // Add book to candidates
      const { error } = await supabase
        .from('schedule_book_candidates')
        .insert({
          schedule_id: scheduleId,
          book_id: bookId,
        });

      if (error) {
        console.error('Add candidate error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // '후보 경험'은 별도 상태로 저장하지 않고 schedule_book_candidates 존재로 파생한다.
      return NextResponse.json({ success: true });
    }

    if (action === 'remove_candidate') {
      // Remove book from candidates
      const { error } = await supabase
        .from('schedule_book_candidates')
        .delete()
        .eq('id', candidateId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'vote') {
      // Vote for a book
      const { error } = await supabase
        .from('book_votes')
        .insert({
          schedule_id: scheduleId,
          book_id: bookId,
          user_id: user.id,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'unvote') {
      // Remove vote for a book
      const { error } = await supabase
        .from('book_votes')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('book_id', bookId)
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'select_book') {
      const admin = createAdminClient();

      // schedules 의 RLS 는 UPDATE 를 관리자에게만 허용한다. 사용자 클라이언트로 고치면
      // 발제자(member)일 때 0행이 수정되는데 에러도 나지 않아 조용히 실패한다.
      // 그래서 admin 으로 쓰되, 권한은 여기서 직접 확인한다.
      const { data: schedule } = await admin
        .from('schedules')
        .select('presenter_id')
        .eq('id', scheduleId)
        .maybeSingle();

      if (!schedule) {
        return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });
      }

      // 관리자 또는 그 모임의 발제자만 선정할 수 있다 (화면 조건과 동일)
      const canSelect = viewer?.role === 'admin' || schedule.presenter_id === user.id;
      if (!canSelect) {
        return NextResponse.json(
          { error: '관리자 또는 발제자만 책을 선정할 수 있습니다.' },
          { status: 403 }
        );
      }

      const { error: scheduleError } = await admin
        .from('schedules')
        .update({ selected_book_id: bookId })
        .eq('id', scheduleId);

      if (scheduleError) {
        return NextResponse.json({ error: scheduleError.message }, { status: 400 });
      }
      // 선정 사실은 schedules.selected_book_id 로 남고, '후보 경험'은 거기서 파생한다.
      // 책 상태(waiting/completed)는 모임 공개 시 'completed' 로만 바뀐다.
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Schedule books API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get candidates
    const { data: candidates } = await supabase
      .from('schedule_book_candidates')
      .select('*, book:books(*)')
      .eq('schedule_id', scheduleId);

    // Get votes
    const { data: votes } = await supabase
      .from('book_votes')
      .select('book_id, user_id')
      .eq('schedule_id', scheduleId);

    // Get voter names
    let votesWithNames: any[] = [];
    if (votes && votes.length > 0) {
      const userIds = [...new Set(votes.map((v) => v.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);
      votesWithNames = votes.map((v) => ({
        ...v,
        voter_name: profileMap.get(v.user_id) || '알 수 없음'
      }));
    }

    return NextResponse.json({
      candidates: candidates || [],
      votes: votesWithNames,
    });
  } catch (error) {
    console.error('Schedule books GET error:', error);
    return NextResponse.json({ candidates: [], votes: [] });
  }
}
