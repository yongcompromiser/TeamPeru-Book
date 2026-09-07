// 멤버별 통계 집계 (서버 전용, 관리자 화면용).
//
// 원칙: 테이블별로 한 번씩만 조회한 뒤 메모리에서 그룹핑한다.
// 멤버마다 쿼리를 도는 N+1 을 피하기 위함 (모임 수십 회 / 멤버 수십 명 규모).

import { createAdminClient } from '@/lib/supabase/admin';

// 통계 대상 역할. guest/pending/visitor 는 모수가 달라 참석률이 왜곡되므로 제외.
const COUNTED_ROLES = ['admin', 'member'];

export interface MemberSummary {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;

  // 참여
  attendable: number; // 가입 이후 열린 지난 모임 수 (분모)
  attended: number;
  attend_rate: number | null;
  submitted: number; // 발제/한줄평을 제출한 모임 수
  submit_rate: number | null;
  presenter_count: number; // 발제자로 지명된 횟수

  // 내용
  discussion_count: number; // 작성한 발제 문항 총합
  one_liner_count: number;
  avg_rating: number | null;
  rating_count: number;

  // 기여
  books_registered: number;
  books_selected: number; // 등록한 책이 선정된 횟수
  review_count: number;
  recap_count: number;
  photo_count: number;
  board_post_count: number;
  comment_count: number;
  schedule_vote_count: number;
  book_vote_count: number;

  activity_score: number; // 정렬용 종합 활동량
}

export interface OverallSummary {
  member_count: number;
  meeting_count: number; // 지난 모임 수
  book_count: number; // 선정되어 읽은 책 수
  total_attendance: number;
}

type Row = Record<string, unknown>;

export interface StatsData {
  profiles: Row[];
  schedules: Row[];
  pastSchedules: Row[];
  attendances: Row[];
  submissions: Row[];
  reviews: Row[];
  recaps: Row[];
  books: Row[];
  boardPosts: Row[];
  scheduleVotes: Row[];
  bookVotes: Row[];
  comments: Row[]; // 4개 댓글 테이블 통합 (user_id 만 사용)
}

// 정의가 마이그레이션에 없는 테이블이 있어(대시보드에서 수동 생성됨) 조회가 실패해도
// 통계 전체가 죽지 않도록 개별적으로 빈 배열로 대체한다.
async function safeSelect(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string
): Promise<Row[]> {
  try {
    const { data, error } = await admin.from(table).select(columns);
    if (error) {
      console.error(`stats: ${table} 조회 실패 -`, error.message);
      return [];
    }
    return (data as unknown as Row[]) ?? [];
  } catch (e) {
    console.error(`stats: ${table} 조회 예외 -`, e);
    return [];
  }
}

export async function loadStatsData(): Promise<StatsData> {
  const admin = createAdminClient();

  const [
    profiles,
    schedules,
    attendances,
    submissions,
    reviews,
    recaps,
    books,
    boardPosts,
    scheduleVotes,
    bookVotes,
    comments,
    meetingComments,
    boardComments,
    submissionComments,
  ] = await Promise.all([
    safeSelect(admin, 'profiles', 'id, name, avatar_url, role, created_at'),
    safeSelect(admin, 'schedules', 'id, title, meeting_date, presenter_id, selected_book_id'),
    safeSelect(admin, 'attendances', 'schedule_id, user_id, status'),
    safeSelect(admin, 'meeting_submissions', 'schedule_id, user_id, discussion, one_liner, rating'),
    safeSelect(admin, 'reviews', 'user_id, book_id, rating, created_at'),
    safeSelect(admin, 'recaps', 'user_id, schedule_id, photos'),
    safeSelect(admin, 'books', 'id, title, cover_url, created_by, status'),
    safeSelect(admin, 'board_posts', 'user_id, created_at'),
    safeSelect(admin, 'schedule_votes', 'user_id, vote_date'),
    safeSelect(admin, 'book_votes', 'user_id, book_id, schedule_id'),
    safeSelect(admin, 'comments', 'user_id'),
    safeSelect(admin, 'meeting_comments', 'user_id'),
    safeSelect(admin, 'board_comments', 'user_id'),
    safeSelect(admin, 'submission_comments', 'user_id'),
  ]);

  const now = Date.now();
  const pastSchedules = schedules.filter(
    (s) => new Date(s.meeting_date as string).getTime() <= now
  );

  return {
    profiles,
    schedules,
    pastSchedules,
    attendances,
    submissions,
    reviews,
    recaps,
    books,
    boardPosts,
    scheduleVotes,
    bookVotes,
    comments: [...comments, ...meetingComments, ...boardComments, ...submissionComments],
  };
}

