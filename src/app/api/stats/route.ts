import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStatsData, buildMemberSummaries } from '@/lib/stats';

// 멤버별 통계. 정회원(member/admin)이면 볼 수 있다.
// 게스트/가입대기는 모임 내부 기록이라 제외한다.
const VIEWABLE_ROLES = ['member', 'admin'];

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

    if (!profile || !VIEWABLE_ROLES.includes(profile.role)) {
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
