import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // adminClient 는 RLS 를 우회하므로 여기서 직접 막지 않으면 로그인 없이도 읽힌다.
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
    const isAdmin = me?.role === 'admin';

    // raw_text 는 녹취 원문이라 대화가 그대로 들어 있다. 정리본(summary)만 공유하고
    // 원문은 회의록 정리 작업을 하는 관리자에게만 내려준다.
    // (화면에서도 STT 원문 카드는 관리자에게만 보인다)
    const columns = isAdmin
      ? 'id, schedule_id, raw_text, summary, created_by, created_at, updated_at'
      : 'id, schedule_id, summary, created_by, created_at, updated_at';

    const { data } = await adminClient
      .from('meeting_minutes')
      .select(columns)
      .eq('schedule_id', id)
      .single();

    return NextResponse.json({ minutes: data || null });
  } catch (error) {
    console.error('Minutes GET error:', error);
    return NextResponse.json({ minutes: null });
  }
}

export async function POST(
  request: NextRequest,
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

    // 회의록은 관리자만 작성·수정할 수 있다. (adminClient 는 RLS 를 우회하므로
    // 여기서 권한을 직접 확인하지 않으면 로그인한 누구나 덮어쓸 수 있다.)
    const { data: me } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 회의록을 수정할 수 있습니다.' }, { status: 403 });
    }

    const { raw_text, summary } = await request.json();

    // 기존 회의록 확인
    const { data: existing } = await adminClient
      .from('meeting_minutes')
      .select('id')
      .eq('schedule_id', id)
      .single();

    if (existing) {
      // 업데이트
      const updateData: any = { updated_at: new Date().toISOString() };
      if (raw_text !== undefined) updateData.raw_text = raw_text;
      if (summary !== undefined) updateData.summary = summary;

      const { error } = await adminClient
        .from('meeting_minutes')
        .update(updateData)
        .eq('id', existing.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // 새로 생성
      const { error } = await adminClient
        .from('meeting_minutes')
        .insert({
          schedule_id: id,
          raw_text: raw_text || null,
          summary: summary || null,
          created_by: user.id,
        });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Minutes POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
