-- 가입 시 "Database error creating new user" 로 실패하던 문제 수정
--
-- auth.users 에 AFTER INSERT 로 붙은 handle_new_user() 가 예외를 던지면
-- GoTrue 의 사용자 생성이 통째로 롤백되고, 클라이언트에는
-- "Database error creating new user" 라는 뭉뚱그린 메시지만 온다.
--
-- 가장 흔한 원인 두 가지를 같이 막는다.
--
--  1) search_path 문제
--     Supabase 보안 권고("Function has a role mutable search_path")를 따라
--     SECURITY DEFINER 함수에 SET search_path = '' 를 걸면, 함수 안의
--     'profiles' 같은 스키마 없는 참조가 해석되지 않아 트리거가 실패한다.
--     → public.profiles 로 스키마를 명시하고 search_path 를 고정한다.
--
--  2) 제약 조건 불일치
--     role CHECK 에 'guest' 가 없거나 기본값이 pending 이 아니면 INSERT 가 막힌다.
--     → 재적용해도 안전한 형태로 다시 맞춘다.
--
-- 그리고 어떤 이유로든 프로필 생성이 실패하더라도 가입 자체는 막지 않는다.
-- 프로필은 애플리케이션(초대 가입 API, 카카오 콜백)에서도 upsert 로 한 번 더
-- 보장하고 있고, 거기서 실패하면 에러를 화면에 띄우도록 되어 있다.

-- 1) role 기본값과 CHECK 제약을 최신 상태로 맞춘다 (007 이 안 먹었을 수 있다)
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'pending';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'member', 'pending', 'visitor', 'guest'));

-- 2) 트리거 함수를 방어적으로 다시 만든다
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, NEW.id::text || '@kakao.local'),
      COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''),
        NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
        '사용자'
      ),
      'pending'
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- 프로필 생성 실패가 가입 자체를 막지 않게 한다.
    -- 사유는 Postgres 로그에 남고, 프로필은 애플리케이션이 다시 만든다.
    RAISE WARNING 'handle_new_user 실패 (가입은 계속 진행): %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 3) 트리거가 없어졌을 수도 있으니 다시 건다
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) auth.users 에는 있는데 profiles 가 없는 "유령 계정"을 메운다.
--    (트리거가 실패하던 동안 만들어졌을 수 있다. role 은 pending 이라 관리자 승인이 필요하다)
INSERT INTO public.profiles (id, email, name, role)
SELECT
  u.id,
  COALESCE(u.email, u.id::text || '@kakao.local'),
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'nickname'), ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    '사용자'
  ),
  'pending'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
