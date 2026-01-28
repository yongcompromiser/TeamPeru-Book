import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: post } = await supabase
      .from('board_posts')
      .select('*, profile:profiles(name)')
      .eq('id', id)
      .single();

    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: comments } = await supabase
      .from('board_comments')
      .select('*, profile:profiles(name)')
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ post, comments: comments || [] });
  } catch (error) {
    console.error('Board detail GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 작성자 확인
    const { data: post } = await supabase
      .from('board_posts')
      .select('user_id')
      .eq('id', id)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (post?.user_id !== user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const { error } = await supabase
      .from('board_posts')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Board DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
