-- 직접 구현한 카카오 로그인용: 카카오 사용자 ID 를 profiles 와 매핑
--
-- 카카오 유저(id)를 Supabase 사용자에 연결하기 위한 컬럼.
-- - 신규 카카오 로그인: 이 값으로 기존 매핑을 찾고, 없으면 새 사용자 생성
-- - 기존 회원 연결: 로그인된 사용자의 row 에 kakao_id 를 채움
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kakao_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_kakao_id ON profiles(kakao_id);
