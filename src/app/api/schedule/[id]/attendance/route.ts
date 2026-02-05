import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status } = await request.json();

  // 기존 투표 확인
  const { data: existing } = await adminClient
    .from('attendances')
    .select('id')
    .eq('schedule_id', id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    await adminClient
      .from('attendances')
      .update({ status })
      .eq('id', existing.id);
  } else {
    await adminClient
      .from('attendances')
      .insert({ schedule_id: id, user_id: user.id, status });
  }

  // 업데이트된 전체 참석 목록 반환
  const { data: attendances } = await adminClient
    .from('attendances')
    .select('*')
    .eq('schedule_id', id);

  // 프로필 별도 조회
  if (attendances && attendances.length > 0) {
    const userIds = attendances.map((a: any) => a.user_id);
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    for (const a of attendances) {
      (a as any).profile = profileMap.get(a.user_id) || null;
    }
  }

  return NextResponse.json({ attendances });
}
