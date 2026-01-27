import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if Supabase is not configured
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // 쿠키 설정 강화
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          );
        },
      },
    }
  );

  // getUser()로 실제 유효한 사용자인지 검증 (토큰 만료 등 체크)
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // 토큰이 만료되었거나 유효하지 않으면 쿠키 삭제
  if (userError || !user) {
    // 만료된 쿠키가 있으면 삭제
    const authCookies = request.cookies.getAll().filter(c =>
      c.name.includes('supabase') || c.name.includes('sb-')
    );

    if (authCookies.length > 0) {
      // 쿠키 삭제
      authCookies.forEach(({ name }) => {
        supabaseResponse.cookies.delete(name);
      });
    }
  }

  const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup');
  const isPendingPage = request.nextUrl.pathname.startsWith('/pending');

  // If user is not logged in and trying to access protected routes
  if (!user && !isAuthPage && !isPendingPage && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is logged in, check their role
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'pending';

    // If pending, redirect to pending page
    if (role === 'pending' && !isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/pending';
      return NextResponse.redirect(url);
    }

    // If not pending and on pending page, redirect to dashboard
    if (role !== 'pending' && isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // If not pending and on auth pages, redirect to dashboard
    if (role !== 'pending' && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
