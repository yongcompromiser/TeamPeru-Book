import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 표지·저자·ISBN·설명이 비어 있는 책을 네이버 책검색으로 채운다 (관리자 전용).
//
// 노션에서 옮겨온 과거 기록처럼 제목만 있는 책을 보강하는 용도.
// 이미 값이 있는 항목은 덮어쓰지 않는다.

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim();

interface NaverItem {
  title?: string;
  author?: string;
  image?: string;
  isbn?: string;
  description?: string;
  publisher?: string;
}

// 실패 원인을 화면까지 전달하기 위해 마지막 오류를 담아둔다.
// (17권이 전부 실패해도 '못 찾음'이라고만 나오면 원인을 알 수 없다)
let lastError: string | null = null;

async function searchNaverOnce(query: string): Promise<NaverItem | null> {
  const clientId = process.env.NAVER_CLIENT_ID!;
  const clientSecret = process.env.NAVER_CLIENT_SECRET!;

  const res = await fetch(
    `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=1`,
    {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    lastError = `네이버 API ${res.status}: ${body.slice(0, 200)}`;
    console.error('naver search 실패:', query, lastError);
    return null;
  }
  const data = await res.json();
  return data.items?.[0] ?? null;
}

/**
 * 모임에서 붙인 제목('쾌락(+자유론)', '군주론: 마키아벨리')은 실제 책 제목과 달라
 * 그대로는 검색이 안 되는 경우가 있다. 원본 → 단순화한 형태 순으로 시도한다.
 */
function queryCandidates(title: string): string[] {
  const out = [title];
  const noParen = title.replace(/[(（][^)）]*[)）]/g, ' ').trim();
  const noPunct = noParen.replace(/[:：·-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (noPunct && noPunct !== title) out.push(noPunct);
  // 마지막 수단: 첫 단어 두 개 정도만 (부제가 붙은 경우 대비)
  const head = noPunct.split(' ').slice(0, 2).join(' ');
  if (head && head.length >= 2 && !out.includes(head)) out.push(head);
  return out;
}

async function searchNaver(title: string): Promise<NaverItem | null> {
  for (const q of queryCandidates(title)) {
    const item = await searchNaverOnce(q);
    if (item) return item;
  }
  return null;
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

    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      return NextResponse.json(
        { error: '네이버 책검색 API 키가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    lastError = null;

    let dryRun = false;
    try {
      const body = await request.json();
      dryRun = body?.dryRun === true;
    } catch {
      /* 본문 없으면 실제 실행 */
    }

    const { data: books, error } = await adminClient
      .from('books')
      .select('id, title, author, cover_url, isbn, description');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const isBlank = (v: unknown) => !v || String(v).trim().length === 0;
    const targets = (books ?? []).filter(
      (b) => isBlank(b.cover_url) || isBlank(b.author) || isBlank(b.description)
    );

    const planned: { id: string; title: string; author: string; hasCover: boolean }[] = [];
    const notFound: string[] = [];

    // 네이버 API 호출은 순차로. 16권 남짓이라 병렬화 이득보다 호출량 관리가 낫다.
    for (const b of targets) {
      const item = await searchNaver(b.title as string);
      if (!item) {
        notFound.push(b.title as string);
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (isBlank(b.cover_url) && item.image) patch.cover_url = item.image;
      if (isBlank(b.author) && item.author) patch.author = stripHtml(item.author);
      if (isBlank(b.description) && item.description)
        patch.description = stripHtml(item.description);
      if (isBlank(b.isbn) && item.isbn) patch.isbn = item.isbn.split(' ').pop();

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
