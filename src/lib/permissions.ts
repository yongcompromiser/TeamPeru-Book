// 서버 쪽 권한 판정 (API 라우트 전용).
//
// 게스트는 초대받은 모임에 '참여'만 할 수 있고, 모임 운영에 영향을 주는 것
// (일정·책 투표, 책 등록/삭제)은 정회원만 한다.
// 화면에서 버튼을 숨기는 것만으로는 API 를 직접 부르면 그대로 통과하므로
// 여기서 한 번 더 막는다.

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type Role = 'admin' | 'member' | 'guest' | 'pending' | 'visitor';

export interface Viewer {
  id: string;
  role: Role;
}

/** 로그인한 사용자와 역할. 비로그인이면 null. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!data) return null;

  return { id: user.id, role: data.role as Role };
}

export const isMember = (v: Viewer | null) => v?.role === 'member' || v?.role === 'admin';
export const isAdmin = (v: Viewer | null) => v?.role === 'admin';

/**
 * 게스트가 이 모임에 참여(발제·한줄평·평점)할 수 있는지.
 * 초대장을 통해 들어오면 meeting_rsvps 에 이름이 올라가므로, 그 기록을 초대의 증거로 본다.
 * 정회원·관리자는 모든 모임에 참여할 수 있다.
 */
export async function canSubmitToMeeting(
  viewer: Viewer | null,
  scheduleId: string
): Promise<boolean> {
  if (!viewer) return false;
  if (isMember(viewer)) return true;
  if (viewer.role !== 'guest') return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from('meeting_rsvps')
    .select('id')
    .eq('schedule_id', scheduleId)
    .eq('user_id', viewer.id)
    .maybeSingle();

  return !!data;
}
