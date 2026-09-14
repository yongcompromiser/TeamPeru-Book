-- 카카오 "나에게 보내기"(메시지) 기능 제거.
-- 메시지 발송용 토큰 저장 테이블은 더 이상 쓰이지 않으므로 삭제한다.
-- (카카오 로그인/OAuth 는 profiles.kakao_id 로 동작하며 이 테이블과 무관하다.)
DROP TABLE IF EXISTS kakao_tokens;
