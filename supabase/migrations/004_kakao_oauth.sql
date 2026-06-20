-- 카카오 OAuth 로그인 지원: 신규 가입자 프로필 생성 트리거 보강
--
-- 카카오는 profile_nickname 동의항목만 받으므로 이메일이 없을 수 있다.
-- profiles.email 은 NOT NULL 이라 기존 트리거는 카카오 가입 시 실패(DB 에러)한다.
-- 이메일이 없으면 user id 기반 placeholder 로 채워 NOT NULL 제약을 만족시킨다.
-- 이름도 카카오 닉네임 메타데이터(name / full_name / nickname)에서 가져온다.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@kakao.local'),
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'nickname',
      split_part(COALESCE(NEW.email, '사용자'), '@', 1)
    ),
    'pending'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;
