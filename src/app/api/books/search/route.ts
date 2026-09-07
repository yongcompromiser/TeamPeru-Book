import { NextRequest, NextResponse } from 'next/server';
import { searchBooks } from '@/lib/book-search';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const { items, error } = await searchBooks(query, 5);

  if (items.length === 0 && error) {
    console.error('Book search 실패:', error);
    return NextResponse.json({ items: [], error }, { status: 502 });
  }

  return NextResponse.json({ items });
}
