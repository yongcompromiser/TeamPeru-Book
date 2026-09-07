// 멤버별 통계 집계 (서버 전용, 관리자 화면용).
//
// 원칙: 테이블별로 한 번씩만 조회한 뒤 메모리에서 그룹핑한다.
// 멤버마다 쿼리를 도는 N+1 을 피하기 위함 (모임 수십 회 / 멤버 수십 명 규모).
//
// 참여 판정은 meeting_submissions 제출 기준이다. attendances(참석 응답)는
// /schedule/[id] 화면에서만 쓰이고 그 화면이 주 동선에 없어 거의 비어 있다.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLateMinutes, parseTimeToMinutes } from '@/lib/attendance';

// 통계 대상 역할. guest/pending/visitor 는 모수가 달라 지표가 왜곡되므로 제외.
const COUNTED_ROLES = ['admin', 'member'];

export interface MemberSummary {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  active_since: string; // 집계 기준 시작일 (가입일과 첫 참여일 중 이른 쪽)

  // 참여
  attendable: number; // 활동 시작 이후 열린 지난 모임 수
  participated: number; // 참석 횟수
  presenter_count: number; // 발제자로 지명된 횟수

  // 출결 (기록이 있는 모임만 집계)
  on_time_count: number;
  late_count: number;
  absent_count: number;
  total_late_minutes: number;
  avg_late_minutes: number | null; // 지각한 날들의 평균 지각 시간

  // 내용
  discussion_count: number; // 작성한 발제 문항 총합
  one_liner_count: number;
  avg_rating: number | null;
  rating_count: number;
  // 모임 전체 평균 대비 편차. 양수면 후한 편, 음수면 짠 편.
  rating_bias: number | null;

  // 기여
  books_registered: number;
  books_selected: number; // 등록한 책이 선정된 횟수
  board_post_count: number;
  comment_count: number;

  activity_score: number; // 정렬용 종합 지표. 화면에는 '영향력'으로 표시한다
}

export interface CategorySlice {
  category: string; // 분야명 또는 '미분류'
  count: number;
  percent: number; // 0~100, 반올림
}

export interface OverallSummary {
  member_count: number;
  meeting_count: number; // 지난 모임 수
  book_count: number; // 함께 읽은 책 수
  total_attendance: number;
  categories: CategorySlice[]; // 함께 읽은 책의 분야 분포 (많은 순)
}

const UNCATEGORIZED = '미분류';

// 책 목록 → 분야 분포. 같은 책이 여러 번 선정돼도 읽은 횟수만큼 센다.
export function buildCategoryDistribution(categories: (string | null | undefined)[]): CategorySlice[] {
  const counts = new Map<string, number>();
  for (const c of categories) {
    const key = c && c.trim().length > 0 ? c : UNCATEGORIZED;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = categories.length;
  if (total === 0) return [];

  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => {
      // 미분류는 항상 마지막으로 보낸다
      if (a.category === UNCATEGORIZED) return 1;
      if (b.category === UNCATEGORIZED) return -1;
      return b.count - a.count;
    });
}

type Row = Record<string, unknown>;

export interface StatsData {
  profiles: Row[];
  schedules: Row[];
  pastSchedules: Row[];
  attendances: Row[];
  arrivals: Row[];
  submissions: Row[];
  books: Row[];
  boardPosts: Row[];
  comments: Row[]; // 4개 댓글 테이블 통합 (user_id 만 사용)
  submissionComments: Row[]; // 발제문에 달린 댓글 (submission_id 로 연결)
}

