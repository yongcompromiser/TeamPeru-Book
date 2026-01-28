import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { startOfMonth, endOfMonth, format } from 'date-fns';

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
      .select('*, profile:profiles(name)')
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
            .select('name')
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
      .select('id, name');

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
