import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(
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

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
    }

    // Admin client로 RLS 우회
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('board_comments')
      .insert({
        post_id: id,
        user_id: user.id,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 프로필 정보 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      comment: {
        ...data,
        profile: { name: profile?.name || '알 수 없음' }
      }
    });
  } catch (error) {
    console.error('Board comment POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