// discussion 은 JSON 문자열 배열로 저장된다. 비어있지 않은 항목만 센다.
export function countDiscussions(raw: unknown): number {
  if (!raw || typeof raw !== 'string') return 0;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((d) => typeof d === 'string' && d.trim().length > 0).length;
    }
  } catch {
    // JSON 이 아닌 예전 형식(단일 텍스트)
  }
  return raw.trim().length > 0 ? 1 : 0;
}

function countBy(rows: Row[], key = 'user_id'): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = r[key] as string | null;
    if (!id) continue;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

export function buildMemberSummaries(data: StatsData): {
  members: MemberSummary[];
  overall: OverallSummary;
} {
  const targets = data.profiles.filter((p) => COUNTED_ROLES.includes(p.role as string));

  const scheduleDate = new Map(
    data.schedules.map((s) => [s.id as string, new Date(s.meeting_date as string).getTime()])
  );
  const pastScheduleIds = new Set(data.pastSchedules.map((s) => s.id as string));

  // 선정된 책 id (등록자의 '적중' 판정용)
  const selectedBookIds = new Set(
    data.schedules.map((s) => s.selected_book_id as string | null).filter(Boolean) as string[]
  );

  const presenterCounts = countBy(data.pastSchedules, 'presenter_id');
  const reviewCounts = countBy(data.reviews);
  const recapCounts = countBy(data.recaps);
  const boardCounts = countBy(data.boardPosts);
  const commentCounts = countBy(data.comments);
  const scheduleVoteCounts = countBy(data.scheduleVotes);
  const bookVoteCounts = countBy(data.bookVotes);

  const photoCounts = new Map<string, number>();
  for (const r of data.recaps) {
    const uid = r.user_id as string | null;
    if (!uid) continue;
    const photos = Array.isArray(r.photos) ? r.photos.length : 0;
    photoCounts.set(uid, (photoCounts.get(uid) ?? 0) + photos);
  }

  const booksRegistered = countBy(data.books, 'created_by');
  const booksSelected = new Map<string, number>();
  for (const b of data.books) {
    const uid = b.created_by as string | null;
    if (!uid) continue;
    if (selectedBookIds.has(b.id as string)) {
      booksSelected.set(uid, (booksSelected.get(uid) ?? 0) + 1);
    }
  }

  // 참석: 지난 모임에 한해 status='attending' 만 인정
  const attendedCounts = new Map<string, number>();
  for (const a of data.attendances) {
    if (a.status !== 'attending') continue;
    if (!pastScheduleIds.has(a.schedule_id as string)) continue;
    const uid = a.user_id as string;
    attendedCounts.set(uid, (attendedCounts.get(uid) ?? 0) + 1);
  }

  // 제출물: 지난 모임 기준으로 집계
  const submittedCounts = new Map<string, number>();
  const discussionCounts = new Map<string, number>();
  const oneLinerCounts = new Map<string, number>();
  const ratingSums = new Map<string, number>();
  const ratingCounts = new Map<string, number>();

  for (const s of data.submissions) {
    if (!pastScheduleIds.has(s.schedule_id as string)) continue;
    const uid = s.user_id as string;
    if (!uid) continue;
    submittedCounts.set(uid, (submittedCounts.get(uid) ?? 0) + 1);
    discussionCounts.set(uid, (discussionCounts.get(uid) ?? 0) + countDiscussions(s.discussion));
    const one = (s.one_liner as string | null) ?? '';
    if (one.trim().length > 0) {
      oneLinerCounts.set(uid, (oneLinerCounts.get(uid) ?? 0) + 1);
    }
    const rating = s.rating as number | null;
    if (typeof rating === 'number' && rating > 0) {
      ratingSums.set(uid, (ratingSums.get(uid) ?? 0) + rating);
      ratingCounts.set(uid, (ratingCounts.get(uid) ?? 0) + 1);
    }
  }

  // 독후감 별점도 평균에 합산
  for (const r of data.reviews) {
    const uid = r.user_id as string;
    const rating = r.rating as number | null;
    if (!uid || typeof rating !== 'number' || rating <= 0) continue;
    ratingSums.set(uid, (ratingSums.get(uid) ?? 0) + rating);
    ratingCounts.set(uid, (ratingCounts.get(uid) ?? 0) + 1);
  }

  const members: MemberSummary[] = targets.map((p) => {
    const id = p.id as string;
    const joinedAt = new Date(p.created_at as string).getTime();

    // 분모는 '가입 이후에 열린 지난 모임'. 늦게 합류한 멤버가 불리해지지 않게 한다.
    const attendable = data.pastSchedules.filter(
      (s) => (scheduleDate.get(s.id as string) ?? 0) >= joinedAt
    ).length;

    const attended = attendedCounts.get(id) ?? 0;
    const submitted = submittedCounts.get(id) ?? 0;
    const ratingCount = ratingCounts.get(id) ?? 0;

    const review_count = reviewCounts.get(id) ?? 0;
    const recap_count = recapCounts.get(id) ?? 0;
    const board_post_count = boardCounts.get(id) ?? 0;
    const comment_count = commentCounts.get(id) ?? 0;
    const books_registered = booksRegistered.get(id) ?? 0;
    const discussion_count = discussionCounts.get(id) ?? 0;

    return {
      id,
      name: (p.name as string) ?? '이름 없음',
      avatar_url: (p.avatar_url as string | null) ?? null,
      role: p.role as string,
      joined_at: p.created_at as string,

      attendable,
      attended,
      attend_rate: attendable > 0 ? Math.round((attended / attendable) * 100) : null,
      submitted,
      submit_rate: attendable > 0 ? Math.round((submitted / attendable) * 100) : null,
      presenter_count: presenterCounts.get(id) ?? 0,

      discussion_count,
      one_liner_count: oneLinerCounts.get(id) ?? 0,
      avg_rating:
        ratingCount > 0 ? Math.round(((ratingSums.get(id) ?? 0) / ratingCount) * 10) / 10 : null,
      rating_count: ratingCount,

      books_registered,
      books_selected: booksSelected.get(id) ?? 0,
      review_count,
      recap_count,
      photo_count: photoCounts.get(id) ?? 0,
      board_post_count,
      comment_count,
      schedule_vote_count: scheduleVoteCounts.get(id) ?? 0,
      book_vote_count: bookVoteCounts.get(id) ?? 0,

      // 참석/제출을 크게 보고 나머지 기여를 얹는다
      activity_score:
        attended * 5 +
        submitted * 4 +
        discussion_count +
        review_count * 3 +
        recap_count * 3 +
        board_post_count * 2 +
        comment_count +
        books_registered * 2,
    };
  });

  const overall: OverallSummary = {
    member_count: members.length,
    meeting_count: data.pastSchedules.length,
    book_count: selectedBookIds.size,
    total_attendance: [...attendedCounts.values()].reduce((a, b) => a + b, 0),
  };

  return { members, overall };
}