// 정의가 마이그레이션에 없는 테이블이 있어(대시보드에서 수동 생성됨) 조회가 실패해도
// 통계 전체가 죽지 않도록 개별적으로 빈 배열로 대체한다.
async function safeSelect(
  admin: SupabaseClient,
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
  // 집계 함수(buildMemberSummaries/buildMemberDetail)는 순수하게 유지해 환경변수 없이도
  // 단독 실행·검증할 수 있도록, DB 클라이언트는 여기서만 지연 로딩한다.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient() as unknown as SupabaseClient;

  const [
    profiles,
    schedules,
    attendances,
    arrivals,
    submissions,
    books,
    boardPosts,
    comments,
    meetingComments,
    boardComments,
    submissionComments,
  ] = await Promise.all([
    safeSelect(admin, 'profiles', 'id, name, avatar_url, role, created_at'),
    safeSelect(
      admin,
      'schedules',
      'id, title, meeting_date, meeting_time, presenter_id, selected_book_id'
    ),
    safeSelect(admin, 'attendances', 'schedule_id, user_id, status'),
    safeSelect(admin, 'meeting_arrivals', 'schedule_id, user_id, status, arrived_at'),
    safeSelect(
      admin,
      'meeting_submissions',
      'id, schedule_id, user_id, discussion, one_liner, rating'
    ),
    safeSelect(admin, 'books', 'id, title, author, cover_url, category, created_by, status'),
    safeSelect(admin, 'board_posts', 'user_id, created_at'),
    safeSelect(admin, 'comments', 'user_id'),
    safeSelect(admin, 'meeting_comments', 'user_id'),
    safeSelect(admin, 'board_comments', 'user_id'),
    safeSelect(admin, 'submission_comments', 'user_id, submission_id'),
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
    arrivals,
    submissions,
    books,
    boardPosts,
    comments: [...comments, ...meetingComments, ...boardComments, ...submissionComments],
    submissionComments,
  };
}

// discussion 은 JSON 문자열 배열로 저장된다.
// 다만 예전 형식(단일 텍스트)이나 이중 인코딩된 값이 섞여 있을 수 있어 관대하게 파싱한다.
export function parseDiscussions(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((d) => (typeof d === 'string' ? d : typeof d === 'object' && d !== null ? String((d as Record<string, unknown>).text ?? '') : ''))
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  }

  if (typeof raw !== 'string') return [];
  const text = raw.trim();
  if (text.length === 0) return [];

  try {
    const parsed = JSON.parse(text);
    // 이중 인코딩(문자열이 또 나오는 경우) 한 번 더 풀어준다
    if (typeof parsed === 'string') return parseDiscussions(parsed);
    if (Array.isArray(parsed)) return parseDiscussions(parsed);
  } catch {
    // JSON 이 아닌 예전 형식 → 통째로 하나의 발제로 본다
  }
  return [text];
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

  // 선정된 책 id (등록자의 '적중' 판정용) — 예정 모임의 선정도 적중으로 인정한다.
  const selectedBookIds = new Set(
    data.schedules.map((s) => s.selected_book_id as string | null).filter(Boolean) as string[]
  );
  // 실제로 '함께 읽은' 책은 이미 열린 모임의 것만.
  const readBookIds = new Set(
    data.pastSchedules.map((s) => s.selected_book_id as string | null).filter(Boolean) as string[]
  );

  const presenterCounts = countBy(data.pastSchedules, 'presenter_id');
  const boardCounts = countBy(data.boardPosts);
  const commentCounts = countBy(data.comments);

  const booksRegistered = countBy(data.books, 'created_by');
  const booksSelected = new Map<string, number>();
  for (const b of data.books) {
    const uid = b.created_by as string | null;
    if (!uid) continue;
    if (selectedBookIds.has(b.id as string)) {
      booksSelected.set(uid, (booksSelected.get(uid) ?? 0) + 1);
    }
  }

  // 참여 판정: 제출물이 있는 모임. 참석 응답이 있으면 합집합으로 함께 인정한다.
  const participatedByUser = new Map<string, Set<string>>();
  const addParticipation = (uid: string, scheduleId: string) => {
    const set = participatedByUser.get(uid) ?? new Set<string>();
    set.add(scheduleId);
    participatedByUser.set(uid, set);
  };

  for (const a of data.attendances) {
    if (a.status !== 'attending') continue;
    if (!pastScheduleIds.has(a.schedule_id as string)) continue;
    addParticipation(a.user_id as string, a.schedule_id as string);
  }

  // 출결 기록. '참석'으로 기록됐다면 제출물이 없어도 참여로 인정한다.
  const scheduleTime = new Map(
    data.schedules.map((s) => [s.id as string, (s.meeting_time as string | null) ?? null])
  );
  const arrivalStats = new Map<
    string,
    { on_time: number; late: number; absent: number; lateMinutes: number }
  >();

  // 명시적으로 '불참'이라 기록된 (사람, 모임) 조합.
  // 발제·한줄평은 모임 전에 미리 쓰는 것이라 제출물이 있어도 불참일 수 있다.
  // 사람이 직접 남긴 불참 기록이 더 정확하므로, 마지막에 참여에서 빼준다.
  const absentKeys = new Set<string>();

  for (const a of data.arrivals) {
    const scheduleId = a.schedule_id as string;
    if (!pastScheduleIds.has(scheduleId)) continue;
    const uid = a.user_id as string;
    if (!uid) continue;

    const cur = arrivalStats.get(uid) ?? { on_time: 0, late: 0, absent: 0, lateMinutes: 0 };
    if (a.status === 'absent') {
      cur.absent += 1;
      absentKeys.add(`${uid}:${scheduleId}`);
    } else {
      addParticipation(uid, scheduleId);
      const late = getLateMinutes(scheduleTime.get(scheduleId), a.arrived_at as string | null);
      if (late !== null) {
        cur.late += 1;
        cur.lateMinutes += late;
      } else if (parseTimeToMinutes(a.arrived_at as string | null) !== null) {
        // 도착 시각이 있고 지각이 아니면 정시
        cur.on_time += 1;
      }
    }
    arrivalStats.set(uid, cur);
  }

  const discussionCounts = new Map<string, number>();
  const oneLinerCounts = new Map<string, number>();
  const ratingSums = new Map<string, number>();
  const ratingCounts = new Map<string, number>();

  for (const s of data.submissions) {
    if (!pastScheduleIds.has(s.schedule_id as string)) continue;
    const uid = s.user_id as string;
    if (!uid) continue;
    addParticipation(uid, s.schedule_id as string);

    const discussions = parseDiscussions(s.discussion);
    if (discussions.length > 0) {
      discussionCounts.set(uid, (discussionCounts.get(uid) ?? 0) + discussions.length);
    }
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

  // 불참으로 기록된 모임은 참여에서 제외한다.
  for (const key of absentKeys) {
    const [uid, scheduleId] = key.split(':');
    participatedByUser.get(uid)?.delete(scheduleId);
  }

  // 각 멤버의 활동 시작 시점. profiles.created_at 은 카카오로 나중에 계정이 만들어진
  // 경우 실제 합류보다 늦을 수 있으므로, 첫 참여 모임이 더 이르면 그 쪽을 쓴다.
  const activeSince = new Map<string, number>();
  for (const p of data.profiles) {
    const id = p.id as string;
    let since = new Date(p.created_at as string).getTime();
    for (const scheduleId of participatedByUser.get(id) ?? []) {
      const t = scheduleDate.get(scheduleId);
      if (t !== undefined && t < since) since = t;
    }
    activeSince.set(id, since);
  }

  // 모임 전체 평균 별점. 개인의 '후한/짠' 성향을 재는 기준선이 된다.
  let overallSum = 0;
  let overallCount = 0;
  for (const [uid, sum] of ratingSums) {
    // 통계 대상 역할(admin/member)의 별점만 기준선에 넣는다
    if (!targets.some((p) => (p.id as string) === uid)) continue;
    overallSum += sum;
    overallCount += ratingCounts.get(uid) ?? 0;
  }
  const overallAvgRating = overallCount > 0 ? overallSum / overallCount : null;

  const members: MemberSummary[] = targets.map((p) => {
    const id = p.id as string;
    const since = activeSince.get(id) ?? new Date(p.created_at as string).getTime();
    const inRange = (scheduleId: string) => (scheduleDate.get(scheduleId) ?? 0) >= since;

    const attendable = data.pastSchedules.filter((s) => inRange(s.id as string)).length;
    const participated = [...(participatedByUser.get(id) ?? [])].filter(inRange).length;
    const ratingCount = ratingCounts.get(id) ?? 0;
    const arrival = arrivalStats.get(id) ?? { on_time: 0, late: 0, absent: 0, lateMinutes: 0 };

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
      active_since: new Date(since).toISOString(),

      attendable,
      participated,
      presenter_count: presenterCounts.get(id) ?? 0,

      on_time_count: arrival.on_time,
      late_count: arrival.late,
      absent_count: arrival.absent,
      total_late_minutes: arrival.lateMinutes,
      avg_late_minutes:
        arrival.late > 0 ? Math.round(arrival.lateMinutes / arrival.late) : null,

      discussion_count,
      one_liner_count: oneLinerCounts.get(id) ?? 0,
      avg_rating:
        ratingCount > 0 ? Math.round(((ratingSums.get(id) ?? 0) / ratingCount) * 10) / 10 : null,
      rating_count: ratingCount,
      rating_bias:
        ratingCount > 0 && overallAvgRating !== null
          ? Math.round(((ratingSums.get(id) ?? 0) / ratingCount - overallAvgRating) * 10) / 10
          : null,

      books_registered,
      books_selected: booksSelected.get(id) ?? 0,
      board_post_count,
      comment_count,

      // 참석을 크게 보고 나머지 기여를 얹는다
      activity_score:
        participated * 5 +
        discussion_count * 2 +
        (oneLinerCounts.get(id) ?? 0) +
        board_post_count * 2 +
        comment_count +
        books_registered * 2,
    };
  });

  // 함께 읽은 책의 분야 분포. 모임 단위로 세어, 같은 책을 두 번 읽으면 두 번 센다.
  const bookCategory = new Map(
    data.books.map((b) => [b.id as string, (b.category as string | null) ?? null])
  );
  const readCategories = data.pastSchedules
    .map((s) => s.selected_book_id as string | null)
    .filter(Boolean)
    .map((id) => bookCategory.get(id as string) ?? null);

  const overall: OverallSummary = {
    member_count: members.length,
    meeting_count: data.pastSchedules.length,
    book_count: readBookIds.size,
    total_attendance: members.reduce((sum, m) => sum + m.participated, 0),
    categories: buildCategoryDistribution(readCategories),
  };

  return { members, overall };
}

