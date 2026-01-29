-- 기존 role 제약 조건 변경: pending, visitor 추가
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'member', 'pending', 'visitor'));

-- 기본값을 pending으로 변경
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'pending';

-- 신규 가입자 role을 pending으로 설정하도록 트리거 함수 업데이트
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'pending'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;
