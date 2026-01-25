import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Calendar, BookOpen, MessageSquare, PenTool } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch upcoming schedules
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*, book:books(*)')
    .gte('meeting_date', new Date().toISOString())
    .order('meeting_date', { ascending: true })
    .limit(3);

  // Fetch recent discussions
  const { data: discussions } = await supabase
    .from('discussions')
    .select('*, profile:profiles(*), book:books(*)')
    .order('created_at', { ascending: false })
    .limit(3);

  // Fetch recent reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, profile:profiles(*), book:books(*)')
    .order('created_at', { ascending: false })
    .limit(3);

  // Get counts
  const { count: bookCount } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true });

  const { count: discussionCount } = await supabase
    .from('discussions')
    .select('*', { count: 'exact', head: true });

  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true });

  const { count: scheduleCount } = await supabase
    .from('schedules')
    .select('*', { count: 'exact', head: true });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="등록된 책"
          value={bookCount || 0}
          icon={BookOpen}
          href="/books"
        />
        <StatCard
          title="모임 일정"
          value={scheduleCount || 0}
          icon={Calendar}
          href="/schedule"
        />
        <StatCard
          title="발제"
          value={discussionCount || 0}
          icon={MessageSquare}
          href="/discussions"
        />
        <StatCard
          title="독후감"
          value={reviewCount || 0}
          icon={PenTool}
          href="/reviews"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upcoming Schedules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">다가오는 모임</CardTitle>
            <Link href="/schedule" className="text-sm text-blue-600 hover:underline">
              전체 보기
            </Link>
          </CardHeader>
          <CardContent>
            {schedules && schedules.length > 0 ? (
              <ul className="space-y-4">
                {schedules.map((schedule) => (
                  <li key={schedule.id} className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{schedule.title}</p>
                      <p className="text-sm text-gray-600">
                        {formatDate(schedule.meeting_date, {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </p>
                      {schedule.book && (
                        <Badge variant="info" className="mt-1">
                          {schedule.book.title}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">예정된 모임이 없습니다</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Discussions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">최근 발제</CardTitle>
            <Link href="/discussions" className="text-sm text-blue-600 hover:underline">
              전체 보기
            </Link>
          </CardHeader>
          <CardContent>
            {discussions && discussions.length > 0 ? (
              <ul className="space-y-4">
                {discussions.map((discussion) => (
                  <li key={discussion.id}>
                    <Link
                      href={`/discussions/${discussion.id}`}
                      className="block hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg"
                    >
                      <p className="font-medium text-gray-900 truncate">{discussion.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <span>{discussion.profile?.name}</span>
                        <span>·</span>
                        <span>{formatDate(discussion.created_at, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">발제가 없습니다</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reviews */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">최근 독후감</CardTitle>
          <Link href="/reviews" className="text-sm text-blue-600 hover:underline">
            전체 보기
          </Link>
        </CardHeader>
        <CardContent>
          {reviews && reviews.length > 0 ? (
            <ul className="grid md:grid-cols-3 gap-4">
              {reviews.map((review) => (
                <li key={review.id}>
                  <Link
                    href={`/reviews/${review.id}`}
                    className="block p-4 border rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <p className="font-medium text-gray-900 truncate">{review.title}</p>
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {review.book?.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        {review.profile?.name}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">독후감이 없습니다</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-blue-300 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-600">{title}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
