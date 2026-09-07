'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, BookOpen, Settings, Tag, Sparkles } from 'lucide-react';
import { BookStatus, BOOK_STATUS_LABELS, BOOK_STATUS_COLORS } from '@/types';
import { BOOK_CATEGORIES } from '@/lib/book-category';
import { cn } from '@/lib/utils';

interface Book {
  id: string;
  title: string;
  author: string;
  cover_url?: string;
  status: BookStatus;
  category?: string | null;
  created_at?: string;
}

const STATUS_FILTERS: { value: BookStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'waiting', label: '대기중' },
  { value: 'nominated', label: '후보 경험' },
  { value: 'selected', label: '선정됨' },
  { value: 'completed', label: '토론 완료' },
];

const ALL_STATUSES: BookStatus[] = ['waiting', 'nominated', 'selected', 'completed'];

export default function BooksPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<BookStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isClassifying, setIsClassifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    // API를 통해 먼저 시도
    try {
      const res = await fetch('/api/books');
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books || []);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.log('API fetch failed, trying direct');
    }

    // API 실패시 직접 호출
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url, status, category, created_at')
      .order('created_at', { ascending: false });

    setBooks(data || []);
    setIsLoading(false);
  };

  const handleStatusChange = async (bookId: string, newStatus: BookStatus) => {
    const { error } = await supabase
      .from('books')
      .update({ status: newStatus })
      .eq('id', bookId);

    if (!error) {
      setBooks(books.map(book =>
        book.id === bookId ? { ...book, status: newStatus } : book
      ));
    }
    setEditingBookId(null);
  };

  // 기존에 등록된 책들은 분야가 비어 있다. 제목/저자/설명으로 한 번에 채운다.
  // 무엇이 바뀔지 먼저 보여주고 확인을 받은 뒤에 저장한다.
  const handleAutoClassify = async () => {
    setIsClassifying(true);
    try {
      const previewRes = await fetch('/api/books/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const preview = await previewRes.json();

      if (!previewRes.ok) {
        alert(preview.error || '자동 분류에 실패했습니다.');
        return;
      }
      if (preview.planned.length === 0) {
        alert(
          `분야를 추측할 수 있는 책이 없습니다.\n미분류 ${preview.total}권은 정보가 부족해 직접 지정해주세요.`
        );
        return;
      }

      const sample = preview.planned
        .slice(0, 15)
        .map((p: { title: string; category: string }) => `· ${p.title} → ${p.category}`)
        .join('\n');
      const more =
        preview.planned.length > 15 ? `\n... 외 ${preview.planned.length - 15}권` : '';

      const ok = confirm(
        `미분류 ${preview.total}권 중 ${preview.planned.length}권의 분야를 아래와 같이 지정합니다.\n` +
          `(${preview.skipped.length}권은 근거가 부족해 그대로 둡니다)\n\n${sample}${more}\n\n` +
          `적용할까요? 틀린 항목은 나중에 책 상세에서 바꿀 수 있습니다.`
      );
      if (!ok) return;

      const res = await fetch('/api/books/classify', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || '자동 분류에 실패했습니다.');
        return;
      }

      alert(
        `${result.updated}권의 분야를 지정했습니다.\n` +
          `${result.skippedCount}권은 근거가 부족해 미분류로 남겨뒀습니다.`
      );
      await fetchBooks();
    } catch {
      alert('자동 분류에 실패했습니다.');
    } finally {
      setIsClassifying(false);
    }
  };

  const filteredBooks = books.filter((book) => {
    if (filter !== 'all' && book.status !== filter) return false;
    if (categoryFilter === 'all') return true;
    // '분야 없음'은 아직 분류하지 않은 책을 모아보기 위한 항목
    if (categoryFilter === 'none') return !book.category;
    return book.category === categoryFilter;
  });

  // 상태 카운트는 분야 필터를 적용한 뒤 세어야 탭 숫자와 목록이 어긋나지 않는다.
  const categoryScoped = books.filter((book) => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'none') return !book.category;
    return book.category === categoryFilter;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: categoryScoped.length };
    categoryScoped.forEach((book) => {
      counts[book.status] = (counts[book.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  // 분야 탭에 붙일 개수는 현재 상태 필터를 반영한다.
  const statusScoped = filter === 'all' ? books : books.filter((b) => b.status === filter);
  const categoryCounts = new Map<string, number>();
  for (const b of statusScoped) {
    const key = b.category || 'none';
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }
  // 실제로 책이 있는 분야만 탭으로 노출한다(빈 분야가 줄줄이 늘어서지 않게).
  const visibleCategories = BOOK_CATEGORIES.filter((c) => (categoryCounts.get(c) ?? 0) > 0);
  const uncategorizedCount = categoryCounts.get('none') ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">책 목록</h1>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-64 animate-pulse bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">책 목록</h1>
        <Link href="/books/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            책 추가
          </Button>
        </Link>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              filter === value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {label}
            <span className={cn(
              "ml-2 px-2 py-0.5 rounded-full text-xs",
              filter === value ? "bg-white/20" : "bg-gray-200"
            )}>
              {statusCounts[value] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* 분야 필터 */}
      {(visibleCategories.length > 0 || uncategorizedCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              categoryFilter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            전체 분야
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all',
                categoryFilter === cat
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {cat}
              <span className="ml-1.5 opacity-70">{categoryCounts.get(cat)}</span>
            </button>
          ))}
          {uncategorizedCount > 0 && (
            <button
              onClick={() => setCategoryFilter('none')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all',
                categoryFilter === 'none'
                  ? 'bg-gray-800 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              )}
            >
              분야 없음
              <span className="ml-1.5 opacity-70">{uncategorizedCount}</span>
            </button>
          )}

          {/* 예전에 등록돼 분야가 비어 있는 책들을 한 번에 채운다 */}
          {isAdmin && uncategorizedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={handleAutoClassify}
              isLoading={isClassifying}
              disabled={isClassifying}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              미분류 자동 분류
            </Button>
          )}
        </div>
      )}

      {filteredBooks.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map((book) => (
            <div key={book.id} className="relative">
              <Link href={`/books/${book.id}`}>
                <Card className="h-full hover:border-blue-300 transition-colors group">
                  <CardContent className="pt-6">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full h-48 object-cover rounded-lg mb-4 group-hover:shadow-md transition-shadow"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg mb-4 flex items-center justify-center group-hover:shadow-md transition-shadow">
                        <BookOpen className="w-12 h-12 text-white" />
                      </div>
                    )}

                    {/* 상태 · 분야 배지 */}
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        BOOK_STATUS_COLORS[book.status]?.bg || 'bg-gray-100',
                        BOOK_STATUS_COLORS[book.status]?.text || 'text-gray-700'
                      )}>
                        {BOOK_STATUS_LABELS[book.status] || book.status}
                      </span>
                      {book.category && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                          <Tag className="w-3 h-3" />
                          {book.category}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 truncate">{book.title}</h3>
                    <p className="text-sm text-gray-600 truncate">{book.author}</p>
                    {book.created_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(book.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>

              {/* 관리자용 상태 변경 버튼 */}
              {isAdmin && (
                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingBookId(editingBookId === book.id ? null : book.id);
                    }}
                    className="p-1.5 bg-white/90 rounded-full shadow hover:bg-white transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-600" />
                  </button>

                  {/* 상태 변경 드롭다운 */}
                  {editingBookId === book.id && (
                    <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg border p-2 z-10 min-w-32">
                      <p className="text-xs text-gray-500 px-2 pb-1 border-b mb-1">상태 변경</p>
                      {ALL_STATUSES.map((status) => (
                        <button
                          key={status}
                          onClick={(e) => {
                            e.preventDefault();
                            handleStatusChange(book.id, status);
                          }}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-100 flex items-center gap-2",
                            book.status === status && "bg-blue-50 text-blue-600"
                          )}
                        >
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            BOOK_STATUS_COLORS[status]?.bg
                          )} />
                          {BOOK_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {filter === 'all' ? '등록된 책이 없습니다' : `'${BOOK_STATUS_LABELS[filter as BookStatus]}' 상태의 책이 없습니다`}
            </p>
            {filter === 'all' && (
              <Link href="/books/new">
                <Button>첫 번째 책 추가하기</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
