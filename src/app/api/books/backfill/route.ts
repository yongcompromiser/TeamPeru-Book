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

async function searchNaver(query: string): Promise<NaverItem | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(
    `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=1`,
    {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0] ?? null;
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
    });
  } catch (error) {
    console.error('Books backfill error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
