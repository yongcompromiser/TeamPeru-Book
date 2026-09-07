import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStatsData } from '@/lib/stats';
import { listYears } from '@/lib/yearbook';

// 결산이 있는 연도 목록. 아직 다듬는 중이라 관리자에게만 보인다.
const VIEWABLE_ROLES = ['admin'];

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
    const years = listYears(data);

    // 연도별 요약(모임 수)과, 사람이 쓴 결산이 있는지 여부
    const { data: saved } = await adminClient.from('year_reviews').select('year, title, theme');
    const savedMap = new Map(
      (saved ?? []).map((r) => [
        r.year as number,
        { title: (r.title as string | null) ?? null, theme: (r.theme as string | null) ?? null },
      ])
    );

    const items = years.map((year) => ({
      year,
      meeting_count: data.pastSchedules.filter(
        (s) => new Date(s.meeting_date as string).getFullYear() === year
      ).length,
      title: savedMap.get(year)?.title ?? null,
      theme: savedMap.get(year)?.theme ?? null,
      has_review: savedMap.has(year),
    }));

    return NextResponse.json({ years: items });
  } catch (error) {
    console.error('Yearbook GET error:', error);
    return NextResponse.json({ error: '연말결산을 불러오지 못했습니다.' }, { status: 500 });
  }
}
