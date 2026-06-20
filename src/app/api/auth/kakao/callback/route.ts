import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeKakaoCode, fetchKakaoUser } from '@/lib/kakao';

function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host')!;
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  return `${proto}://${host}`;
}

// 카카오 동의 후 돌아오는 콜백. 직접 토큰 교환 → 닉네임 조회 →
// Supabase 사용자와 매핑(kakao_id) 한 뒤 세션을 발급한다.
export async function GET(request: NextRequest) {
  const base = getBaseUrl(request);
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');

  // 쿠키에서 저장해둔 state/mode 읽기 (CSRF 방지)
  let mode: 'login' | 'link' = 'login';
  let savedState = '';
  const raw = request.cookies.get('kakao_oauth')?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      mode = parsed.mode === 'link' ? 'link' : 'login';
      savedState = parsed.state ?? '';
    } catch {
      /* ignore */
    }
  }

  const fail = (reason: string) => {
    const dest = mode === 'link' ? `${base}/profile?error=${reason}` : `${base}/login?error=${reason}`;
    const r = NextResponse.redirect(dest);
    r.cookies.delete('kakao_oauth');
    return r;
  };

  if (!code || !stateParam || stateParam !== savedState) {
    return fail('kakao_state');
  }

  try {
    const redirectUri = `${base}/api/auth/kakao/callback`;
    const accessToken = await exchangeKakaoCode(code, redirectUri);
    const kakaoUser = await fetchKakaoUser(accessToken);
    const kakaoId = kakaoUser.id;
    const admin = createAdminClient();

    // ── 연결(link) 모드: 로그인된 사용자 계정에 kakao_id 를 붙인다 ──
    if (mode === 'link') {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return fail('not_logged_in');

      // 이미 다른 사용자에게 연결된 카카오면 막는다
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('kakao_id', kakaoId)
        .maybeSingle();
      if (existing && existing.id !== user.id) return fail('kakao_already_linked');

      await admin.from('profiles').update({ kakao_id: kakaoId }).eq('id', user.id);

      const r = NextResponse.redirect(`${base}/profile?linked=kakao`);
      r.cookies.delete('kakao_oauth');
      return r;
    }

    // ── 로그인(login) 모드 ──
    // 1) kakao_id 로 기존 매핑 사용자 찾기
    const { data: linked } = await admin
      .from('profiles')
      .select('id, email')
      .eq('kakao_id', kakaoId)
      .maybeSingle();

    let email: string;
    if (linked) {
      email = linked.email;
    } else {
      // 2) 없으면 신규 카카오 사용자 생성 (이메일은 placeholder)
      email = `kakao_${kakaoId}@kakao.local`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: kakaoUser.nickname, kakao_id: kakaoId, provider: 'kakao' },
      });

      let userId = created?.user?.id;
      if (!userId) {
        // 이미 auth 유저가 있는 부분 생성 상태 → 이메일로 프로필 조회
        const { data: byEmail } = await admin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (!byEmail) throw new Error(createErr?.message ?? '사용자 생성 실패');
        userId = byEmail.id;
      }

      // 프로필 보장 + kakao_id 매핑 (트리거 유무와 무관하게 동작하도록 upsert)
      // role 은 페이로드에 없으므로 신규는 DB 기본값(pending), 기존은 유지된다.
      await admin
        .from('profiles')
        .upsert({ id: userId, email, name: kakaoUser.nickname, kakao_id: kakaoId }, { onConflict: 'id' });
    }

    // 3) 세션 발급: magiclink 토큰 생성 → 서버에서 verifyOtp 로 쿠키 세션 설정
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      throw new Error(linkErr?.message ?? '세션 발급 실패');
    }

    const supabase = await createClient();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    });
    if (verifyErr) throw new Error(verifyErr.message);

    const r = NextResponse.redirect(`${base}/dashboard`);
    r.cookies.delete('kakao_oauth');
    return r;
  } catch (e) {
    console.error('Kakao callback error:', e);
    return fail('kakao_failed');
  }
}
