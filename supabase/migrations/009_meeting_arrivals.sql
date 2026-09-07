-- 모임별 출결 · 도착 시각
--
-- schedules.meeting_time(모임 시작 시각)과 arrived_at 을 비교해 정시/지각을 판정한다.
-- 판정은 애플리케이션(src/lib/attendance.ts)에서 하고, 여기에는 사실만 저장한다.
-- 시작 시각이 바뀌면 과거 기록의 지각 여부도 함께 재계산되게 하기 위함이다.
CREATE TABLE IF NOT EXISTS meeting_arrivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- attended: 참석(도착 시각이 있으면 정시/지각 판정), absent: 불참
  status TEXT NOT NULL DEFAULT 'attended' CHECK (status IN ('attended', 'absent')),

  -- 'HH:MM' 형식. status='attended' 일 때만 의미가 있다.
  -- TIME 대신 TEXT 를 쓰는 이유: schedules.meeting_time 이 이미 TEXT 이고,
  -- 시간대 변환 없이 사람이 적은 값을 그대로 보관하려는 목적이다.
  arrived_at TEXT,

  note TEXT,

  -- 참여자 누구나 수정할 수 있으므로, 마지막으로 고친 사람을 남긴다.
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(schedule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_arrivals_schedule ON meeting_arrivals(schedule_id);
CREATE INDEX IF NOT EXISTS idx_meeting_arrivals_user ON meeting_arrivals(user_id);

-- 읽기/쓰기는 전부 서버(service role) API 를 경유한다.
-- 정책 없이 RLS 만 켜면 service_role 전용이 된다.
ALTER TABLE meeting_arrivals ENABLE ROW LEVEL SECURITY;
