import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: comments } = await supabase
      .from('meeting_comments')
      .select('*')
      .eq('schedule_id', id)
      .order('created_at', { ascending: true });

    if (!comments || comments.length === 0) {
      return NextResponse.json({ comments: [] });
    }

    // 프로필 정보 별도 조회
    const userIds = [...new Set(comments.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const commentsWithProfile = comments.map(c => ({
      ...c,
      profile: { name: profileMap.get(c.user_id)?.name || '알 수 없음', avatar_url: profileMap.get(c.user_id)?.avatar_url || null }
    }));

    return NextResponse.json({ comments: commentsWithProfile });
  } catch (error) {
    console.error('Meeting comments GET error:', error);
    return NextResponse.json({ comments: [] });
  }
}

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
      .from('meeting_comments')
      .insert({
        schedule_id: id,
        user_id: user.id,
        content: content.trim(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 프로필 정보 별도 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      comment: {
        ...data,
        profile: { name: profile?.name || '알 수 없음', avatar_url: profile?.avatar_url || null }
      }
    });
  } catch (error) {
    console.error('Meeting comments POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId, content } = await request.json();

    // 본인 댓글인지 확인
    const { data: comment } = await adminClient
      .from('meeting_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!comment || comment.user_id !== user.id) {
      return NextResponse.json({ error: '본인 댓글만 수정할 수 있습니다' }, { status: 403 });
    }

    const { error } = await adminClient
      .from('meeting_comments')
      .update({ content })
      .eq('id', commentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Meeting comments PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = await request.json();

    // 본인 댓글인지 확인
    const { data: comment } = await adminClient
      .from('meeting_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!comment || comment.user_id !== user.id) {
      return NextResponse.json({ error: '본인 댓글만 삭제할 수 있습니다' }, { status: 403 });
    }

    const { error } = await adminClient
      .from('meeting_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Meeting comments DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
