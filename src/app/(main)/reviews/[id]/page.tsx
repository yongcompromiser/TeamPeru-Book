import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { CommentSection } from '@/components/features/comment-section';

export const dynamic = 'force-dynamic';

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewDetailPage({ params }: ReviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: review } = await supabase
    .from('reviews')
    .select('*, profile:profiles(*), book:books(*)')
    .eq('id', id)
    .single();

  if (!review) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/reviews"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        독후감 목록으로
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <Avatar
              src={review.profile?.avatar_url}
              name={review.profile?.name || ''}
              size="md"
            />
            <div>
              <p className="font-medium text-gray-900">{review.profile?.name}</p>
              <p className="text-sm text-gray-500">
                {formatDate(review.created_at)}
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{review.title}</h1>

          {review.book && (
            <Link
              href={`/books/${review.book.id}`}
              className="inline-flex items-center gap-2 mt-3 text-sm text-blue-600 hover:underline"
            >
              <BookOpen className="w-4 h-4" />
              {review.book.title} - {review.book.author}
            </Link>
          )}

          <div className="flex items-center gap-1 mt-3">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`text-2xl ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </span>
            ))}
            <span className="ml-2 text-gray-600">{review.rating}/5</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{review.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      <CommentSection commentableType="review" commentableId={id} />
    </div>
  );
}
