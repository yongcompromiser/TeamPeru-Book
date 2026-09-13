import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: post } = await admin
      .from('board_posts')
      .select('*, profile:profiles(name, avatar_url)')
      .eq('id', id)
      .single();

    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 조회수 +1 (컬럼이 아직 없으면 조용히 무시)
    try {
      await admin
        .from('board_posts')
        .update({ view_count: (post.view_count ?? 0) + 1 })
        .eq('id', id);
    } catch {
      /* view_count 컬럼 미존재 시 무시 */
    }

    const { data: comments } = await admin
      .from('board_comments')
      .select('*, profile:profiles(name, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ post, comments: comments || [] });
  } catch (error) {
    console.error('Board detail GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// 글 수정(작성자/관리자) + 공지 고정 토글(관리자)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const [{ data: post }, { data: profile }] = await Promise.all([
      admin.from('board_posts').select('user_id').eq('id', id).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
    ]);
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const isAdmin = profile?.role === 'admin';
    const isAuthor = post.user_id === user.id;

    const body = await request.json();

    // 공지 고정 토글 — 관리자 전용
    if (body.action === 'toggle_pin') {
      if (!isAdmin) {
        return NextResponse.json({ error: '관리자만 고정할 수 있습니다' }, { status: 403 });
      }
      const { error } = await admin
        .from('board_posts')
        .update({ is_pinned: !!body.is_pinned })
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // 글 수정 — 작성자 또는 관리자
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }
    const { title, content } = body;
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 });
    }
    const { error } = await admin
      .from('board_posts')
      .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Board PATCH error:', error);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const [{ data: post }, { data: profile }] = await Promise.all([
      admin.from('board_posts').select('user_id').eq('id', id).single(),
      admin.from('profiles').select('role').eq('id', user.id).single(),
    ]);

    if (post?.user_id !== user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const { error } = await admin.from('board_posts').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Board DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
