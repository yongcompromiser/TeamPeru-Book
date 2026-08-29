-- 게스트(외부 방문자) 기능용 스키마
-- P1: 공개 초대 + RSVP / P2: guest 역할 / P3~4: 뱃지·승격은 이 스키마 위에서 동작

-- 1) profiles.role 에 'guest' 추가 (기존 CHECK 제약 교체)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'member', 'pending', 'visitor', 'guest'));

-- 2) 모임별 공개 초대 여부 (관리자가 켜면 로그인 없이 볼 수 있는 초대 페이지 활성화)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS invite_public BOOLEAN NOT NULL DEFAULT false;

-- 3) 게스트 참석 신청(RSVP) — 계정이 없어도 신청 가능
CREATE TABLE IF NOT EXISTS meeting_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- 로그인 게스트면 연결, 익명이면 NULL
  name TEXT NOT NULL,
  contact TEXT,          -- 연락처(선택)
  message TEXT,          -- 참석 한마디(선택)
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_schedule ON meeting_rsvps(schedule_id);
CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_user ON meeting_rsvps(user_id);

-- RLS: 쓰기/조회는 전부 서버(service role) API 경유. 정책 없이 활성화 = service role 전용.
ALTER TABLE meeting_rsvps ENABLE ROW LEVEL SECURITY;
