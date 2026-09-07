import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStatsData, buildMemberSummaries } from '@/lib/stats';

// 멤버별 통계 (관리자 전용).
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await loadStatsData();
    const { members, overall } = buildMemberSummaries(data);

    return NextResponse.json({ overall, members });
  } catch (error) {
    console.error('Stats GET error:', error);
    return NextResponse.json({ error: '통계를 불러오지 못했습니다.' }, { status: 500 });
  }
}
