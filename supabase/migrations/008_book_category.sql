-- 책 분야(카테고리)
--
-- books.category 는 코드(Book 타입, 등록 폼, 등록 API)에서 이미 쓰이고 있으나
-- 마이그레이션에는 정의가 없었다(운영 DB 에는 수동으로 추가된 것으로 보인다).
-- 새 환경에서도 동일하게 동작하도록 여기에 남긴다.
--
-- 값은 src/lib/book-category.ts 의 BOOK_CATEGORIES 와 맞춘다:
--   문학/소설, 인문학, 사회과학, 자기계발, 경제/경영, 과학, 예술, 역사, 철학, 에세이, 기타
-- CHECK 제약은 걸지 않는다. 분류 목록은 앞으로 바뀔 수 있고,
-- 이미 들어간 값이 제약에 걸려 저장이 실패하는 편이 더 나쁘다.
ALTER TABLE books ADD COLUMN IF NOT EXISTS category TEXT;

-- 분야 필터가 목록 조회에서 자주 쓰인다.
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);

-- 함께 쓰이는 컬럼들도 정의가 빠져 있어 같이 남긴다.
ALTER TABLE books ADD COLUMN IF NOT EXISTS selection_reason TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'waiting';
