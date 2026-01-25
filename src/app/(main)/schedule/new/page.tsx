'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Book } from '@/types';

const scheduleSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  book_id: z.string().optional(),
  meeting_date: z.string().min(1, '모임 일시를 선택해주세요'),
  location: z.string().optional(),
  description: z.string().optional(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

export default function NewSchedulePage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
  });

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    const { data } = await supabase
      .from('books')
      .select('*')
      .order('title', { ascending: true });
    setBooks((data as Book[]) || []);
  };

  const onSubmit = async (data: ScheduleFormData) => {
    if (!user || !isAdmin) return;

    setIsLoading(true);
    setError(null);

    const { data: schedule, error: insertError } = await supabase
      .from('schedules')
      .insert({
        title: data.title,
        book_id: data.book_id || null,
        meeting_date: new Date(data.meeting_date).toISOString(),
        location: data.location || null,
        description: data.description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError('일정 등록에 실패했습니다');
      setIsLoading(false);
      return;
    }

    router.push(`/schedule/${schedule.id}`);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">관리자만 일정을 등록할 수 있습니다</p>
        <Link href="/schedule" className="text-blue-600 hover:underline mt-2 inline-block">
          일정 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/schedule"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        일정 목록으로
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>새 모임 일정</CardTitle>
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
              label="모임 제목"
              placeholder="예: 1월 정기 모임"
              error={errors.title?.message}
              {...register('title')}
            />

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
                    {book.title} - {book.author}
                  </option>
                ))}
              </select>
            </div>

            <Input
              id="meeting_date"
              type="datetime-local"
              label="모임 일시"
              error={errors.meeting_date?.message}
              {...register('meeting_date')}
            />

            <Input
              id="location"
              label="장소 (선택)"
              placeholder="예: 강남역 스타벅스"
              error={errors.location?.message}
              {...register('location')}
            />

            <Textarea
              id="description"
              label="설명 (선택)"
              placeholder="모임에 대한 추가 설명을 작성하세요"
              rows={4}
              error={errors.description?.message}
              {...register('description')}
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" isLoading={isLoading}>
                등록
              </Button>
              <Link href="/schedule">
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
