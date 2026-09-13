import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// 좋아요 토글 — 로그인 필요
export async function POST(
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

    // 이미 눌렀는지 확인
    const { data: existing } = await admin
      .from('board_post_likes')
      .select('user_id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await admin.from('board_post_likes').delete().eq('post_id', id).eq('user_id', user.id);
    } else {
      const { error } = await admin
        .from('board_post_likes')
        .insert({ post_id: id, user_id: user.id });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    const { count } = await admin
      .from('board_post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', id);

    return NextResponse.json({ liked: !existing, count: count ?? 0 });
  } catch (error) {
    console.error('Board like error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
