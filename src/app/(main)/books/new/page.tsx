'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookSearch } from '@/components/features/book-search';
import { ArrowLeft } from 'lucide-react';

const bookSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  author: z.string().min(1, '저자를 입력해주세요'),
  cover_url: z.string().url('유효한 URL을 입력해주세요').optional().or(z.literal('')),
  description: z.string().optional(),
  isbn: z.string().optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

export default function NewBookPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
  });

  const handleBookSelect = (book: {
    title: string;
    author: string;
    description?: string;
    coverUrl?: string;
    isbn?: string;
  }) => {
    setValue('title', book.title);
    setValue('author', book.author);
    if (book.description) setValue('description', book.description);
    if (book.coverUrl) {
      setValue('cover_url', book.coverUrl);
      setCoverPreview(book.coverUrl);
    }
    if (book.isbn) setValue('isbn', book.isbn);
  };

  const onSubmit = async (data: BookFormData) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const { data: book, error: insertError } = await supabase
      .from('books')
      .insert({
        title: data.title,
        author: data.author,
        cover_url: data.cover_url || null,
        description: data.description || null,
        isbn: data.isbn || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError('책 등록에 실패했습니다');
      setIsLoading(false);
      return;
    }

    router.push(`/books/${book.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/books"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        책 목록으로
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>새 책 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                책 검색
              </label>
              <BookSearch onSelect={handleBookSelect} />
              <p className="text-xs text-gray-500 mt-1">
                검색해서 선택하면 자동으로 입력됩니다
              </p>
            </div>

            <div className="border-t pt-4 mt-4">
              {coverPreview && (
                <div className="mb-4">
                  <img
                    src={coverPreview}
                    alt="책 표지 미리보기"
                    className="w-24 h-32 object-cover rounded-lg border"
                  />
                </div>
              )}

              <Input
                id="title"
                label="제목"
                placeholder="책 제목을 입력하세요"
                error={errors.title?.message}
                {...register('title')}
              />

              <div className="mt-4">
                <Input
                  id="author"
                  label="저자"
                  placeholder="저자 이름을 입력하세요"
                  error={errors.author?.message}
                  {...register('author')}
                />
              </div>

              <div className="mt-4">
                <Input
                  id="cover_url"
                  label="표지 이미지 URL"
                  placeholder="https://example.com/cover.jpg"
                  error={errors.cover_url?.message}
                  {...register('cover_url')}
                  onChange={(e) => {
                    register('cover_url').onChange(e);
                    setCoverPreview(e.target.value || null);
                  }}
                />
              </div>

              <div className="mt-4">
                <Input
                  id="isbn"
                  label="ISBN (선택)"
                  placeholder="ISBN 번호"
                  error={errors.isbn?.message}
                  {...register('isbn')}
                />
              </div>

              <div className="mt-4">
                <Textarea
                  id="description"
                  label="책 소개 (선택)"
                  placeholder="책에 대한 간단한 소개를 작성하세요"
                  rows={4}
                  error={errors.description?.message}
                  {...register('description')}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" isLoading={isLoading}>
                등록
              </Button>
              <Link href="/books">
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
