import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// OAuth(카카오 등) 콜백: Supabase가 code와 함께 이 경로로 돌려보내면
// code를 세션(쿠키)으로 교환한 뒤 원래 가려던 곳으로 리다이렉트한다.
// 신규 가입자는 profiles.role 이 'pending' 이라 /dashboard 진입 시
// MainLayout 이 /pending 으로 다시 안내한다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Vercel 프록시 뒤에서는 origin이 내부 주소일 수 있어 forwarded host 우선 사용
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // 실패 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
