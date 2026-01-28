import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    // 다가올 모임
    const { data: upcoming } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'confirmed')
      .gte('meeting_date', now)
      .order('meeting_date', { ascending: true });

    // 지난 모임
    const { data: past } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'confirmed')
      .lt('meeting_date', now)
      .order('meeting_date', { ascending: false })
      .limit(20);

    // 상세 정보 로드
    const loadDetails = async (schedules: any[], includRatings = false) => {
      return Promise.all(
        schedules.map(async (schedule) => {
          let presenter = null;
          let selected_book = null;
          let ratings: { name: string; rating: number }[] = [];

          if (schedule.presenter_id) {
            const { data: p } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', schedule.presenter_id)
              .single();
            presenter = p;
          }

          if (schedule.selected_book_id) {
            const { data: b } = await supabase
              .from('books')
              .select('title, author, cover_url')
              .eq('id', schedule.selected_book_id)
              .single();
            selected_book = b;
          }

          // 지난 모임의 경우 참여자 평점 가져오기
          if (includRatings) {
            const { data: submissions } = await supabase
              .from('meeting_submissions')
              .select('rating, user_id')
              .eq('schedule_id', schedule.id)
              .not('rating', 'is', null);

            if (submissions && submissions.length > 0) {
              const userIds = submissions.map((s: any) => s.user_id);
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, name')
                .in('id', userIds);

              const profileMap = new Map(profiles?.map((p: any) => [p.id, p.name]) || []);
              ratings = submissions.map((s: any) => ({
                name: profileMap.get(s.user_id) || '알 수 없음',
                rating: s.rating
              }));
            }
          }

          return { ...schedule, presenter, selected_book, ratings };
        })
      );
    };

    const upcomingWithDetails = upcoming ? await loadDetails(upcoming, false) : [];
    const pastWithDetails = past ? await loadDetails(past, true) : [];

    return NextResponse.json({
      upcoming: upcomingWithDetails,
      past: pastWithDetails
    });
  } catch (error) {
    console.error('Meetings API error:', error);
    return NextResponse.json({ upcoming: [], past: [] });
  }
}
