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

-- 해마다 다른 느낌을 주기 위한 테마 키 (src/lib/yearbook-themes.ts 의 key).
-- 값 검증은 애플리케이션에서 한다. 테마 목록은 늘어날 수 있어 CHECK 는 두지 않는다.
-- 이미 위 CREATE TABLE 을 실행한 뒤라도 이 줄만 다시 돌리면 된다.
ALTER TABLE year_reviews ADD COLUMN IF NOT EXISTS theme TEXT;

-- 연도별 공개 여부. 기본은 비공개라 관리자가 다듬는 동안 멤버에게 보이지 않는다.
-- 관리자가 체크해야 그 해 결산이 멤버에게 열린다.
ALTER TABLE year_reviews ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

-- 읽기/쓰기는 서버(service role) API 를 경유한다.
ALTER TABLE year_reviews ENABLE ROW LEVEL SECURITY;
