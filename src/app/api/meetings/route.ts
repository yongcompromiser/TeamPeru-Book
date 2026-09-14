import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // 다가올/지난 모임 병렬 조회
    const [{ data: upcoming }, { data: past }] = await Promise.all([
      supabase
        .from('schedules')
        .select('*')
        .eq('status', 'confirmed')
        .gte('meeting_date', todayISO)
        .order('meeting_date', { ascending: true }),
      supabase
        .from('schedules')
        .select('*')
        .eq('status', 'confirmed')
        .lt('meeting_date', todayISO)
        .order('meeting_date', { ascending: false })
        .limit(20),
    ]);

    const up = upcoming || [];
    const pastList = past || [];
    const all = [...up, ...pastList];

    if (all.length === 0) {
      return NextResponse.json({ upcoming: [], past: [] });
    }

    const presenterIds = [...new Set(all.map((s) => s.presenter_id).filter(Boolean))];
    const bookIds = [...new Set(all.map((s) => s.selected_book_id).filter(Boolean))];
    const pastIds = pastList.map((s) => s.id);

    // 책 + (지난 모임) 평점 제출물 병렬 조회
    const [{ data: books }, { data: submissions }] = await Promise.all([
      bookIds.length
        ? supabase.from('books').select('id, title, author, cover_url').in('id', bookIds)
        : Promise.resolve({ data: [] as any[] }),
      pastIds.length
        ? supabase
            .from('meeting_submissions')
            .select('schedule_id, rating, user_id')
            .in('schedule_id', pastIds)
            .not('rating', 'is', null)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // 발제자 + 평점 작성자 프로필을 한 번에 조회
    const raterIds = (submissions || []).map((s: any) => s.user_id);
    const allUserIds = [...new Set([...presenterIds, ...raterIds].filter(Boolean))];
    const { data: profiles } = allUserIds.length
      ? await supabase.from('profiles').select('id, name, avatar_url').in('id', allUserIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const bookMap = new Map((books || []).map((b: any) => [b.id, b]));
    const ratingsBySchedule = new Map<string, { name: string; avatar_url: string | null; rating: number }[]>();
    for (const s of submissions || []) {
      const arr = ratingsBySchedule.get(s.schedule_id) || [];
      arr.push({
        name: profileMap.get(s.user_id)?.name || '알 수 없음',
        avatar_url: profileMap.get(s.user_id)?.avatar_url || null,
        rating: s.rating,
      });
      ratingsBySchedule.set(s.schedule_id, arr);
    }

    const attach = (schedule: any, withRatings: boolean) => ({
      ...schedule,
      presenter: schedule.presenter_id
        ? profileMap.get(schedule.presenter_id)
          ? {
              name: profileMap.get(schedule.presenter_id)!.name,
              avatar_url: profileMap.get(schedule.presenter_id)!.avatar_url ?? null,
            }
          : null
        : null,
      selected_book: schedule.selected_book_id ? bookMap.get(schedule.selected_book_id) ?? null : null,
      ratings: withRatings ? ratingsBySchedule.get(schedule.id) || [] : [],
    });

    return NextResponse.json({
      upcoming: up.map((s) => attach(s, false)),
      past: pastList.map((s) => attach(s, true)),
    });
  } catch (error) {
    console.error('Meetings API error:', error);
    return NextResponse.json({ upcoming: [], past: [] });
  }
}
