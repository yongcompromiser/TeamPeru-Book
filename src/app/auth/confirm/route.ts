import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 메일로 보낸 로그인 링크를 여는 경로.
//
// 승인 안내 메일의 버튼이 여기로 온다. 메일 템플릿에서 아래 형태로 링크를 만든다.
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
//
// /auth/callback(=code 교환)과 달리 token_hash 는 PKCE code_verifier 가 필요 없다.
// 승인 메일은 "관리자 브라우저에서 발송 → 상대방 기기에서 클릭" 이라 기기가 다르고,
// code 방식은 발송한 브라우저의 쿠키에 있는 verifier 가 있어야 해서 이 경우 반드시 깨진다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') ?? 'magiclink';
  const next = searchParams.get('next') ?? '/dashboard';

  // 열린 리다이렉트 방지 — 사이트 내부 경로만 허용한다
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  // Vercel 프록시 뒤에서는 origin 이 내부 주소일 수 있어 forwarded host 를 우선한다
  const forwardedHost = request.headers.get('x-forwarded-host');
  const base =
    process.env.NODE_ENV !== 'development' && forwardedHost
      ? `https://${forwardedHost}`
      : origin;

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email_change',
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${base}${safeNext}`);
    }
    console.error('메일 링크 확인 실패:', error.message);
  }

  // 만료됐거나 이미 쓴 링크 — 비밀번호로 로그인하면 된다
  return NextResponse.redirect(`${base}/login?error=link_expired`);
}
