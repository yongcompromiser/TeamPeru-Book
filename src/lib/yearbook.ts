// 연말결산 집계 (서버 전용).
//
// 노션에 PPT 로 만들던 결산을 웹에서 자동으로 만든다.
// 그 해에 읽은 책, 멤버별 참여·평점, 분야 분포, 시상까지 기존 데이터에서 계산한다.
// 사람이 쓰는 총평/에피소드만 year_reviews 에 따로 저장한다.

import { parseDiscussions, buildCategoryDistribution, type StatsData, type CategorySlice } from '@/lib/stats';

const COUNTED_ROLES = ['admin', 'member'];

export interface YearBookEntry {
  schedule_id: string;
  book_id: string | null;
  title: string;
  author: string | null;
  cover_url: string | null;
  category: string | null;
  meeting_date: string;
  presenter_name: string | null;
  avg_rating: number | null;
  // 그 책에 남긴 멤버별 한줄평 (평점 순)
  one_liners: { name: string; rating: number | null; text: string }[];
}

export interface YearMember {
  id: string;
  name: string;
  avatar_url: string | null;
  participated: number;
  attendable: number;
  presenter_count: number;
  discussion_count: number;
  avg_rating: number | null;
  late_count: number;
}

export interface YearAward {
  key: string;
  label: string;
  winner: string;
  detail: string;
}

