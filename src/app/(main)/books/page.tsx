'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, BookOpen, Settings } from 'lucide-react';
import { BookStatus, BOOK_STATUS_LABELS, BOOK_STATUS_COLORS } from '@/types';
import { cn } from '@/lib/utils';

interface Book {
  id: string;
  title: string;
  author: string;
  cover_url?: string;
  status: BookStatus;
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
      .select('id, title, author, cover_url, status')
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

  const filteredBooks = filter === 'all'
    ? books
    : books.filter(book => book.status === filter);

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: books.length };
    books.forEach(book => {
      counts[book.status] = (counts[book.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

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

                    {/* 상태 배지 */}
                    <div className="mb-2">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        BOOK_STATUS_COLORS[book.status]?.bg || 'bg-gray-100',
                        BOOK_STATUS_COLORS[book.status]?.text || 'text-gray-700'
                      )}>
                        {BOOK_STATUS_LABELS[book.status] || book.status}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 truncate">{book.title}</h3>
                    <p className="text-sm text-gray-600 truncate">{book.author}</p>
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