// ── 개인 상세 ────────────────────────────────────────────────────────────

// 모임이 한 달에 한 번꼴이라 월별로 끊으면 막대가 대부분 0/1 이 되어 읽기 어렵다.
// 연도별로 묶는다.
export interface YearlyPoint {
  year: string; // yyyy
  participated: number;
  total: number;
}

// 참여한 모임 1건 = 책 1권. 그 모임에 남긴 내 기록을 함께 담는다.
export interface ReadBook {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  cover_url: string | null;
  meeting_date: string;
  schedule_id: string;
  schedule_title: string;
  rating: number | null;
  one_liner: string | null;
  discussions: string[];
}

// 같은 책에 준 별점이 얼마나 비슷한지
export interface Affinity {
  id: string;
  name: string;
  avatar_url: string | null;
  common: number; // 함께 평가한 책 수
  score: number; // 0~100
}

// 분야별로 내 평균 별점과 모임 평균을 나란히
export interface CategoryPreference {
  category: string;
  count: number;
  my_avg: number;
  group_avg: number | null;
}

export interface SubmissionReaction {
  total: number; // 내 발제문에 달린 댓글 총 수
  top: { schedule_id: string; title: string; count: number } | null;
}

export interface RadarAxis {
  axis: string;
  raw: number;
  value: number; // 0~100, 멤버 중 최고값 대비
}

