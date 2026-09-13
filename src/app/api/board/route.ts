import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 읽기도 adminClient(service role)로. board_posts 는 RLS 상태가 불확실해
    // 일반 클라이언트로 읽으면 정책에 따라 빈 결과가 날 수 있다.
    const admin = createAdminClient();

    const { data: posts } = await admin
      .from('board_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!posts || posts.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // 작성자 프로필 + 댓글 수 함께 조회
    const userIds = [...new Set(posts.map((p) => p.user_id).filter(Boolean))];
    const postIds = posts.map((p) => p.id);
    const [{ data: profiles }, { data: commentRows }] = await Promise.all([
      admin.from('profiles').select('id, name, avatar_url').in('id', userIds),
      admin.from('board_comments').select('post_id').in('post_id', postIds),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const commentCount = new Map<string, number>();
    for (const c of commentRows || []) {
      commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1);
    }

    // 고정글 우선, 그다음 최신순 (컬럼이 아직 없어도 안전하게 폴백)
    const withMeta = posts
      .map((p) => ({
        ...p,
        is_pinned: p.is_pinned ?? false,
        view_count: p.view_count ?? 0,
        comment_count: commentCount.get(p.id) ?? 0,
        profile: {
          name: profileMap.get(p.user_id)?.name || '알 수 없음',
          avatar_url: profileMap.get(p.user_id)?.avatar_url || null,
        },
      }))
      .sort((a, b) => {
        if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    return NextResponse.json({ posts: withMeta });
  } catch (error) {
    console.error('Board GET error:', error);
    return NextResponse.json({ posts: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('board_posts')
      .insert({
        user_id: user.id,
        title: title.trim(),
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Board POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
