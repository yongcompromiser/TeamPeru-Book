import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTimeToMinutes } from '@/lib/attendance';

// 모임별 출결 · 도착 시각.
// 참여자(member/admin) 누구나 조회·수정할 수 있다. 게스트/대기자는 수정 불가.

const EDITABLE_ROLES = ['member', 'admin'];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('meeting_arrivals')
      .select('user_id, status, arrived_at, note, updated_by, updated_at')
      .eq('schedule_id', id);

    if (error) {
      console.error('Arrivals GET error:', error.message);
      return NextResponse.json({ arrivals: [] });
    }

    return NextResponse.json({ arrivals: data ?? [] });
  } catch (error) {
    console.error('Arrivals GET error:', error);
    return NextResponse.json({ arrivals: [] });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: me } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!me || !EDITABLE_ROLES.includes(me.role)) {
      return NextResponse.json({ error: '출결을 기록할 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, status, arrivedAt, note } = body as {
      userId?: string;
      status?: string;
      arrivedAt?: string | null;
      note?: string | null;
    };

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    if (status !== 'attended' && status !== 'absent' && status !== null) {
      return NextResponse.json({ error: 'status 값이 올바르지 않습니다.' }, { status: 400 });
    }

    // status 를 비우면 '미기록'으로 되돌리는 것으로 본다 → 행 삭제
    if (status === null) {
      const { error } = await adminClient
        .from('meeting_arrivals')
        .delete()
        .eq('schedule_id', id)
        .eq('user_id', userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    const cleanArrived = (arrivedAt ?? '').trim();
    if (status === 'attended' && cleanArrived.length > 0 && parseTimeToMinutes(cleanArrived) === null) {
      return NextResponse.json(
        { error: '도착 시각은 HH:MM 형식으로 입력해주세요.' },
        { status: 400 }
      );
    }

    const { error } = await adminClient.from('meeting_arrivals').upsert(
      {
        schedule_id: id,
        user_id: userId,
        status,
        // 불참이면 도착 시각은 의미가 없으므로 비운다
        arrived_at: status === 'absent' ? null : cleanArrived || null,
        note: (note ?? '').trim().slice(0, 200) || null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'schedule_id,user_id' }
    );

    if (error) {
      console.error('Arrivals POST error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Arrivals POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