export interface MemberDetail {
  summary: MemberSummary;
  yearly: YearlyPoint[];
  rating_distribution: { rating: number; count: number }[];
  categories: CategorySlice[]; // 이 멤버가 참여한 모임의 책 분야 분포
  books: ReadBook[];
  presented: PresentedMeeting[];
  affinities: Affinity[];
  category_preferences: CategoryPreference[];
  reactions: SubmissionReaction;
  radar: RadarAxis[];
}

// 사이트에서 확정한 모임은 제목이 일괄 '정기 모임'이라 목록에서 구분이 안 된다.
// 그래서 그 모임에서 읽은 책을 함께 담아 화면에서 책으로 보여준다.
export interface PresentedMeeting {
  schedule_id: string;
  title: string;
  meeting_date: string;
  book_title: string | null;
  book_author: string | null;
  book_cover: string | null;
}

function yearKey(iso: string): string {
  return String(new Date(iso).getFullYear());
}

// 함께 평가한 책이 이보다 적으면 취향 비교가 의미 없다.
const MIN_COMMON_BOOKS = 3;

/**
 * 두 사람이 같은 책에 준 별점이 얼마나 비슷한지 0~100 으로.
 * 평균 절대차를 쓴다(별점 폭이 1~5 이므로 최대 차이는 4).
 * 상관계수 대신 절대차를 쓰는 이유: 표본이 십여 개라 상관계수는 불안정하고,
 * '둘 다 비슷한 점수를 줬는가'가 우리가 알고 싶은 것이기 때문이다.
 */
function affinityScore(pairs: [number, number][]): number {
  const diff = pairs.reduce((sum, [a, b]) => sum + Math.abs(a - b), 0) / pairs.length;
  return Math.round((1 - diff / 4) * 100);
}

