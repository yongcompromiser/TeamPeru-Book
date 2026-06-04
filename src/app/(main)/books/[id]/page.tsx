'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Tag, User, Pencil, Check, X, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { BOOK_STATUS_LABELS } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BookDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { user, profile } = useAuth();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingReason, setIsEditingReason] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBook();
  }, [id]);

  const fetchBook = async () => {
    try {
      const res = await fetch(`/api/books?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.books) {
          const found = data.books.find((b: any) => b.id === id);
          if (found) {
            setBook(found);
            setReasonInput(found.selection_reason || '');
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch book:', e);
    }
    setIsLoading(false);
  };

  const handleSaveReason = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/books', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, selection_reason: reasonInput || null }),
      });
      if (res.ok) {
        setBook({ ...book, selection_reason: reasonInput || null });
        setIsEditingReason(false);
      }
    } catch (e) {
      console.error('Failed to save:', e);
    }
    setIsSaving(false);
  };

  const canDelete = book && (book.created_by === user?.id || profile?.role === 'admin');

  const handleDelete = async () => {
    if (!confirm('이 책을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/books', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        router.push('/books');
      } else {
        const data = await res.json();
        alert(data.error || '삭제에 실패했습니다');
      }
    } catch {
      alert('삭제에 실패했습니다');
    }
    setIsDeleting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">책을 찾을 수 없습니다</p>
        <Link href="/books" className="text-blue-600 hover:underline mt-2 inline-block">
          책 목록으로
        </Link>
      </div>
    );
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

              {book.created_at && (
                <p className="text-sm text-gray-500 mt-2">
                  등록일: {new Date(book.created_at).toLocaleDateString('ko-KR')}
                </p>
              )}

              {book.isbn && (
                <p className="text-sm text-gray-500 mt-1">ISBN: {book.isbn}</p>
              )}

              {canDelete && (
                <div className="mt-4">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    책 삭제
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Reason */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-blue-500">💡</span>
              선정 사유
            </h2>
            {user && !isEditingReason && (
              <button
                onClick={() => setIsEditingReason(true)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <Pencil className="w-4 h-4" />
                {book.selection_reason ? '수정' : '작성'}
              </button>
            )}
          </div>

          {isEditingReason ? (
            <div className="space-y-3">
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="이 책을 선정한 이유를 작성하세요..."
                className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-24"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveReason} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                  저장
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsEditingReason(false); setReasonInput(book.selection_reason || ''); }}>
                  <X className="w-4 h-4 mr-1" />
                  취소
                </Button>
              </div>
            </div>
          ) : book.selection_reason ? (
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {book.selection_reason}
            </p>
          ) : (
            <p className="text-gray-400 text-sm">아직 선정 사유가 작성되지 않았습니다.</p>
          )}
        </CardContent>
      </Card>

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
