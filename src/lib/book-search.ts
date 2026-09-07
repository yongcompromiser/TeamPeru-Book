// 책 검색 (서버 전용).
//
// 네이버 책검색(/v1/search/book.json)이 SE05 'Invalid search api' 를 돌려주기 시작해
// 카카오(다음) 책 검색을 기본으로 쓴다. 카카오는 로그인용으로 이미 발급받은
// KAKAO_REST_API_KEY 를 그대로 쓸 수 있어 추가 발급이 필요 없다.
// 네이버 키가 있으면 카카오 실패 시 예비로 시도한다.

export interface BookSearchItem {
  title: string;
  author: string;
  description: string;
  image: string;
  isbn: string;
  publisher: string;
}

export interface BookSearchResult {
  items: BookSearchItem[];
  /** 전부 실패했을 때의 마지막 오류. 성공하면 없음. */
  error?: string;
}

const stripHtml = (s: string) => (s ?? '').replace(/<[^>]*>/g, '').trim();

// 네이버/카카오 모두 '10자리 13자리' 형태로 줄 때가 있어 13자리(ISBN-13)를 고른다.
function pickIsbn(raw: string): string {
  const parts = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.find((p) => p.length === 13) ?? parts[0] ?? '';
}

async function searchKakao(query: string, size: number): Promise<BookSearchResult | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}&size=${size}`,
      { headers: { Authorization: `KakaoAK ${key}` } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { items: [], error: `카카오 책검색 ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    const items: BookSearchItem[] = (data.documents ?? []).map(
      (d: {
        title?: string;
        authors?: string[];
        contents?: string;
        thumbnail?: string;
        isbn?: string;
        publisher?: string;
      }) => ({
        title: stripHtml(d.title ?? ''),
        author: (d.authors ?? []).join(', '),
        description: stripHtml(d.contents ?? ''),
        image: d.thumbnail ?? '',
        isbn: pickIsbn(d.isbn ?? ''),
        publisher: d.publisher ?? '',
      })
    );
    return { items };
  } catch (e) {
    return { items: [], error: `카카오 책검색 예외: ${String(e).slice(0, 200)}` };
  }
}

async function searchNaver(query: string, size: number): Promise<BookSearchResult | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(
        query
      )}&display=${size}`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { items: [], error: `네이버 책검색 ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    const items: BookSearchItem[] = (data.items ?? []).map(
      (d: {
        title?: string;
        author?: string;
        description?: string;
        image?: string;
        isbn?: string;
        publisher?: string;
      }) => ({
        title: stripHtml(d.title ?? ''),
        author: stripHtml(d.author ?? ''),
        description: stripHtml(d.description ?? ''),
        image: d.image ?? '',
        isbn: pickIsbn(d.isbn ?? ''),
        publisher: stripHtml(d.publisher ?? ''),
      })
    );
    return { items };
  } catch (e) {
    return { items: [], error: `네이버 책검색 예외: ${String(e).slice(0, 200)}` };
  }
}

/** 카카오 → (실패 시) 네이버 순으로 검색한다. */
export async function searchBooks(query: string, size = 5): Promise<BookSearchResult> {
  const errors: string[] = [];

  for (const provider of [searchKakao, searchNaver]) {
    const result = await provider(query, size);
    if (!result) continue; // 키가 없는 제공자는 건너뜀
    if (result.items.length > 0) return result;
    if (result.error) errors.push(result.error);
  }

  return {
    items: [],
    error: errors.length > 0 ? errors.join(' / ') : undefined,
  };
}

/**
 * 모임에서 붙인 제목('쾌락(+자유론)', '군주론: 마키아벨리')은 실제 책 제목과 달라
 * 그대로는 검색이 안 될 수 있다. 원본 → 단순화한 형태 순으로 시도한다.
 */
export function queryCandidates(title: string): string[] {
  const out = [title];
  const noParen = title.replace(/[(（][^)）]*[)）]/g, ' ').trim();
  const noPunct = noParen.replace(/[:：·-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (noPunct && noPunct !== title) out.push(noPunct);
  const head = noPunct.split(' ').slice(0, 2).join(' ');
  if (head && head.length >= 2 && !out.includes(head)) out.push(head);
  return out;
}
