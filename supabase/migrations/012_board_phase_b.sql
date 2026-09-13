-- 자유게시판 개편 Phase B — 카테고리 + 좋아요

-- 카테고리 (잡담/질문/책추천/나눔/공지). 검증은 애플리케이션에서.
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '잡담';

-- 좋아요 (한 사람이 한 글에 한 번)
CREATE TABLE IF NOT EXISTS board_post_likes (
  post_id UUID REFERENCES board_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- 읽기/쓰기는 서버(service role) API 경유
ALTER TABLE board_post_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_board_posts_category ON board_posts(category);
CREATE INDEX IF NOT EXISTS idx_board_post_likes_post ON board_post_likes(post_id);
