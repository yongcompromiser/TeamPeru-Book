export type UserRole = 'admin' | 'member' | 'visitor' | 'pending' | 'guest';

// 책 상태 타입 (확장 가능)
export type BookStatus =
  | 'waiting'    // 대기중 - 새로 등록된 책 (아직 후보로 오른 적 없음)
  | 'nominated'  // 후보 경험 - 후보에 오른 적 있음(선정 예정 포함), 아직 토론 전
  | 'completed'; // 토론 완료

// 책 상태 라벨 (UI 표시용)
export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  waiting: '대기중',
  nominated: '후보 경험',
  completed: '토론 완료',
};

// 책 상태 색상 (UI 표시용)
export const BOOK_STATUS_COLORS: Record<BookStatus, { bg: string; text: string }> = {
  waiting: { bg: 'bg-gray-100', text: 'text-gray-700' },
  nominated: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
};

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  kakao_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  cover_url?: string;
  description?: string;
  isbn?: string;
  category?: string;
  selection_reason?: string;
  status: BookStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  book_id: string;
  title: string;
  description?: string;
  meeting_date: string;
  location?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  book?: Book;
  attendances?: Attendance[];
}

export type AttendanceStatus = 'attending' | 'not_attending' | 'maybe';

export interface Attendance {
  id: string;
  schedule_id: string;
  user_id: string;
  status: AttendanceStatus;
  created_at: string;
  profile?: Profile;
}

export interface Discussion {
  id: string;
  book_id: string;
  schedule_id?: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  book?: Book;
  profile?: Profile;
}

export interface Review {
  id: string;
  book_id: string;
  user_id: string;
  title: string;
  content: string;
  rating: number;
  created_at: string;
  updated_at: string;
  book?: Book;
  profile?: Profile;
}

export interface Recap {
  id: string;
  schedule_id: string;
  user_id: string;
  title: string;
  content: string;
  photos?: string[];
  created_at: string;
  updated_at: string;
  schedule?: Schedule;
  profile?: Profile;
}

export type CommentableType = 'discussion' | 'review' | 'recap';

export interface Comment {
  id: string;
  commentable_type: CommentableType;
  commentable_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}
