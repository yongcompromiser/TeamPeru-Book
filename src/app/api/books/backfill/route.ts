import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 표지·저자·ISBN·설명이 비어 있는 책을 채운다 (관리자 전용).
//
// 노션에서 옮겨온 과거 기록처럼 제목만 있는 책을 보강하는 용도.
// 이미 값이 있는 항목은 덮어쓰지 않는다.

import { searchBooks, queryCandidates, type BookSearchItem } from '@/lib/book-search';

// 제목을 여러 형태로 바꿔가며 시도한다. 실패 원인은 화면까지 전달한다.
async function findBook(
  title: string
): Promise<{ item: BookSearchItem | null; error: string | null }> {
  let error: string | null = null;
  for (const q of queryCandidates(title)) {
    const result = await searchBooks(q, 1);
    if (result.items.length > 0) return { item: result.items[0], error: null };
    if (result.error) error = result.error;
  }
  return { item: null, error };
}

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

    const hasProvider =
      !!process.env.KAKAO_REST_API_KEY ||
      (!!process.env.NAVER_CLIENT_ID && !!process.env.NAVER_CLIENT_SECRET);
    if (!hasProvider) {
      return NextResponse.json(
        { error: '책 검색 API 키(KAKAO_REST_API_KEY)가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    let lastError: string | null = null;

    let dryRun = false;
    let bookId: string | null = null;
    // force: 이미 값이 있어도 덮어쓴다. 잘못 매칭된 책을 다시 가져올 때 쓴다.
    let force = false;
    try {
      const body = await request.json();
      dryRun = body?.dryRun === true;
      bookId = typeof body?.bookId === 'string' ? body.bookId : null;
      force = body?.force === true;
    } catch {
      /* 본문 없으면 실제 실행 */
    }

    let query = adminClient.from('books').select('id, title, author, cover_url, isbn, description');
    if (bookId) query = query.eq('id', bookId);
    const { data: books, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const isBlank = (v: unknown) => !v || String(v).trim().length === 0;
    const targets = force
      ? (books ?? [])
      : (books ?? []).filter(
          (b) => isBlank(b.cover_url) || isBlank(b.author) || isBlank(b.description)
        );

    const planned: { id: string; title: string; author: string; hasCover: boolean }[] = [];
    const notFound: string[] = [];

    // 외부 API 호출은 순차로. 20권 남짓이라 병렬화 이득보다 호출량 관리가 낫다.
    for (const b of targets) {
      const { item, error: searchError } = await findBook(b.title as string);
      if (!item) {
        if (searchError) lastError = searchError;
        notFound.push(b.title as string);
        continue;
      }

      // force 면 기존 값을 덮어쓴다(잘못 매칭된 책 교정용).
      const shouldSet = (current: unknown) => force || isBlank(current);

      const patch: Record<string, unknown> = {};
      if (shouldSet(b.cover_url) && item.image) patch.cover_url = item.image;
      if (shouldSet(b.author) && item.author) patch.author = item.author;
      if (shouldSet(b.description) && item.description) patch.description = item.description;
      if (shouldSet(b.isbn) && item.isbn) patch.isbn = item.isbn;

      if (Object.keys(patch).length === 0) continue;

      planned.push({
        id: b.id as string,
        title: b.title as string,
        author: (patch.author as string) ?? (b.author as string) ?? '',
        hasCover: !!patch.cover_url,
      });

      if (!dryRun) {
        const { error: updErr } = await adminClient.from('books').update(patch).eq('id', b.id);
        if (updErr) console.error('backfill update 실패:', b.title, updErr.message);
      }
    }

    return NextResponse.json({
      dryRun,
      total: targets.length,
      updated: planned.length,
      notFound,
      planned: planned.slice(0, 30),
      // 전부 실패했을 때 원인을 알 수 있도록 마지막 API 오류를 함께 돌려준다
      error: planned.length === 0 && lastError ? lastError : undefined,
    });
  } catch (error) {
    console.error('Books backfill error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
