import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { Plus, PenTool } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, profile:profiles(*), book:books(*)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">독후감</h1>
        <Link href="/reviews/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            독후감 작성
          </Button>
        </Link>
      </div>

      {reviews && reviews.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <Link key={review.id} href={`/reviews/${review.id}`}>
              <Card className="h-full hover:border-blue-300 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar
                      src={review.profile?.avatar_url}
                      name={review.profile?.name || ''}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {review.profile?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(review.created_at, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1 truncate">
                    {review.title}
                  </h3>

                  {review.book && (
                    <p className="text-sm text-gray-600 mb-2 truncate">
                      {review.book.title}
                    </p>
                  )}

                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-lg ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-3">
                    {review.content.replace(/[#*`]/g, '').slice(0, 150)}...
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <PenTool className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">아직 독후감이 없습니다</p>
            <Link href="/reviews/new">
              <Button>첫 번째 독후감 작성하기</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
