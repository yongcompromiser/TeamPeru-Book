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

  // 중요: getUser() 전에 getSession()을 호출하여 토큰 갱신
  const { data: { session } } = await supabase.auth.getSession();

  // 세션이 있으면 getUser()로 검증
  let user = session?.user ?? null;
  if (session) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
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
