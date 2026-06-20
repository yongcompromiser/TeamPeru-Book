// 카카오 OAuth 직접 구현용 헬퍼 (서버 전용).
//
// Supabase 내장 카카오 provider 는 account_email / profile_image 스코프를 강제로
// 요청하는데, 이메일은 카카오 비즈니스 인증이 있어야 켤 수 있어 KOE205 가 난다.
// 그래서 카카오 API 를 직접 호출해 "닉네임(profile_nickname)" 만 요청한다.

const KAKAO_AUTH_BASE = 'https://kauth.kakao.com';
const KAKAO_API_BASE = 'https://kapi.kakao.com';

export function kakaoConfigured(): boolean {
  return !!process.env.KAKAO_REST_API_KEY;
}

export function buildKakaoAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'profile_nickname', // 닉네임만! (이메일/프로필사진 요청 안 함)
    state,
  });
  return `${KAKAO_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

// 인가 코드 → 액세스 토큰 교환
export async function exchangeKakaoCode(code: string, redirectUri: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: redirectUri,
    code,
  });
  // 카카오 앱에서 Client Secret 을 "사용함" 으로 켰다면 필수
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch(`${KAKAO_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  if (!res.ok) {
    throw new Error(`카카오 토큰 교환 실패 (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

export interface KakaoUser {
  id: string;
  nickname: string;
}

// 액세스 토큰으로 카카오 사용자 정보 조회 (id + 닉네임)
export async function fetchKakaoUser(accessToken: string): Promise<KakaoUser> {
  const res = await fetch(`${KAKAO_API_BASE}/v2/user/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`카카오 사용자 조회 실패 (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const nickname =
    json?.kakao_account?.profile?.nickname ??
    json?.properties?.nickname ??
    '카카오사용자';
  return { id: String(json.id), nickname };
}
