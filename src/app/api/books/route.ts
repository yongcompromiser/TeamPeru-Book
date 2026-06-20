import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: books } = await supabase
      .from('books')
      .select('*, created_by_profile:profiles!books_created_by_fkey(name, avatar_url)')
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

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, selection_reason, cover_url, isbn } = await request.json();

    const updateData: any = {};
    if (selection_reason !== undefined) updateData.selection_reason = selection_reason;
    if (cover_url !== undefined) updateData.cover_url = cover_url;
    if (isbn !== undefined) updateData.isbn = isbn;

    const { error } = await adminClient
      .from('books')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Books PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    // 책 정보 조회
    const { data: book } = await adminClient
      .from('books')
      .select('created_by')
      .eq('id', id)
      .single();

    if (!book) {
      return NextResponse.json({ error: '책을 찾을 수 없습니다' }, { status: 404 });
    }

    // 권한 확인: 등록자 또는 관리자
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (book.created_by !== user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });
    }

    const { error } = await adminClient
      .from('books')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Books DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
