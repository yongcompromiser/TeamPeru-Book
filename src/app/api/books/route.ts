import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: books } = await supabase
      .from('books')
      .select('*, created_by_profile:profiles!books_created_by_fkey(name)')
      .order('created_at', { ascending: false });

    return NextResponse.json({ books: books || [] });
  } catch (error) {
    console.error('Books API error:', error);
    return NextResponse.json({ books: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, author, cover_url, description, isbn, category, selection_reason } = body;

    if (!title || !author) {
      return NextResponse.json({ error: '제목과 저자는 필수입니다' }, { status: 400 });
    }

    const { data: book, error } = await supabase
      .from('books')
      .insert({
        title,
        author,
        cover_url: cover_url || null,
        description: description || null,
        isbn: isbn || null,
        category: category || null,
        selection_reason: selection_reason || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Book insert error:', error);
      return NextResponse.json({ error: '책 등록에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({ book });
  } catch (error) {
    console.error('Books POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
