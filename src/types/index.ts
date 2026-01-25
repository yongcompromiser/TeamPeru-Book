export type UserRole = 'admin' | 'member';

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
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