export interface YearBook {
  year: number;
  meeting_count: number;
  book_count: number;
  members: YearMember[];
  entries: YearBookEntry[];
  categories: CategorySlice[];
  awards: YearAward[];
  // 사람이 쓴 부분
  title: string | null;
  intro: string | null;
  highlights: string | null;
  theme: string | null; // 해마다 다른 느낌을 주는 테마 키 (src/lib/yearbook-themes.ts)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 데이터에 기록이 있는 연도 목록 (최신순). */
export function listYears(data: StatsData): number[] {
  const years = new Set<number>();
  for (const s of data.pastSchedules) {
    years.add(new Date(s.meeting_date as string).getFullYear());
  }
  return [...years].sort((a, b) => b - a);
}

export function buildYearBook(data: StatsData, year: number): YearBook {
  const schedules = data.pastSchedules
    .filter((s) => new Date(s.meeting_date as string).getFullYear() === year)
    .sort(
      (a, b) =>
        new Date(a.meeting_date as string).getTime() -
        new Date(b.meeting_date as string).getTime()
    );
  const scheduleIds = new Set(schedules.map((s) => s.id as string));

  const profileMap = new Map(data.profiles.map((p) => [p.id as string, p]));
  const bookMap = new Map(data.books.map((b) => [b.id as string, b]));
  const scheduleTime = new Map(
    data.schedules.map((s) => [s.id as string, (s.meeting_time as string | null) ?? null])
  );

  // 그 해 제출물만 추림
  const submissions = data.submissions.filter((s) => scheduleIds.has(s.schedule_id as string));

  // ── 책별 정리 ──
  const entries: YearBookEntry[] = schedules.map((s) => {
    const scheduleId = s.id as string;
    const bookId = (s.selected_book_id as string | null) ?? null;
    const b = bookId ? bookMap.get(bookId) : undefined;
    const presenter = s.presenter_id ? profileMap.get(s.presenter_id as string) : undefined;

    const mine = submissions.filter((x) => x.schedule_id === scheduleId);
    const ratings = mine
      .map((x) => x.rating as number | null)
      .filter((r): r is number => typeof r === 'number' && r > 0);

    const one_liners = mine
      .map((x) => ({
        name: (profileMap.get(x.user_id as string)?.name as string) ?? '알 수 없음',
        rating: (x.rating as number | null) ?? null,
        text: ((x.one_liner as string | null) ?? '').trim(),
      }))
      .filter((o) => o.text.length > 0)
      .sort((a, b2) => (b2.rating ?? 0) - (a.rating ?? 0));

    return {
      schedule_id: scheduleId,
      book_id: bookId,
      // 모임 제목은 확정 시 일괄 '정기 모임'이라 책 제목을 우선한다
      title: (b?.title as string | undefined) ?? (s.title as string) ?? '',
      author: (b?.author as string | undefined) ?? null,
      cover_url: (b?.cover_url as string | undefined) ?? null,
      category: (b?.category as string | undefined) ?? null,
      meeting_date: s.meeting_date as string,
      presenter_name: (presenter?.name as string | undefined) ?? null,
      avg_rating:
        ratings.length > 0 ? round1(ratings.reduce((a, c) => a + c, 0) / ratings.length) : null,
      one_liners,
    };
  });

  // ── 멤버별 ──
  const targets = data.profiles.filter((p) => COUNTED_ROLES.includes(p.role as string));

  const members: YearMember[] = targets.map((p) => {
    const id = p.id as string;

    const participatedSet = new Set<string>();
    for (const a of data.arrivals) {
      if (a.user_id !== id || !scheduleIds.has(a.schedule_id as string)) continue;
      if (a.status !== 'absent') participatedSet.add(a.schedule_id as string);
    }
    const absentSet = new Set(
      data.arrivals
        .filter(
          (a) =>
            a.user_id === id && a.status === 'absent' && scheduleIds.has(a.schedule_id as string)
        )
        .map((a) => a.schedule_id as string)
    );

    const mine = submissions.filter((x) => x.user_id === id);
    for (const x of mine) participatedSet.add(x.schedule_id as string);
    for (const sid of absentSet) participatedSet.delete(sid);

    const ratings = mine
      .map((x) => x.rating as number | null)
      .filter((r): r is number => typeof r === 'number' && r > 0);

    const discussion_count = mine.reduce((sum, x) => sum + parseDiscussions(x.discussion).length, 0);

    let late_count = 0;
    for (const a of data.arrivals) {
      if (a.user_id !== id || !scheduleIds.has(a.schedule_id as string)) continue;
      if (a.status === 'absent') continue;
      const start = scheduleTime.get(a.schedule_id as string);
      const arrived = a.arrived_at as string | null;
      if (!start || !arrived) continue;
      const [sh, sm] = start.split(':').map(Number);
      const [ah, am] = arrived.split(':').map(Number);
      if ([sh, sm, ah, am].some(Number.isNaN)) continue;
      if (ah * 60 + am > sh * 60 + sm) late_count += 1;
    }

    return {
      id,
      name: (p.name as string) ?? '이름 없음',
      avatar_url: (p.avatar_url as string | null) ?? null,
      participated: participatedSet.size,
      attendable: schedules.length,
      presenter_count: schedules.filter((s) => s.presenter_id === id).length,
      discussion_count,
      avg_rating:
        ratings.length > 0 ? round1(ratings.reduce((a, c) => a + c, 0) / ratings.length) : null,
      late_count,
    };
  });

  // ── 시상 ──
  const awards: YearAward[] = [];
  const rated = entries.filter((e) => e.avg_rating !== null);

  if (rated.length > 0) {
    const best = rated.reduce((a, b2) => (b2.avg_rating! > a.avg_rating! ? b2 : a));
    awards.push({
      key: 'best_book',
      label: '올해의 책',
      winner: best.title,
      detail: `평균 ${best.avg_rating}점`,
    });

    if (rated.length > 1) {
      const worst = rated.reduce((a, b2) => (b2.avg_rating! < a.avg_rating! ? b2 : a));
      if (worst.schedule_id !== best.schedule_id) {
        awards.push({
          key: 'worst_book',
          label: '아쉬웠던 책',
          winner: worst.title,
          detail: `평균 ${worst.avg_rating}점`,
        });
      }
    }
  }

  const withRating = members.filter((m) => m.avg_rating !== null);
  if (withRating.length > 1) {
    const generous = withRating.reduce((a, b2) => (b2.avg_rating! > a.avg_rating! ? b2 : a));
    const strict = withRating.reduce((a, b2) => (b2.avg_rating! < a.avg_rating! ? b2 : a));
    awards.push({
      key: 'generous',
      label: '가장 후한 평점',
      winner: generous.name,
      detail: `평균 ${generous.avg_rating}점`,
    });
    if (strict.id !== generous.id) {
      awards.push({
        key: 'strict',
        label: '가장 짠 평점',
        winner: strict.name,
        detail: `평균 ${strict.avg_rating}점`,
      });
    }
  }

  const topDiscussion = members.filter((m) => m.discussion_count > 0);
  if (topDiscussion.length > 0) {
    const top = topDiscussion.reduce((a, b2) => (b2.discussion_count > a.discussion_count ? b2 : a));
    awards.push({
      key: 'discussion',
      label: '발제왕',
      winner: top.name,
      detail: `문항 ${top.discussion_count}개`,
    });
  }

  const perfect = members.filter((m) => m.attendable > 0 && m.participated === m.attendable);
  if (perfect.length > 0) {
    awards.push({
      key: 'perfect',
      label: '개근상',
      winner: perfect.map((m) => m.name).join(', '),
      detail: `${schedules.length}회 전부 참석`,
    });
  }

  const lateMembers = members.filter((m) => m.late_count > 0);
  if (lateMembers.length > 0) {
    const worst = lateMembers.reduce((a, b2) => (b2.late_count > a.late_count ? b2 : a));
    awards.push({
      key: 'late',
      label: '지각왕',
      winner: worst.name,
      detail: `${worst.late_count}회 지각`,
    });
  }

  return {
    year,
    meeting_count: schedules.length,
    book_count: new Set(entries.map((e) => e.book_id).filter(Boolean)).size,
    members: members.sort((a, b2) => b2.participated - a.participated),
    entries,
    categories: buildCategoryDistribution(entries.map((e) => e.category)),
    awards,
    title: null,
    intro: null,
    highlights: null,
    theme: null,
  };
}
