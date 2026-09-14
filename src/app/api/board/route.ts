import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { DEFAULT_CATEGORY, isValidCategory } from '@/lib/board';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(60, Math.max(1, Number(searchParams.get('limit')) || 24));
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

    const admin = createAdminClient();

    // 목록엔 제목/작성자/집계만 필요. content 는 카드에서 몇 줄만 쓰므로
    // 앞부분만 잘라 받아 전송량을 줄인다(성능).
    const { data: allPosts } = await admin
      .from('board_posts')
      .select('id, user_id, title, content, created_at, category, is_pinned');
    if (!allPosts || allPosts.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false });
    }

    // 카테고리/검색 필터 (컬럼이 없어도 안전하게 JS 에서 처리)
    let filtered = allPosts;
    if (category && category !== '전체') {
      filtered = filtered.filter((p) => (p.category ?? DEFAULT_CATEGORY) === category);
    }
    if (q) {
      filtered = filtered.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.content || '').toLowerCase().includes(q)
      );
    }

    // 고정 우선, 그다음 최신순
    filtered.sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);
    const pageIds = page.map((p) => p.id);
    const userIds = [...new Set(page.map((p) => p.user_id).filter(Boolean))];

    // 프로필 / 댓글수 / 좋아요수 — 세 쿼리를 한 번에 병렬로 (왕복 최소화)
    // 목록에선 "내가 눌렀는지"는 필요없어 getUser 는 생략(왕복 1회 절약, 상세에서만 판정).
    const [{ data: profiles }, { data: commentRows }, likesRes] = await Promise.all([
      admin.from('profiles').select('id, name, avatar_url').in('id', userIds),
      admin.from('board_comments').select('post_id').in('post_id', pageIds),
      admin.from('board_post_likes').select('post_id').in('post_id', pageIds),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const commentCount = new Map<string, number>();
    for (const c of commentRows || []) {
      commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1);
    }
    const likeCount = new Map<string, number>();
    for (const l of likesRes?.data || []) {
      likeCount.set(l.post_id, (likeCount.get(l.post_id) || 0) + 1);
    }

    const posts = page.map((p) => ({
      ...p,
      category: p.category ?? DEFAULT_CATEGORY,
      is_pinned: p.is_pinned ?? false,
      comment_count: commentCount.get(p.id) ?? 0,
      like_count: likeCount.get(p.id) ?? 0,
      profile: {
        name: profileMap.get(p.user_id)?.name || '알 수 없음',
        avatar_url: profileMap.get(p.user_id)?.avatar_url || null,
      },
    }));

    return NextResponse.json({ posts, hasMore: offset + limit < total, total });
  } catch (error) {
    console.error('Board GET error:', error);
    return NextResponse.json({ posts: [], hasMore: false });
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
    let category = body.category;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 카테고리 검증 — '공지'는 관리자만
    if (!category || !isValidCategory(category)) category = DEFAULT_CATEGORY;
    if (category === '공지') {
      const { data: me } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (me?.role !== 'admin') category = DEFAULT_CATEGORY;
    }

    const base = { user_id: user.id, title: title.trim(), content: content.trim() };
    let { data, error } = await adminClient
      .from('board_posts')
      .insert({ ...base, category })
      .select()
      .single();

    // category 컬럼이 아직 없으면(마이그레이션 전) category 없이 재시도
    if (error) {
      const retry = await adminClient.from('board_posts').insert(base).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Board POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
