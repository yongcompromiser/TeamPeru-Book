-- 연말결산
--
-- 그 해의 통계(읽은 책, 평점, 참석, 분야 분포, 시상)는 기존 데이터에서 매번
-- 계산하므로 저장하지 않는다. 여기에는 사람이 직접 쓰는 부분만 담는다.
-- 집계를 저장해두면 나중에 별점이나 모임 기록을 고쳤을 때 결산이 옛날 값으로 남는다.
CREATE TABLE IF NOT EXISTS year_reviews (
  year INTEGER PRIMARY KEY,
  title TEXT,          -- 예: 'TEAM PERU 2024 연말정산'
  intro TEXT,          -- 총평 (HTML)
  highlights TEXT,     -- 그 해의 에피소드·뒷이야기 (HTML)
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 읽기/쓰기는 서버(service role) API 를 경유한다.
ALTER TABLE year_reviews ENABLE ROW LEVEL SECURITY;
