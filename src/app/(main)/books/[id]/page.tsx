import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, Tag, User } from 'lucide-react';
import { BOOK_STATUS_LABELS } from '@/types';

export const dynamic = 'force-dynamic';

interface BookPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookDetailPage({ params }: BookPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: book } = await supabase
    .from('books')
    .select('*, created_by_profile:profiles!books_created_by_fkey(name)')
    .eq('id', id)
    .single();

  if (!book) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/books"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        책 목록으로
      </Link>

      {/* Book Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-6">
            {/* Cover */}
            <div className="flex-shrink-0">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-36 h-52 object-cover rounded-lg shadow-md"
                />
              ) : (
                <div className="w-36 h-52 bg-gray-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
                <Badge variant={book.status === 'completed' ? 'success' : book.status === 'selected' ? 'info' : 'default'}>
                  {BOOK_STATUS_LABELS[book.status as keyof typeof BOOK_STATUS_LABELS] || book.status}
                </Badge>
              </div>

              <p className="text-lg text-gray-600 mt-1">{book.author}</p>

              {book.category && (
                <div className="flex items-center gap-1 mt-3 text-sm text-gray-600">
                  <Tag className="w-4 h-4" />
                  <span>{book.category}</span>
                </div>
              )}

              {book.created_by_profile && (
                <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                  <User className="w-4 h-4" />
                  <span>등록: {book.created_by_profile.name}</span>
                </div>
              )}

              {book.isbn && (
                <p className="text-sm text-gray-500 mt-2">ISBN: {book.isbn}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Reason */}
      {book.selection_reason && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-blue-500">💡</span>
              선정 사유
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {book.selection_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Book Description */}
      {book.description && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              책 소개
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {book.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
