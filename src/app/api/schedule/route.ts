import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { notifyMembers } from '@/lib/kakao-notify';

function getBaseUrl(request: Request): string {
  const h = request.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host')!;
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString();
    const currentDate = new Date(dateStr);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);

    // 투표 조회
    const { data: votes } = await supabase
      .from('schedule_votes')
      .select('*, profile:profiles(name, avatar_url)')
      .gte('vote_date', format(start, 'yyyy-MM-dd'))
      .lte('vote_date', format(end, 'yyyy-MM-dd'));

    // 일정 조회
    const { data: schedulesData } = await supabase
      .from('schedules')
      .select('*')
      .gte('meeting_date', start.toISOString())
      .lte('meeting_date', end.toISOString());

    // 일정에 presenter와 book 정보 추가
    const schedules = schedulesData ? await Promise.all(
      schedulesData.map(async (schedule: any) => {
        let presenter = null;
        let selected_book = null;

        if (schedule.presenter_id) {
          const { data: p } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', schedule.presenter_id)
            .single();
          presenter = p;
        }

        if (schedule.selected_book_id) {
          const { data: b } = await supabase
            .from('books')
            .select('title, author')
            .eq('id', schedule.selected_book_id)
            .single();
          selected_book = b;
        }

        return { ...schedule, presenter, selected_book };
      })
    ) : [];

    // 멤버 조회
    const { data: members } = await supabase
      .from('profiles')
      .select('id, name, avatar_url');

    // 가능한 책 조회
    const { data: availableBooks } = await supabase
      .from('books')
      .select('*')
      .in('status', ['waiting', 'nominated', 'selected']);

    return NextResponse.json({
      votes: votes || [],
      schedules,
      members: members || [],
      availableBooks: availableBooks || [],
      currentUserId: user?.id || null
    });
  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json({
      votes: [],
      schedules: [],
      members: [],
      availableBooks: [],
      currentUserId: null
    });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'vote') {
      // 투표 추가
      const { date } = data;
      const { error } = await supabase
        .from('schedule_votes')
        .insert({ user_id: user.id, vote_date: date });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'unvote') {
      // 투표 취소
      const { date } = data;
      const { error } = await supabase
        .from('schedule_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('vote_date', date);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'confirm') {
      // 일정 확정
      const { date, presenterId, bookId } = data;
      const { error } = await supabase
        .from('schedules')
        .insert({
          title: '정기 모임',
          meeting_date: new Date(date).toISOString(),
          presenter_id: presenterId || null,
          selected_book_id: bookId || null,
          status: 'confirmed',
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // 전원에게 카톡 "나에게 보내기" 알림 (실패해도 일정 확정은 성공 처리)
      try {
        const meetingDate = new Date(date);
        const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
        const dateLabel = `${format(meetingDate, 'yyyy년 M월 d일')} (${WEEKDAYS[meetingDate.getDay()]})`;

        let bookLabel = '';
        if (bookId) {
          const { data: b } = await supabase.from('books').select('title').eq('id', bookId).single();
          if (b?.title) bookLabel = `\n📖 ${b.title}`;
        }
        let presenterLabel = '';
        if (presenterId) {
          const { data: p } = await supabase.from('profiles').select('name').eq('id', presenterId).single();
          if (p?.name) presenterLabel = `\n🎤 발제: ${p.name}`;
        }

        const text = `📅 [팀페루 독서토론] 새 모임이 확정됐어요!\n🗓️ ${dateLabel} 정기 모임${bookLabel}${presenterLabel}`;
        await notifyMembers(text, `${getBaseUrl(request)}/schedule`);
      } catch (e) {
        console.error('일정 확정 알림 실패:', e);
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'cancel') {
      // 일정 취소 = 해당 일정과 모임 관련 데이터를 완전 삭제.
      // 클라이언트 직접 삭제는 RLS로 조용히 실패할 수 있어(0행 삭제·에러없음),
      // service role(admin) 로 확실하게 지운다. 지우면 모임 탭에서도 자동으로 사라진다.
      const { scheduleId } = data;
      if (!scheduleId) {
        return NextResponse.json({ error: 'scheduleId required' }, { status: 400 });
      }

      // 관리자만 취소 가능
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
      }

      const admin = createAdminClient();

      // 이 일정을 참조하는 자식 데이터 정리(존재하지 않는 테이블은 무시).
      const childTables = [
        'book_votes',
        'schedule_book_candidates',
        'meeting_submissions',
        'meeting_minutes',
        'meeting_comments',
        'attendances',
        'discussions',
        'recaps',
      ];
      for (const t of childTables) {
        try {
          await admin.from(t).delete().eq('schedule_id', scheduleId);
        } catch {
          // 테이블이 없거나 컬럼이 없으면 건너뜀
        }
      }

      // 일정 삭제
      const { error } = await admin.from('schedules').delete().eq('id', scheduleId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'update_details') {
      // 시간/장소 업데이트
      const { scheduleId, meetingTime, location } = data;

      // 권한 확인 (관리자 또는 발제자)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const { data: schedule } = await supabase
        .from('schedules')
        .select('presenter_id')
        .eq('id', scheduleId)
        .single();

      const isAdmin = profile?.role === 'admin';
      const isPresenter = schedule?.presenter_id === user.id;

      if (!isAdmin && !isPresenter) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
      }

      const { error } = await supabase
        .from('schedules')
        .update({
          meeting_time: meetingTime || null,
          location: location || null,
        })
        .eq('id', scheduleId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
