import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: posts } = await supabase
      .from('board_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!posts || posts.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // 프로필 정보 별도 조회
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

    const postsWithProfile = posts.map(p => ({
      ...p,
      profile: { name: profileMap.get(p.user_id) || '알 수 없음' }
    }));

    return NextResponse.json({ posts: postsWithProfile });
  } catch (error) {
    console.error('Board GET error:', error);
    return NextResponse.json({ posts: [] });
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
    const { title, content } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 });
    }

    // Admin client로 RLS 우회
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
