-- 자유게시판 개편 Phase A
--
-- board_posts / board_comments 는 그동안 대시보드에서 수동 생성되어 저장소에
-- 마이그레이션이 없었다. 이 파일로 정식 문서화하고(이미 있으면 무해),
-- Phase A 에 필요한 컬럼을 추가한다.

-- 기존 테이블 문서화 (이미 존재하면 그대로 둔다)
CREATE TABLE IF NOT EXISTS board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES board_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase A 추가 컬럼
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 읽기/쓰기는 서버(service role) API 를 경유한다. 정책 없이 RLS 만 켜면 service_role 전용.
ALTER TABLE board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_board_posts_created ON board_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_comments_post ON board_comments(post_id);
