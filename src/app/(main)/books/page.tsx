import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, BookOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BooksPage() {
  const supabase = await createClient();

  const { data: books } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });

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

      {books && books.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map((book) => (
            <Link key={book.id} href={`/books/${book.id}`}>
              <Card className="h-full hover:border-blue-300 transition-colors">
                <CardContent className="pt-6">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 truncate">{book.title}</h3>
                  <p className="text-sm text-gray-600 truncate">{book.author}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">등록된 책이 없습니다</p>
            <Link href="/books/new">
              <Button>첫 번째 책 추가하기</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
