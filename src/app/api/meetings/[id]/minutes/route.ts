import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminClient = createAdminClient();

    const { data } = await adminClient
      .from('meeting_minutes')
      .select('*')
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
