'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Book, Schedule } from '@/types';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const discussionSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  book_id: z.string().optional(),
  schedule_id: z.string().optional(),
  content: z.string().min(10, '내용을 10자 이상 입력해주세요'),
});

type DiscussionFormData = z.infer<typeof discussionSchema>;

export default function NewDiscussionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-gray-500">로딩 중...</p></div>}>
      <NewDiscussionForm />
    </Suspense>
  );
}

function NewDiscussionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultBookId = searchParams.get('book_id') || '';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DiscussionFormData>({
    resolver: zodResolver(discussionSchema),
    defaultValues: {
      book_id: defaultBookId,
    },
  });

  const selectedBookId = watch('book_id');

  useEffect(() => {
    fetchBooks();
    fetchSchedules();
  }, []);

  useEffect(() => {
    setValue('content', content);
  }, [content, setValue]);

  const fetchBooks = async () => {
    const { data } = await supabase
      .from('books')
      .select('*')
      .order('title', { ascending: true });
    setBooks((data as Book[]) || []);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*, book:books(*)')
      .gte('meeting_date', new Date().toISOString())
      .order('meeting_date', { ascending: true });
    setSchedules((data as Schedule[]) || []);
  };

  const onSubmit = async (data: DiscussionFormData) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const { data: discussion, error: insertError } = await supabase
      .from('discussions')
      .insert({
        title: data.title,
        book_id: data.book_id || null,
        schedule_id: data.schedule_id || null,
        content: data.content,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError('발제 등록에 실패했습니다');
      setIsLoading(false);
      return;
    }

    router.push(`/discussions/${discussion.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/discussions"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        발제 목록으로
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>새 발제 작성</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <Input
              id="title"
              label="제목"
              placeholder="발제 제목을 입력하세요"
              error={errors.title?.message}
              {...register('title')}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="w-full">
                <label
                  htmlFor="book_id"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  도서 선택 (선택)
                </label>
                <select
                  id="book_id"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  {...register('book_id')}
                >
                  <option value="">선택 안함</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full">
                <label
                  htmlFor="schedule_id"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  관련 모임 (선택)
                </label>
                <select
                  id="schedule_id"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  {...register('schedule_id')}
                >
                  <option value="">선택 안함</option>
                  {schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.title}
                    </option>
                  ))}
                </select>
              </div>
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
              <Link href="/discussions">
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