export function buildMemberDetail(
  data: StatsData,
  summary: MemberSummary,
  allMembers: MemberSummary[] = []
): MemberDetail {
  const userId = summary.id;
  const since = new Date(summary.active_since).getTime();

  // 활동 시작 이후의 지난 모임만 대상 (요약 지표의 분모와 동일한 기준)
  const relevant = data.pastSchedules
    .filter((s) => new Date(s.meeting_date as string).getTime() >= since)
    .sort(
      (a, b) =>
        new Date(b.meeting_date as string).getTime() -
        new Date(a.meeting_date as string).getTime()
    );

  const mySubmissions = new Map(
    data.submissions.filter((s) => s.user_id === userId).map((s) => [s.schedule_id as string, s])
  );

  // 요약 지표와 동일한 기준: 제출물이 있거나 참석 응답이 있으면 참여로 본다.
  const participatedSet = new Set<string>([
    ...data.attendances
      .filter((a) => a.user_id === userId && a.status === 'attending')
      .map((a) => a.schedule_id as string),
    ...mySubmissions.keys(),
  ]);

  const bookMap = new Map(data.books.map((b) => [b.id as string, b]));

  // 연도별 참여 추이 (오래된 순)
  const yearlyMap = new Map<string, { participated: number; total: number }>();
  for (const s of [...relevant].reverse()) {
    const key = yearKey(s.meeting_date as string);
    const cur = yearlyMap.get(key) ?? { participated: 0, total: 0 };
    cur.total += 1;
    if (participatedSet.has(s.id as string)) cur.participated += 1;
    yearlyMap.set(key, cur);
  }
  const yearly: YearlyPoint[] = [...yearlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, v]) => ({ year, ...v }));

  // 별점 분포
  const dist = new Map<number, number>([1, 2, 3, 4, 5].map((n) => [n, 0]));
  for (const s of mySubmissions.values()) {
    const r = s.rating as number | null;
    if (typeof r === 'number' && r >= 1 && r <= 5) {
      dist.set(Math.round(r), (dist.get(Math.round(r)) ?? 0) + 1);
    }
  }
  const rating_distribution = [...dist.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => ({ rating, count }));

  // 함께 읽은 책 — 참여한 모임만
  const books: ReadBook[] = [];
  for (const s of relevant) {
    const scheduleId = s.id as string;
    if (!participatedSet.has(scheduleId)) continue;
    const bookId = s.selected_book_id as string | null;
    if (!bookId) continue;
    const b = bookMap.get(bookId);
    if (!b) continue;
    const sub = mySubmissions.get(scheduleId);
    books.push({
      id: bookId,
      title: (b.title as string) ?? '',
      author: (b.author as string | null) ?? null,
      category: (b.category as string | null) ?? null,
      cover_url: (b.cover_url as string | null) ?? null,
      meeting_date: s.meeting_date as string,
      schedule_id: scheduleId,
      schedule_title: (s.title as string) ?? '',
      rating: (sub?.rating as number | null) ?? null,
      one_liner: (sub?.one_liner as string | null) ?? null,
      discussions: parseDiscussions(sub?.discussion),
    });
  }

  const presented = data.pastSchedules
    .filter((s) => s.presenter_id === userId)
    .sort(
      (a, b) =>
        new Date(b.meeting_date as string).getTime() -
        new Date(a.meeting_date as string).getTime()
    )
    .map((s) => {
      const b = bookMap.get(s.selected_book_id as string);
      return {
        schedule_id: s.id as string,
        title: (s.title as string) ?? '',
        meeting_date: s.meeting_date as string,
        book_title: (b?.title as string | undefined) ?? null,
        book_author: (b?.author as string | undefined) ?? null,
        book_cover: (b?.cover_url as string | undefined) ?? null,
      };
    });

  // ── 취향 궁합 ──
  // 같은 모임에 대해 서로 별점을 남긴 경우만 비교한다.
  const myRatingBySchedule = new Map<string, number>();
  for (const s of data.submissions) {
    if (s.user_id !== userId) continue;
    const r = s.rating as number | null;
    if (typeof r === 'number' && r > 0) myRatingBySchedule.set(s.schedule_id as string, r);
  }

  const affinities: Affinity[] = [];
  for (const other of allMembers) {
    if (other.id === userId) continue;
    const pairs: [number, number][] = [];
    for (const s of data.submissions) {
      if (s.user_id !== other.id) continue;
      const theirs = s.rating as number | null;
      const mine = myRatingBySchedule.get(s.schedule_id as string);
      if (typeof theirs === 'number' && theirs > 0 && mine !== undefined) {
        pairs.push([mine, theirs]);
      }
    }
    if (pairs.length < MIN_COMMON_BOOKS) continue;
    affinities.push({
      id: other.id,
      name: other.name,
      avatar_url: other.avatar_url,
      common: pairs.length,
      score: affinityScore(pairs),
    });
  }
  affinities.sort((a, b) => b.score - a.score);

  // ── 분야별 선호도 ──
  const scheduleBook = new Map(
    data.pastSchedules.map((s) => [s.id as string, s.selected_book_id as string | null])
  );
  const myByCategory = new Map<string, number[]>();
  const groupByCategory = new Map<string, number[]>();

  for (const s of data.submissions) {
    const r = s.rating as number | null;
    if (typeof r !== 'number' || r <= 0) continue;
    const bookId = scheduleBook.get(s.schedule_id as string);
    if (!bookId) continue;
    const category = (bookMap.get(bookId)?.category as string | null) ?? null;
    if (!category) continue;

    const groupList = groupByCategory.get(category) ?? [];
    groupList.push(r);
    groupByCategory.set(category, groupList);

    if (s.user_id === userId) {
      const myList = myByCategory.get(category) ?? [];
      myList.push(r);
      myByCategory.set(category, myList);
    }
  }

  const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  const category_preferences: CategoryPreference[] = [...myByCategory.entries()]
    .map(([category, mine]) => {
      const group = groupByCategory.get(category);
      return {
        category,
        count: mine.length,
        my_avg: avg(mine),
        group_avg: group && group.length > 0 ? avg(group) : null,
      };
    })
    .sort((a, b) => b.my_avg - a.my_avg);

  // ── 내 발제가 받은 반응 ──
  const mySubmissionIds = new Map<string, string>(); // submission id → schedule id
  for (const s of data.submissions) {
    if (s.user_id === userId && s.id) mySubmissionIds.set(s.id as string, s.schedule_id as string);
  }
  const perSchedule = new Map<string, number>();
  let totalReactions = 0;
  for (const c of data.submissionComments) {
    const scheduleId = mySubmissionIds.get(c.submission_id as string);
    if (!scheduleId) continue;
    totalReactions += 1;
    perSchedule.set(scheduleId, (perSchedule.get(scheduleId) ?? 0) + 1);
  }
  let topReaction: SubmissionReaction['top'] = null;
  for (const [scheduleId, count] of perSchedule) {
    if (topReaction && count <= topReaction.count) continue;
    const s = data.pastSchedules.find((x) => x.id === scheduleId);
    const bookId = s ? (s.selected_book_id as string | null) : null;
    const title =
      (bookId ? (bookMap.get(bookId)?.title as string | undefined) : undefined) ??
      (s?.title as string | undefined) ??
      '';
    topReaction = { schedule_id: scheduleId, title, count };
  }

  // ── 레이더 ──
  // 축마다 단위가 달라 절대값으로는 비교가 안 된다. 멤버 중 최고값을 100 으로 두고
  // 상대 위치만 보여준다(그래서 라벨에 '멤버 중 최고 대비'를 명시한다).
  const pool = allMembers.length > 0 ? allMembers : [summary];
  const axisDefs: { axis: string; get: (m: MemberSummary) => number }[] = [
    { axis: '참석', get: (m) => m.participated },
    { axis: '발제', get: (m) => m.discussion_count },
    { axis: '평점', get: (m) => m.rating_count },
    { axis: '기여', get: (m) => m.books_registered + m.board_post_count + m.comment_count },
    {
      axis: '성실',
      // 지각·불참이 적을수록 높다
      get: (m) => Math.max(0, m.participated - m.late_count - m.absent_count),
    },
  ];
  const radar: RadarAxis[] = axisDefs.map(({ axis, get }) => {
    const max = Math.max(...pool.map(get), 0);
    const raw = get(summary);
    return { axis, raw, value: max > 0 ? Math.round((raw / max) * 100) : 0 };
  });

  return {
    summary,
    yearly,
    rating_distribution,
    affinities,
    category_preferences,
    reactions: { total: totalReactions, top: topReaction },
    radar,
    categories: buildCategoryDistribution(books.map((b) => b.category)),
    books,
    presented,
  };
}
