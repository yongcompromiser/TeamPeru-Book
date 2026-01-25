import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, BookOpen, Calendar, MessageSquare, PenTool } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface BookPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookDetailPage({ params }: BookPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (!book) {
    notFound();
  }

  // Fetch related data
  const [
    { data: schedules },
    { data: discussions },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from('schedules')
      .select('*')
      .eq('book_id', id)
      .order('meeting_date', { ascending: false })
      .limit(5),
    supabase
      .from('discussions')
      .select('*, profile:profiles(*)')
      .eq('book_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('reviews')
      .select('*, profile:profiles(*)')
      .eq('book_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // Calculate average rating
  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-6">
      <Link
        href="/books"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        책 목록으로
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Book Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-6">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full aspect-[2/3] object-cover rounded-lg mb-4"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-gray-400" />
                </div>
              )}
              <h1 className="text-xl font-bold text-gray-900">{book.title}</h1>
              <p className="text-gray-600 mt-1">{book.author}</p>

              {avgRating > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={i < Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-300'}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {avgRating.toFixed(1)} ({reviews?.length}개 리뷰)
                  </span>
                </div>
              )}

              {book.isbn && (
                <p className="text-sm text-gray-500 mt-3">ISBN: {book.isbn}</p>
              )}

              {book.description && (
                <p className="text-sm text-gray-600 mt-4 whitespace-pre-wrap">
                  {book.description}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Related Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                관련 모임
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedules && schedules.length > 0 ? (
                <ul className="space-y-3">
                  {schedules.map((schedule) => (
                    <li key={schedule.id}>
                      <Link
                        href={`/schedule/${schedule.id}`}
                        className="block p-3 border rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{schedule.title}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(schedule.meeting_date)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-center py-4">관련 모임이 없습니다</p>
              )}
            </CardContent>
          </Card>

          {/* Discussions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                발제
              </CardTitle>
              <Link href={`/discussions/new?book_id=${book.id}`}>
                <Button variant="outline" size="sm">발제 작성</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {discussions && discussions.length > 0 ? (
                <ul className="space-y-3">
                  {discussions.map((discussion) => (
                    <li key={discussion.id}>
                      <Link
                        href={`/discussions/${discussion.id}`}
                        className="block p-3 border rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{discussion.title}</p>
                        <p className="text-sm text-gray-600">
                          {discussion.profile?.name} · {formatDate(discussion.created_at, { month: 'short', day: 'numeric' })}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-center py-4">발제가 없습니다</p>
              )}
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <PenTool className="w-5 h-5" />
                독후감
              </CardTitle>
              <Link href={`/reviews/new?book_id=${book.id}`}>
                <Button variant="outline" size="sm">독후감 작성</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {reviews && reviews.length > 0 ? (
                <ul className="space-y-3">
                  {reviews.map((review) => (
                    <li key={review.id}>
                      <Link
                        href={`/reviews/${review.id}`}
                        className="block p-3 border rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">{review.title}</p>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <span
                                key={i}
                                className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          {review.profile?.name} · {formatDate(review.created_at, { month: 'short', day: 'numeric' })}
                        </p>
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
      </div>
    </div>
  );
}
