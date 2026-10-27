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

      if (!bookId || typeof bookId !== 'string') {
        return NextResponse.json({ error: '책을 선택해주세요.' }, { status: 400 });
      }

      // schedules 의 RLS 는 UPDATE 를 관리자에게만 허용한다. 사용자 클라이언트로 고치면
      // 발제자(member)일 때 0행이 수정되는데 에러도 나지 않아 조용히 실패한다.
      // 그래서 admin 으로 쓰되, 권한은 여기서 직접 확인한다.
      const { data: schedule } = await admin
        .from('schedules')
        .select('presenter_id, selected_book_id, is_revealed, description')
        .eq('id', scheduleId)
        .maybeSingle();

      if (!schedule) {
        return NextResponse.json({ error: '모임을 찾을 수 없습니다.' }, { status: 404 });
      }

      // 관리자 또는 그 모임의 발제자만 선정할 수 있다 (화면 조건과 동일)
      const isAdminViewer = viewer?.role === 'admin';
      const canSelect = isAdminViewer || schedule.presenter_id === user.id;
      if (!canSelect) {
        return NextResponse.json(
          { error: '관리자 또는 발제자만 책을 선정할 수 있습니다.' },
          { status: 403 }
        );
      }

      const prevBookId = (schedule.selected_book_id as string | null) ?? null;

      // 같은 책을 다시 누른 경우 — 아무것도 바꾸지 않는다
      if (prevBookId === bookId) {
        return NextResponse.json({ success: true, changed: false });
      }

      // 존재하지 않는 책으로 바꾸면 모임이 '미선정'처럼 보이게 된다
      const { data: nextBook } = await admin
        .from('books')
        .select('id, title')
        .eq('id', bookId)
        .maybeSingle();
      if (!nextBook) {
        return NextResponse.json({ error: '책을 찾을 수 없습니다.' }, { status: 404 });
      }

      // 이미 공개(토론 완료)된 모임은 통계·연말결산이 이 책을 기준으로 집계된다.
      // 발제자가 되돌릴 수 없게 바꾸면 곤란하므로 관리자만 허용한다.
      if (schedule.is_revealed && !isAdminViewer) {
        return NextResponse.json(
          { error: '이미 공개된 모임입니다. 책 변경은 관리자에게 요청해주세요.' },
          { status: 409 }
        );
      }

      const { error: scheduleError } = await admin
        .from('schedules')
        .update({ selected_book_id: bookId })
        .eq('id', scheduleId);

      if (scheduleError) {
        return NextResponse.json({ error: scheduleError.message }, { status: 400 });
      }

      // 공개된 모임의 책을 바꾸면 책 상태도 따라가야 한다.
      // 공개 시 이전 책이 'completed' 로 바뀌었으므로, 그 표시를 새 책으로 옮긴다.
      if (schedule.is_revealed) {
        if (prevBookId) {
          // 다른 공개된 모임에서도 다룬 책이면 'completed' 를 유지한다.
          // 조회가 실패하면 섣불리 되돌리지 않는다 — 멀쩡한 '토론 완료' 를 지우는 게 더 나쁘다.
          const { count: otherRevealed, error: otherErr } = await admin
            .from('schedules')
            .select('id', { count: 'exact', head: true })
            .eq('selected_book_id', prevBookId)
            .eq('is_revealed', true)
            .neq('id', scheduleId);

          if (otherErr) {
            console.error('이전 책의 다른 공개 모임 조회 실패:', otherErr.message);
          } else if (!otherRevealed) {
            const { error: revertErr } = await admin
              .from('books')
              .update({ status: 'waiting' })
              .eq('id', prevBookId);
            if (revertErr) console.error('이전 책 상태 되돌리기 실패:', revertErr.message);
          }
        }

        const { error: completeErr } = await admin
          .from('books')
          .update({ status: 'completed' })
          .eq('id', bookId);
        if (completeErr) console.error('새 책 상태 변경 실패:', completeErr.message);
      }

      // 선정 사실은 schedules.selected_book_id 로 남고, '후보 경험'은 거기서 파생한다.
      // 책 상태(waiting/completed)는 모임 공개 시 'completed' 로만 바뀐다.
      //
      // 책을 바꿔도 이미 쓴 발제·한줄평·평점(meeting_submissions)과 선정 사유는 지우지 않는다.
      // 지워버리면 되돌릴 방법이 없어서, 대신 몇 건이 남아 있는지 알려주고 판단을 맡긴다.
      let affectedSubmissions = 0;
      if (prevBookId) {
        const { count } = await admin
          .from('meeting_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('schedule_id', scheduleId);
        affectedSubmissions = count ?? 0;
      }

      return NextResponse.json({
        success: true,
        changed: true,
        previousBookId: prevBookId,
        affectedSubmissions,
        hasSelectionReason: !!((schedule.description as string | null) ?? '').trim(),
      });
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
