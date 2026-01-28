import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Calendar, BookOpen, User } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch next upcoming schedule
  const { data: schedulesData } = await supabase
    .from('schedules')
    .select('*')
    .gte('meeting_date', new Date().toISOString())
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
        .select('name')
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

    nextSchedule = { ...schedule, presenter, book };
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
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Next Meeting */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
            <div className="flex items-center gap-2 text-white">
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
                    <span>발제자: {nextSchedule.presenter.name}</span>
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

        {/* Featured Book */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
            <div className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5" />
              <span className="font-medium">이번 책</span>
            </div>
          </div>
          <CardContent className="pt-6">
            {featuredBook ? (
              <div className="flex gap-6">
                {/* Book Cover */}
                <div className="flex-shrink-0">
                  {featuredBook.cover_url ? (
                    <img
                      src={featuredBook.cover_url}
                      alt={featuredBook.title}
                      className="w-32 h-44 object-cover rounded-lg shadow-md"
                    />
                  ) : (
                    <div className="w-32 h-44 bg-gray-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Book Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">
                    {featuredBook.title}
                  </h2>
                  <p className="text-gray-600 mt-1">{featuredBook.author}</p>

                  {featuredPresenter && (
                    <div className="flex items-center gap-1 text-sm text-emerald-600 mt-2">
                      <User className="w-4 h-4" />
                      <span>발제자: {featuredPresenter.name}</span>
                    </div>
                  )}

                  {featuredBook.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                      {featuredBook.description}
                    </p>
                  )}

                  <Link
                    href={`/books/${featuredBook.id}`}
                    className="inline-block mt-3 text-emerald-600 hover:underline text-sm"
                  >
                    자세히 보기 →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">선정된 책이 없습니다</p>
                <Link
                  href="/books"
                  className="inline-block mt-3 text-emerald-600 hover:underline text-sm"
                >
                  책 목록 보기
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
