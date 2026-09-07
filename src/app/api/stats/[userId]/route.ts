import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStatsData, buildMemberSummaries, buildMemberDetail } from '@/lib/stats';

// 멤버 개인 상세 통계. 정회원(member/admin)이면 볼 수 있다.
const VIEWABLE_ROLES = ['member', 'admin'];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
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
    const { members } = buildMemberSummaries(data);
    const summary = members.find((m) => m.id === userId);

    if (!summary) {
      return NextResponse.json({ error: '해당 멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ detail: buildMemberDetail(data, summary) });
  } catch (error) {
    console.error('Stats detail GET error:', error);
    return NextResponse.json({ error: '통계를 불러오지 못했습니다.' }, { status: 500 });
  }
}
