import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// 댓글 수정/삭제 — 작성자 또는 관리자

async function authorize(commentId: string, userId: string) {
  const admin = createAdminClient();
  const [{ data: comment }, { data: profile }] = await Promise.all([
    admin.from('board_comments').select('user_id').eq('id', commentId).single(),
    admin.from('profiles').select('role').eq('id', userId).single(),
  ]);
  const isAdmin = profile?.role === 'admin';
  const isAuthor = comment?.user_id === userId;
  return { admin, comment, ok: !!comment && (isAdmin || isAuthor) };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content } = await request.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
    }

    const { admin, comment, ok } = await authorize(commentId, user.id);
    if (!comment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!ok) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const { error } = await admin
      .from('board_comments')
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq('id', commentId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Comment PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { admin, comment, ok } = await authorize(commentId, user.id);
    if (!comment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!ok) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const { error } = await admin.from('board_comments').delete().eq('id', commentId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Comment DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
