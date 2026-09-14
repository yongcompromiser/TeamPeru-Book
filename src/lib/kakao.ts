// 카카오 OAuth(로그인) 직접 구현용 헬퍼 (서버 전용).
//
// Supabase 내장 카카오 provider 는 account_email 스코프를 강제해 KOE205 가 나므로
// 카카오 API 를 직접 호출한다. 로그인 시 닉네임(profile_nickname) 동의만 받는다.

const KAKAO_AUTH_BASE = 'https://kauth.kakao.com';
const KAKAO_API_BASE = 'https://kapi.kakao.com';

// 로그인 시 요청할 스코프 (닉네임만).
export const KAKAO_LOGIN_SCOPES = 'profile_nickname';

export function kakaoConfigured(): boolean {
  return !!process.env.KAKAO_REST_API_KEY;
}

export function buildKakaoAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: KAKAO_LOGIN_SCOPES,
    state,
  });
  return `${KAKAO_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

export interface KakaoTokens {
  accessToken: string;
  refreshToken: string | null; // 갱신 시에는 없을 수 있음(기존 것 유지)
  expiresIn: number; // access token 만료까지 초
  refreshTokenExpiresIn: number | null;
}

function parseTokens(json: Record<string, unknown>): KakaoTokens {
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) ?? null,
    expiresIn: (json.expires_in as number) ?? 0,
    refreshTokenExpiresIn: (json.refresh_token_expires_in as number) ?? null,
  };
}

// 인가 코드 → 토큰 교환
export async function exchangeKakaoCode(code: string, redirectUri: string): Promise<KakaoTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: redirectUri,
    code,
  });
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
  return parseTokens(await res.json());
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
