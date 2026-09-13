# 자유게시판 개편 기획 (인수인계)

작성: 2026-09-13. 다른 PC에서 이 문서를 읽고 이어서 구현한다.
`git pull` 로 최신(`c1fd6d3` 이후)을 받은 뒤 진행할 것.

## 결정 사항 (사용자 확정)
- **범위**: Tier 1 + Tier 2 + Tier 3 **전부**
- **비주얼**: **하이브리드** — 공지는 상단 컴팩트 리스트, 일반글은 포스트잇 그리드 유지
- **진행 방식**: 독립 배포 가능한 **3단계(Phase A→B→C)**. 각 단계마다 `tsc`+build+실데이터 검증 후 배포.

## 현재 게시판 상태 (개편 전)
- 목록: 포스트잇 그리드 (`src/app/(main)/board/page.tsx`)
- 글쓰기: 제목+본문(평문)만 (`board/new/page.tsx`)
- 상세: 제목·작성자·본문·삭제(작성자/관리자) + 댓글 달기/보기 (`board/[id]/page.tsx`)
- API: `src/app/api/board/route.ts`(목록/작성), `board/[id]/route.ts`(상세/삭제),
  `board/[id]/comments/route.ts`(댓글 작성)
- **없음**: 글 수정, 댓글 수정/삭제, 카테고리, 좋아요, 검색, 공지 고정, 조회수, 이미지, 페이지네이션
- 쓰기는 전부 `createAdminClient()`(service role)로 RLS 우회. 읽기는 공개.
- ⚠️ `board_posts` / `board_comments` 는 **마이그레이션이 저장소에 없음**(대시보드에서 수동 생성).
  → 이번에 정식 마이그레이션 `011_board.sql` 로 문서화한다.

### 실제 컬럼 (코드 사용 기준, 배포 전 DB에서 재확인 필수)
- `board_posts`: `id, user_id, title, content, created_at`
- `board_comments`: `id, post_id, user_id, content, created_at`

## 카테고리 (제안 · 구현 시 확정)
`잡담` · `질문` · `책추천` · `나눔` · `공지`(관리자 전용). 각 색상 뱃지.
기본값은 `잡담`. `공지`는 관리자만 선택 가능(서버에서 role 검증).

---

## Phase A — 기본기 (Tier 1)

### DB (`011_board.sql`)
```sql
-- 저장소에 없던 board_posts/board_comments 를 정식 문서화 (이미 있으면 무해)
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
ALTER TABLE board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_comments ENABLE ROW LEVEL SECURITY;
```

### API
- `PATCH /api/board/[id]` — 글 수정. 작성자 또는 admin. `updated_at` 갱신.
- `PATCH /api/board/[id]` (또는 별도 액션) — `is_pinned` 토글: **admin 전용**.
- `GET /api/board/[id]` — 진입 시 `view_count += 1` (adminClient 로 update). 중복 방지는
  일단 안 함(단순). 필요하면 나중에 세션/쿠키로.
- `PATCH·DELETE /api/board/[id]/comments/[commentId]` — 댓글 수정/삭제. 작성자 또는 admin.

### UI
- 목록: 상단에 📌 고정글(공지) 컴팩트 리스트, 아래 일반글 그리드. 카드에 👁 조회수.
- 상세: 조회수 표시, 수정 버튼(작성자/admin), 고정 토글(admin), 댓글 수정/삭제 버튼.
- 글 수정 페이지: `board/[id]/edit/page.tsx` (작성 폼 재사용).

### 검증
글 작성→수정→반영, 댓글 작성→수정→삭제, 고정 토글 후 상단 노출, 상세 진입 시 조회수 증가.

---

## Phase B — 탐색·상호작용 (Tier 2)

### DB
```sql
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '잡담';
CREATE TABLE IF NOT EXISTS board_post_likes (
  post_id UUID REFERENCES board_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE board_post_likes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_board_posts_category ON board_posts(category);
CREATE INDEX IF NOT EXISTS idx_board_post_likes_post ON board_post_likes(post_id);
```

### API
- `GET /api/board` 확장: 쿼리 `?category=&q=&limit=&offset=`.
  - 정렬: `is_pinned desc, created_at desc`.
  - 각 글에 `like_count`, `comment_count`, `liked`(요청자가 눌렀는지) 포함.
  - `q` 는 title/content ILIKE. 페이지네이션 limit/offset.
- `POST·DELETE /api/board/[id]/like` — 좋아요 토글(로그인 필요).
- `POST/PATCH /api/board` 에 `category` 반영. `공지`는 admin 만.

### UI
- 카테고리 필터 탭 + 검색창. 카드/상세에 카테고리 색 뱃지, ❤ 카운트+토글, 💬 카운트.
- 무한스크롤(또는 더보기 버튼)로 페이지네이션.

### 검증
카테고리 필터·검색 결과 정확, 좋아요 토글·카운트, 페이지네이션 경계, 공지 카테고리 admin 제한.

---

## Phase C — 리치 콘텐츠 (Tier 3)

### 사전 준비 (사용자 작업)
- Supabase **Storage 버킷 `board` 생성 (public)**.
  - 대시보드 → Storage → New bucket → name `board`, Public 체크.
  - 업로드는 서버(service role)로 하거나, 클라 직접 업로드 시 Storage 정책 필요.
  - 권장: **서버 라우트에서 service role 로 업로드** → RLS 신경 안 씀.

### DB
```sql
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
```

### API
- `POST /api/board/upload` — 이미지 업로드(로그인 필요), Storage `board/` 에 저장 후 public URL 반환.
  용량/확장자 제한(예: 5MB, jpg/png/webp/gif).
- 작성/수정 시 `image_urls` 저장.

### UI
- 작성/수정 폼: 이미지 첨부(다중), 미리보기, 삭제.
- 카드: 첫 이미지 썸네일. 상세: 이미지 갤러리.
- 경량 서식: 줄바꿈 유지(이미 pre-wrap) + URL 자동 링크. (풀 마크다운은 범위 밖, 필요 시만.)

### 검증
이미지 업로드→저장→카드/상세 렌더, 용량/확장자 거부, 수정 시 이미지 추가/삭제.

---

## 공통 안전 원칙
- 모든 SQL 은 `IF NOT EXISTS` + service-role RLS 패턴(기존과 동일). 기존 글 무손상.
- 커밋 메시지에 세션/대화 링크 금지 (`Co-Authored-By` 까지만).
- Phase 별로 배포 후 실제 화면에서 검증하고 다음 단계로.
