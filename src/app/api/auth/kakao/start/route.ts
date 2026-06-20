import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { buildKakaoAuthorizeUrl, kakaoConfigured } from '@/lib/kakao';

// 배포(Vercel 프록시) 환경에서도 올바른 외부 URL 을 구한다.
function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host')!;
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  return `${proto}://${host}`;
}

// 카카오 로그인 시작점. 카카오 동의 화면으로 리다이렉트한다.
//  - mode=login (기본): 로그인/가입
//  - mode=link        : 로그인된 사용자가 카카오를 자기 계정에 연결
export async function GET(request: NextRequest) {
  const base = getBaseUrl(request);

  if (!kakaoConfigured()) {
    return NextResponse.redirect(`${base}/login?error=kakao_not_configured`);
  }

  const mode = request.nextUrl.searchParams.get('mode') === 'link' ? 'link' : 'login';
  const state = randomUUID();
  const redirectUri = `${base}/api/auth/kakao/callback`;

  const res = NextResponse.redirect(buildKakaoAuthorizeUrl(redirectUri, state));
  // state 와 mode 를 httpOnly 쿠키에 저장 → 콜백에서 CSRF 검증 + 분기
  res.cookies.set('kakao_oauth', JSON.stringify({ state, mode }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10분
  });
  return res;
}
