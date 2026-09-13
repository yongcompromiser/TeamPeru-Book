import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { isValidCategory } from '@/lib/board';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // board_posts 는 profiles 와 FK 가 없어 PostgREST 임베드 조인이 안 된다.
    // 프로필은 따로 조회해 붙인다(목록 API 와 동일한 방식).
    const { data: post } = await admin
      .from('board_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 좋아요 수 / 내가 눌렀는지 (테이블 없으면 무시)
    let likeCount = 0;
    let liked = false;
    try {
      const { data: likes } = await admin
        .from('board_post_likes')
        .select('user_id')
        .eq('post_id', id);
      likeCount = (likes || []).length;
      liked = !!user && (likes || []).some((l) => l.user_id === user.id);
    } catch {
      /* board_post_likes 미존재 시 무시 */
    }

    const { data: comments } = await admin
      .from('board_comments')
      .select('*')
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    // 작성자 + 댓글 작성자 프로필 일괄 조회
    const ids = [...new Set([post.user_id, ...(comments || []).map((c) => c.user_id)].filter(Boolean))];
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id, name, avatar_url').in('id', ids)
      : { data: [] as { id: string; name: string; avatar_url: string | null }[] };
    const pmap = new Map((profiles || []).map((p) => [p.id, p]));
    const attach = (uid: string) => ({
      name: pmap.get(uid)?.name || '알 수 없음',
      avatar_url: pmap.get(uid)?.avatar_url || null,
    });

    const postWithProfile = { ...post, profile: attach(post.user_id), like_count: likeCount, liked };
    const commentsWithProfile = (comments || []).map((c) => ({ ...c, profile: attach(c.user_id) }));

    return NextResponse.json({ post: postWithProfile, comments: commentsWithProfile });
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

    // 카테고리 — '공지'는 관리자만
    let category = body.category;
    if (!category || !isValidCategory(category)) category = undefined;
    if (category === '공지' && !isAdmin) category = undefined;

    const patch: Record<string, unknown> = {
      title: title.trim(),
      content: content.trim(),
      updated_at: new Date().toISOString(),
    };
    if (category) patch.category = category;

    let { error } = await admin.from('board_posts').update(patch).eq('id', id);
    // category 컬럼이 아직 없으면 category 빼고 재시도
    if (error && category) {
      delete patch.category;
      ({ error } = await admin.from('board_posts').update(patch).eq('id', id));
    }
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
