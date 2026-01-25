'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { ArrowLeft, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Book } from '@/types';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const reviewSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  book_id: z.string().min(1, '책을 선택해주세요'),
  content: z.string().min(10, '내용을 10자 이상 입력해주세요'),
  rating: z.number().min(1, '별점을 선택해주세요').max(5),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

export default function NewReviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-gray-500">로딩 중...</p></div>}>
      <NewReviewForm />
    </Suspense>
  );
}

function NewReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultBookId = searchParams.get('book_id') || '';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      book_id: defaultBookId,
      rating: 0,
    },
  });

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    setValue('content', content);
  }, [content, setValue]);

  useEffect(() => {
    setValue('rating', rating);
  }, [rating, setValue]);

  const fetchBooks = async () => {
    const { data } = await supabase
      .from('books')
      .select('*')
      .order('title', { ascending: true });
    setBooks((data as Book[]) || []);
  };

  const onSubmit = async (data: ReviewFormData) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const { data: review, error: insertError } = await supabase
      .from('reviews')
      .insert({
        title: data.title,
        book_id: data.book_id,
        content: data.content,
        rating: data.rating,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError('독후감 등록에 실패했습니다');
      setIsLoading(false);
      return;
    }

    router.push(`/reviews/${review.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/reviews"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        독후감 목록으로
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>독후감 작성</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="w-full">
              <label
                htmlFor="book_id"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                책 선택
              </label>
              <select
                id="book_id"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('book_id')}
              >
                <option value="">책을 선택하세요</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} - {book.author}
                  </option>
                ))}
              </select>
              {errors.book_id && (
                <p className="mt-1 text-sm text-red-600">{errors.book_id.message}</p>
              )}
            </div>

            <Input
              id="title"
              label="제목"
              placeholder="독후감 제목을 입력하세요"
              error={errors.title?.message}
              {...register('title')}
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                별점
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1"
                  >
                    <Star
                      className={cn(
                        'w-8 h-8 transition-colors',
                        (hoverRating || rating) >= star
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      )}
                    />
                  </button>
                ))}
                <span className="ml-2 text-gray-600">
                  {rating > 0 ? `${rating}점` : '별점을 선택하세요'}
                </span>
              </div>
              {errors.rating && (
                <p className="mt-1 text-sm text-red-600">{errors.rating.message}</p>
              )}
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내용
              </label>
              <div data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={(val) => setContent(val || '')}
                  height={400}
                  preview="edit"
                />
              </div>
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" isLoading={isLoading}>
                등록
              </Button>
              <Link href="/reviews">
                <Button type="button" variant="outline">
                  취소
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
