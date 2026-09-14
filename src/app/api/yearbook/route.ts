import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 결산이 있는 연도 목록.
// 관리자는 전부, 정회원은 관리자가 공개로 체크한 연도만 본다.
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

    // 연도 목록/모임수는 schedules 의 meeting_date 만 있으면 된다.
    // (전체 통계 loadStatsData 를 부르지 않아 쿼리 수를 크게 줄임)
    const now = Date.now();
    const [{ data: schedRows }, { data: saved }] = await Promise.all([
      adminClient.from('schedules').select('meeting_date'),
      adminClient.from('year_reviews').select('year, title, theme, is_published'),
    ]);

    const pastYears = (schedRows || [])
      .filter((s) => new Date(s.meeting_date as string).getTime() <= now)
      .map((s) => new Date(s.meeting_date as string).getFullYear());
    const years = [...new Set(pastYears)].sort((a, b) => b - a);
    const meetingCountByYear = new Map<number, number>();
    for (const y of pastYears) meetingCountByYear.set(y, (meetingCountByYear.get(y) || 0) + 1);

    const savedMap = new Map(
      (saved ?? []).map((r) => [
        r.year as number,
        {
          title: (r.title as string | null) ?? null,
          theme: (r.theme as string | null) ?? null,
          is_published: r.is_published === true,
        },
      ])
    );

    const isAdmin = profile.role === 'admin';

    const items = years
      // 정회원에게는 공개로 체크된 연도만 보여준다
      .filter((year) => isAdmin || savedMap.get(year)?.is_published === true)
      .map((year) => ({
        year,
        meeting_count: meetingCountByYear.get(year) ?? 0,
        title: savedMap.get(year)?.title ?? null,
        theme: savedMap.get(year)?.theme ?? null,
        is_published: savedMap.get(year)?.is_published ?? false,
        has_review: savedMap.has(year),
      }));

    return NextResponse.json({ years: items, canEdit: isAdmin });
  } catch (error) {
    console.error('Yearbook GET error:', error);
    return NextResponse.json({ error: '연말결산을 불러오지 못했습니다.' }, { status: 500 });
  }
}
