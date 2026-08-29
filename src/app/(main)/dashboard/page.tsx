import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Calendar, BookOpen, User } from 'lucide-react';
import Link from 'next/link';
import { BookVoteCard } from '@/components/features/book-vote-card';
import { Avatar } from '@/components/ui/avatar';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Fetch next upcoming schedule (당일 자정까지 표시)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: schedulesData } = await supabase
    .from('schedules')
    .select('*')
    .gte('meeting_date', today.toISOString())
    .order('meeting_date', { ascending: true })
    .limit(1);

  let nextSchedule: any = null;

  if (schedulesData && schedulesData.length > 0) {
    const schedule = schedulesData[0];

    // Fetch presenter
    let presenter = null;
    if (schedule.presenter_id) {
      const { data: p } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', schedule.presenter_id)
        .single();
      presenter = p;
    }

    // Fetch book
    let book = null;
    if (schedule.selected_book_id) {
      const { data: b } = await supabase
        .from('books')
        .select('*')
        .eq('id', schedule.selected_book_id)
        .single();
      book = b;
    }

    // Fetch submissions for this schedule (adminClient로 전체 조회)
    const { data: submissions } = await adminClient
      .from('meeting_submissions')
      .select('user_id, discussion, rating, one_liner')
      .eq('schedule_id', schedule.id);

    // 제출자 프로필 별도 조회
    if (submissions && submissions.length > 0) {
      const userIds = submissions.map((s: any) => s.user_id);
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
      for (const s of submissions as any[]) {
        s.profileName = profileMap.get(s.user_id) || '알 수 없음';
      }
    }

    // Fetch all members (role = member or admin)
    const { data: members } = await adminClient
      .from('profiles')
      .select('id, name, avatar_url')
      .in('role', ['member', 'admin']);

    const submissionMap = new Map(
      (submissions || []).map((s: any) => [s.user_id, s])
    );

    const participantStatus = (members || []).map((m: any) => {
      const sub = submissionMap.get(m.id) as any;
      return {
        name: m.name,
        avatar_url: m.avatar_url,
        discussion: !!(sub?.discussion && sub.discussion.trim() !== ''),
        rating: sub?.rating != null,
        oneLiner: !!(sub?.one_liner && sub.one_liner.trim() !== ''),
      };
    });

    nextSchedule = { ...schedule, presenter, book, participantStatus };
  }

  // Fetch current/featured book (from next schedule or most recent selected book)
  let featuredBook = nextSchedule?.book;
  let featuredPresenter = nextSchedule?.presenter;

  if (!featuredBook) {
    const { data: booksData } = await supabase
      .from('books')
      .select('*')
      .eq('status', 'selected')
      .order('created_at', { ascending: false })
      .limit(1);
    featuredBook = booksData?.[0] || null;
  }

  return (
    <div className="space-y-8">
      {/* Hero — 움직이는 그라데이션 + 둥둥 떠다니는 책 */}
      <div
        className="animate-gradient animate-fade-up relative overflow-hidden rounded-2xl p-8 sm:p-10 text-white shadow-sm"
        style={{ backgroundImage: 'linear-gradient(120deg, #1e3a5f, #2d6a9f, #3b82f6, #2d6a9f, #1e3a5f)' }}
      >
        <span className="animate-float pointer-events-none absolute top-6 right-8 select-none text-4xl opacity-80">📚</span>
        <span className="animate-float-slow pointer-events-none absolute bottom-5 right-24 select-none text-2xl opacity-70">✨</span>
        <span className="animate-float-slow pointer-events-none absolute top-12 right-44 hidden select-none text-xl opacity-60 sm:block">📖</span>
        <div className="relative">
          <p className="text-sm font-medium text-white/80">팀 페루 독서토론</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">함께 읽고, 나누는 즐거움 📖</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">
            {nextSchedule
              ? `다음 모임 · ${formatDate(nextSchedule.meeting_date, { month: 'long', day: 'numeric', weekday: 'long' })}`
              : '다음 모임을 함께 준비해봐요'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Next Meeting */}
        <Card className="animate-fade-up overflow-hidden" style={{ animationDelay: '0.08s' }}>
          <div className="shimmer-band bg-gradient-to-r from-blue-500 to-blue-600 p-4">
            <div className="relative flex items-center gap-2 text-white">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">다가오는 모임</span>
            </div>
          </div>
          <CardContent className="pt-6">
            {nextSchedule ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {nextSchedule.title}
                  </h2>
                  <p className="text-lg text-blue-600 font-medium mt-1">
                    {formatDate(nextSchedule.meeting_date, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })}
                  </p>
                </div>

                {nextSchedule.presenter && (
                  <div className="flex items-center gap-1 text-blue-600">
                    <User className="w-4 h-4" />
                    <span className="inline-flex items-center gap-1.5">발제자: <Avatar src={nextSchedule.presenter.avatar_url} name={nextSchedule.presenter.name} size="xs" />{nextSchedule.presenter.name}</span>
                  </div>
                )}

                {nextSchedule.location && (
                  <p className="text-gray-600">
                    장소: {nextSchedule.location}
                  </p>
                )}

                {nextSchedule.book && (
                  <div className="pt-2">
                    <Badge variant="info" className="text-sm">
                      {nextSchedule.book.title}
                    </Badge>
                  </div>
                )}

                {nextSchedule.participantStatus && nextSchedule.participantStatus.length > 0 && (
                  <div className="pt-3 border-t">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">참가자 현황</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs">
                            <th className="text-left py-1 pr-2">이름</th>
                            <th className="text-center py-1 px-1">발제</th>
                            <th className="text-center py-1 px-1">평점</th>
                            <th className="text-center py-1 px-1">한줄평</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nextSchedule.participantStatus.map((p: any) => (
                            <tr key={p.name} className="border-t border-gray-100">
                              <td className="py-1 pr-2 font-medium text-gray-800"><span className="inline-flex items-center gap-1.5"><Avatar src={p.avatar_url} name={p.name} size="xs" />{p.name}</span></td>
                              <td className="py-1 px-1 text-center">{p.discussion ? <span className="text-green-600">✓</span> : <span className="text-red-400">✗</span>}</td>
                              <td className="py-1 px-1 text-center">{p.rating ? <span className="text-green-600">✓</span> : <span className="text-red-400">✗</span>}</td>
                              <td className="py-1 px-1 text-center">{p.oneLiner ? <span className="text-green-600">✓</span> : <span className="text-red-400">✗</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <Link
                  href={`/meetings/${nextSchedule.id}`}
                  className="inline-block mt-2 text-blue-600 hover:underline text-sm"
                >
                  자세히 보기 →
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">예정된 모임이 없습니다</p>
                <Link
                  href="/schedule"
                  className="inline-block mt-3 text-blue-600 hover:underline text-sm"
                >
                  일정 투표하기
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Featured Book / 후보 투표 */}
        <div className="animate-fade-up" style={{ animationDelay: '0.18s' }}>
          <BookVoteCard
            scheduleId={nextSchedule?.id || null}
            featuredBook={featuredBook}
            featuredPresenter={featuredPresenter}
          />
        </div>
      </div>
    </div>
  );
}
