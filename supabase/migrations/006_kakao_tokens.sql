-- 카카오 "나에게 보내기" 알림용: 회원별 카카오 토큰 저장
--
-- 이벤트 발생 시 각 회원 본인의 카카오로 메시지를 보내려면 그 회원의
-- access_token 이 필요하다. 만료되므로 refresh_token 도 함께 보관한다.
CREATE TABLE IF NOT EXISTS kakao_tokens (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 토큰은 민감정보. RLS 를 켜되 정책을 두지 않아 service_role(admin client)로만
-- 접근 가능하게 한다. (일반 사용자/anon 은 읽기/쓰기 불가)
ALTER TABLE kakao_tokens ENABLE ROW LEVEL SECURITY;