// ── 개인 상세 ────────────────────────────────────────────────────────────

export interface MonthlyPoint {
  month: string; // yyyy-MM
  attended: number;
  total: number;
}

export interface ReadBook {
  id: string;
  title: string;
  cover_url: string | null;
  meeting_date: string;
  schedule_id: string;
  schedule_title: string;
  attended: boolean;
  rating: number | null;
  one_liner: string | null;
}

export interface MemberDetail {
  summary: MemberSummary;
  monthly: MonthlyPoint[];
  rating_distribution: { rating: number; count: number }[];
  books: ReadBook[];
  presented: { schedule_id: string; title: string; meeting_date: string }[];
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function buildMemberDetail(
  data: StatsData,
  summary: MemberSummary
): MemberDetail {
  const userId = summary.id;
  const joinedAt = new Date(summary.joined_at).getTime();

  // 가입 이후의 지난 모임만 대상 (요약 지표의 분모와 동일한 기준)
  const relevant = data.pastSchedules
    .filter((s) => new Date(s.meeting_date as string).getTime() >= joinedAt)
    .sort(
      (a, b) =>
        new Date(b.meeting_date as string).getTime() -
        new Date(a.meeting_date as string).getTime()
    );

  const attendedSet = new Set(
    data.attendances
      .filter((a) => a.user_id === userId && a.status === 'attending')
      .map((a) => a.schedule_id as string)
  );

  const mySubmissions = new Map(
    data.submissions
      .filter((s) => s.user_id === userId)
      .map((s) => [s.schedule_id as string, s])
  );

  const bookMap = new Map(data.books.map((b) => [b.id as string, b]));

  // 월별 참석 추이 (오래된 순)
  const monthlyMap = new Map<string, { attended: number; total: number }>();
  for (const s of [...relevant].reverse()) {
    const key = monthKey(s.meeting_date as string);
    const cur = monthlyMap.get(key) ?? { attended: 0, total: 0 };
    cur.total += 1;
    if (attendedSet.has(s.id as string)) cur.attended += 1;
    monthlyMap.set(key, cur);
  }
  const monthly: MonthlyPoint[] = [...monthlyMap.entries()].map(([month, v]) => ({
    month,
    ...v,
  }));

  // 별점 분포 (모임 제출 별점 + 독후감 별점)
  const dist = new Map<number, number>([1, 2, 3, 4, 5].map((n) => [n, 0]));
  for (const s of data.submissions) {
    if (s.user_id !== userId) continue;
    const r = s.rating as number | null;
    if (typeof r === 'number' && r >= 1 && r <= 5) {
      dist.set(Math.round(r), (dist.get(Math.round(r)) ?? 0) + 1);
    }
  }
  for (const r of data.reviews) {
    if (r.user_id !== userId) continue;
    const v = r.rating as number | null;
    if (typeof v === 'number' && v >= 1 && v <= 5) {
      dist.set(Math.round(v), (dist.get(Math.round(v)) ?? 0) + 1);
    }
  }
  const rating_distribution = [...dist.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => ({ rating, count }));

  // 함께 읽은 책
  const books: ReadBook[] = [];
  for (const s of relevant) {
    const bookId = s.selected_book_id as string | null;
    if (!bookId) continue;
    const b = bookMap.get(bookId);
    if (!b) continue;
    const sub = mySubmissions.get(s.id as string);
    books.push({
      id: bookId,
      title: (b.title as string) ?? '',
      cover_url: (b.cover_url as string | null) ?? null,
      meeting_date: s.meeting_date as string,
      schedule_id: s.id as string,
      schedule_title: (s.title as string) ?? '',
      attended: attendedSet.has(s.id as string),
      rating: (sub?.rating as number | null) ?? null,
      one_liner: (sub?.one_liner as string | null) ?? null,
    });
  }

  const presented = data.pastSchedules
    .filter((s) => s.presenter_id === userId)
    .sort(
      (a, b) =>
        new Date(b.meeting_date as string).getTime() -
        new Date(a.meeting_date as string).getTime()
    )
    .map((s) => ({
      schedule_id: s.id as string,
      title: (s.title as string) ?? '',
      meeting_date: s.meeting_date as string,
    }));

  return { summary, monthly, rating_distribution, books, presented };
}
