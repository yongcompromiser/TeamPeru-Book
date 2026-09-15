import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 초대 링크를 카톡 등에 공유했을 때 미리보기(제목·설명·이미지)가 뜨도록 메타데이터를 준다.
 * page.tsx 는 클라이언트 컴포넌트라 generateMetadata 를 둘 수 없어 layout 에 둔다.
 *
 * 공개되지 않은 모임은 내용을 노출하지 않는다 — 링크만 알면 미리보기로 정보가 새면 안 된다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const fallback: Metadata = {
    title: '팀 페루 독서토론',
    description: '함께 읽고 나누는 즐거움',
  };

  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: schedule } = await admin
      .from('schedules')
      .select('meeting_date, meeting_time, location, invite_public, selected_book_id, presenter_id')
      .eq('id', id)
      .maybeSingle();

    if (!schedule || !schedule.invite_public) return fallback;

    let bookTitle: string | null = null;
    if (schedule.selected_book_id) {
      const { data: b } = await admin
        .from('books')
        .select('title')
        .eq('id', schedule.selected_book_id)
        .maybeSingle();
      bookTitle = (b?.title as string | undefined) ?? null;
    }

    let presenterName: string | null = null;
    if (schedule.presenter_id) {
      const { data: p } = await admin
        .from('profiles')
        .select('name')
        .eq('id', schedule.presenter_id)
        .maybeSingle();
      presenterName = (p?.name as string | undefined) ?? null;
    }

    const d = new Date(schedule.meeting_date as string);
    const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const parts = [
      dateLabel + (schedule.meeting_time ? ` ${schedule.meeting_time}` : ''),
      schedule.location as string | null,
      presenterName ? `발제 ${presenterName}` : null,
    ].filter(Boolean);

    const title = bookTitle
      ? `[팀 페루] ${bookTitle} — 독서토론 초대`
      : '[팀 페루] 독서토론 모임 초대';

    return {
      title,
      description: parts.join(' · '),
      openGraph: {
        title,
        description: parts.join(' · '),
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: parts.join(' · '),
      },
    };
  } catch {
    return fallback;
  }
}

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
