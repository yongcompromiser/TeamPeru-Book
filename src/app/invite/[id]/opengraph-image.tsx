import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

// 카톡·슬랙 등에서 링크를 펼쳤을 때 보이는 초대장 카드.
// Next 가 이 파일을 찾아 자동으로 og:image 로 걸어준다.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '팀 페루 독서토론 모임 초대장';

/**
 * ImageResponse 는 기본 폰트에 한글이 없어 그냥 그리면 글자가 깨진다.
 * 구글 폰트에서 받아 넣되, text 파라미터로 '이 카드에 실제로 쓰는 글자'만 요청한다.
 * 한글 전체를 받으면 6MB 라 카톡 크롤러가 기다리다 포기할 수 있는데,
 * 부분집합은 10KB 안팎이라 빠르다.
 * 실패하면 폰트 없이 그려 최소한 카드 모양은 남긴다.
 */
async function loadKoreanFont(usedText: string): Promise<ArrayBuffer | null> {
  try {
    const uniq = [...new Set([...usedText])].join('');
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(uniq)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 86400 } }
    ).then((r) => r.text());

    // 부분집합은 확장자가 없는 /l/font?kit=... 형태로 온다
    const url = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) return null;

    return await fetch(url, { next: { revalidate: 86400 } }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  let bookTitle = '독서토론 모임';
  let author: string | null = null;
  let cover: string | null = null;
  let dateLabel = '';
  let meta = '';
  let isPublic = false;

  try {
    const { data: schedule } = await admin
      .from('schedules')
      .select('meeting_date, meeting_time, location, invite_public, selected_book_id, presenter_id')
      .eq('id', params.id)
      .maybeSingle();

    if (schedule?.invite_public) {
      isPublic = true;

      if (schedule.selected_book_id) {
        const { data: b } = await admin
          .from('books')
          .select('title, author, cover_url')
          .eq('id', schedule.selected_book_id)
          .maybeSingle();
        if (b) {
          bookTitle = (b.title as string) ?? bookTitle;
          author = (b.author as string | null) ?? null;
          cover = (b.cover_url as string | null) ?? null;
        }
      }

      let presenter: string | null = null;
      if (schedule.presenter_id) {
        const { data: p } = await admin
          .from('profiles')
          .select('name')
          .eq('id', schedule.presenter_id)
          .maybeSingle();
        presenter = (p?.name as string | undefined) ?? null;
      }

      const d = new Date(schedule.meeting_date as string);
      const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
      dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})${
        schedule.meeting_time ? ` ${schedule.meeting_time}` : ''
      }`;
      meta = [schedule.location as string | null, presenter ? `발제 ${presenter}` : null]
        .filter(Boolean)
        .join(' · ');
    }
  } catch {
    /* 조회 실패 시 기본 문구로 그린다 */
  }

  // 카드에 실제로 그릴 글자만 모아 폰트를 요청한다
  const font = await loadKoreanFont(
    ['팀 페루 독서토론', '초대장 열어보기 →', bookTitle, author, dateLabel, meta]
      .filter(Boolean)
      .join('')
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          // 초대 화면과 같은 블랙&우드 톤
          background: '#0d0a07',
          fontFamily: font ? 'NotoKR' : undefined,
        }}
      >
        {/* 나무 결 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'repeating-linear-gradient(94deg, #1a1208 0px, #241a0e 6px, #17100a 14px, #1e150c 22px)',
            opacity: 0.55,
          }}
        />
        {/* 위에서 내려오는 광원 */}
        <div
          style={{
            position: 'absolute',
            top: -320,
            left: 300,
            width: 800,
            height: 800,
            display: 'flex',
            borderRadius: 400,
            background: 'radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 62%)',
          }}
        />
        {/* 금박 테두리 */}
        <div
          style={{
            position: 'absolute',
            inset: 26,
            display: 'flex',
            border: '2px solid rgba(245,158,11,0.38)',
            borderRadius: 10,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 34,
            display: 'flex',
            border: '1px solid rgba(245,158,11,0.16)',
            borderRadius: 6,
          }}
        />

        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: 80,
            alignItems: 'center',
            gap: 56,
          }}
        >
        {/* 책 표지 */}
        {isPublic && cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={276}
            height={414}
            style={{
              objectFit: 'cover',
              borderRadius: 10,
              boxShadow: '0 26px 70px rgba(0,0,0,.8)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          />
        ) : (
          <div
            style={{
              width: 276,
              height: 414,
              borderRadius: 10,
              background: 'linear-gradient(140deg, #3b2a16 0%, #241809 60%, #1a1207 100%)',
              border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 96,
            }}
          >
            📖
          </div>
        )}

        {/* 본문 */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 24, color: '#d97706', letterSpacing: 10 }}>
            INVITATION
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#fbbf24', marginTop: 8 }}>
            팀 페루 독서토론
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: bookTitle.length > 18 ? 56 : 68,
              color: '#ffffff',
              marginTop: 18,
              lineHeight: 1.2,
            }}
          >
            {bookTitle.slice(0, 40)}
          </div>

          {author && (
            <div style={{ display: 'flex', fontSize: 28, color: '#d6cbb6', marginTop: 12 }}>
              {author.slice(0, 30)}
            </div>
          )}

          {dateLabel && (
            <div style={{ display: 'flex', fontSize: 34, color: '#fcd34d', marginTop: 34 }}>
              {dateLabel}
            </div>
          )}

          {meta && (
            <div style={{ display: 'flex', fontSize: 26, color: '#a89c85', marginTop: 10 }}>
              {meta.slice(0, 50)}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              marginTop: 40,
              fontSize: 24,
              color: '#1a1208',
              background: '#fbbf24',
              padding: '12px 26px',
              borderRadius: 999,
              alignSelf: 'flex-start',
            }}
          >
            초대장 열어보기 →
          </div>
        </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'NotoKR', data: font, style: 'normal', weight: 700 }] : undefined,
    }
  );
}
