import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { suggestCategory } from '@/lib/book-category';

// 아직 분야가 없는 책들을 제목/저자/설명으로 일괄 자동 분류한다 (관리자 전용).
//
// 이미 분야가 있는 책은 절대 건드리지 않는다. 사람이 정해둔 값을 추측으로
// 덮어쓰지 않기 위함이다.
// dryRun: true 면 무엇이 바뀔지만 계산하고 저장하지 않는다.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 실행할 수 있습니다.' }, { status: 403 });
    }

    let dryRun = false;
    try {
      const body = await request.json();
      dryRun = body?.dryRun === true;
    } catch {
      // 본문이 없으면 실제 실행
    }

    const { data: books, error } = await adminClient
      .from('books')
      .select('id, title, author, description, category');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 분야가 비어 있는 책만 대상. null 과 빈 문자열을 함께 걸러야 해서
    // PostgREST 필터 대신 여기서 판정한다(책 수가 많지 않다).
    const targets = (books ?? []).filter((b) => {
      const c = b.category as string | null;
      return !c || c.trim().length === 0;
    });
    const planned: { id: string; title: string; category: string }[] = [];
    const skipped: { title: string }[] = [];

    for (const b of targets) {
      const suggestion = suggestCategory({
        title: b.title as string,
        author: b.author as string,
        description: b.description as string | null,
      });
      if (suggestion) {
        planned.push({ id: b.id as string, title: b.title as string, category: suggestion });
      } else {
        skipped.push({ title: b.title as string });
      }
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        total: targets.length,
        planned,
        skipped,
      });
    }

    let updated = 0;
    const failed: string[] = [];
    for (const p of planned) {
      const { error: updErr } = await adminClient
        .from('books')
        .update({ category: p.category })
        .eq('id', p.id);

      if (updErr) {
        console.error('classify update 실패:', p.id, updErr.message);
        failed.push(p.title);
      } else {
        updated += 1;
      }
    }

    return NextResponse.json({
      total: targets.length,
      updated,
      skippedCount: skipped.length,
      failed,
    });
  } catch (error) {
    console.error('Books classify error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
