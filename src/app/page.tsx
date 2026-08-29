import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createAdminClient } from '@/lib/supabase/admin';
import { AmbientCanvas } from '@/components/features/ambient-canvas';
import { LandingNav } from '@/components/features/landing-nav';
import { MemoryQuotes, type Memory } from '@/components/features/memory-quotes';

export const dynamic = 'force-dynamic';

// 공개(reveal)된 모임에서 참가자들이 남긴 한줄평 = 추억 조각
async function getMemories(): Promise<Memory[]> {
  try {
    const admin = createAdminClient();
    const { data: revealed } = await admin
      .from('schedules')
      .select('id, selected_book_id')
      .eq('is_revealed', true);
    if (!revealed || revealed.length === 0) return [];
    const scheduleIds = revealed.map((s) => s.id);

    const { data: subs } = await admin
      .from('meeting_submissions')
      .select('user_id, one_liner, schedule_id')
      .in('schedule_id', scheduleIds)
      .not('one_liner', 'is', null)
      .limit(80);
    if (!subs || subs.length === 0) return [];

    const userIds = [...new Set(subs.map((s) => s.user_id))];
    const bookIds = [...new Set(revealed.map((s) => s.selected_book_id).filter(Boolean))];
    const [{ data: profs }, booksRes] = await Promise.all([
      admin.from('profiles').select('id, name').in('id', userIds),
      bookIds.length
        ? admin.from('books').select('id, title').in('id', bookIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const nameMap = new Map((profs || []).map((p: { id: string; name: string }) => [p.id, p.name]));
    const bookMap = new Map((booksRes.data || []).map((b: { id: string; title: string }) => [b.id, b.title]));
    const schedBook = new Map(revealed.map((s) => [s.id, s.selected_book_id]));

    return subs
      .map((s) => ({
        text: (s.one_liner || '').trim(),
        name: nameMap.get(s.user_id) || '익명',
        book: bookMap.get(schedBook.get(s.schedule_id) as string) || '',
      }))
      .filter((m) => m.text.length > 0 && m.text.length <= 140);
  } catch {
    return [];
  }
}

export default async function Home() {
  const memories = await getMemories();
  return (
    <div className="relative min-h-screen text-white">
      {/* 화면 고정 몰입형 배경 (스크롤 내내 유지).
          바깥 div 에 배경색을 주면 이 음수 z 레이어를 덮으므로, 다크 배경은 여기서만 칠한다. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ backgroundImage: 'linear-gradient(165deg, #15111f 0%, #241a37 50%, #2b1c30 100%)' }}
        aria-hidden="true"
      >
        <AmbientCanvas className="absolute inset-0 h-full w-full" />
      </div>

      {/* Header (전체 다크 위에서 투명, 스크롤 시 어두운 바) */}
      <LandingNav />

      <main>
        {/* Hero Section — 모임에서 남긴 한줄평이 추억처럼 떠오르는 화면 */}
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
          {/* 떠다니는 한줄평(추억) */}
          <MemoryQuotes quotes={memories} />

          {/* 담백한 중앙 */}
          <div className="container relative z-10 mx-auto px-6 text-center">
            <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-amber-100 backdrop-blur">
              <Sparkles className="animate-pulse-soft h-4 w-4" />
              팀 페루 독서토론
            </div>

            <h1 className="animate-fade-up text-3xl font-bold leading-tight text-white sm:text-4xl" style={{ animationDelay: '0.1s' }}>
              우리가 함께 읽고,{' '}
              <span className="animate-gradient bg-gradient-to-r from-amber-300 via-rose-300 to-violet-300 bg-clip-text text-transparent">
                남긴 한마디
              </span>
            </h1>

            <p className="animate-fade-up mt-3 text-white/55" style={{ animationDelay: '0.2s' }}>
              스쳐 지나간 책들, 그날의 생각들
            </p>

            <div className="animate-fade-up mt-8" style={{ animationDelay: '0.3s' }}>
              <Link href="/signup">
                <Button size="lg" className="group rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-6 text-lg shadow-lg shadow-indigo-900/40 transition-transform hover:scale-105 hover:from-blue-600 hover:to-indigo-700">
                  들어가기
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/10 py-8">
        <div className="container mx-auto px-6">
          <p className="text-center text-white/45 text-sm">
            © 2025 팀 페루 독서토론. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
