'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 카카오 OAuth 로그인 버튼. Supabase 내장 'kakao' provider 사용.
// 클릭 → 카카오 동의 → Supabase 콜백 → /auth/callback 에서 세션 교환.
export function KakaoLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        // 카카오 로그인 후 돌아올 곳. 신규 가입자는 pending → /pending 으로 안내된다.
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        // 카카오 앱에 활성화된 동의항목만 요청한다. (이메일/프로필사진 권한이 없으면
        // 요청 시 KOE205 에러가 나므로 닉네임만 요청)
        scopes: 'profile_nickname',
      },
    });
    // 성공 시 카카오로 리다이렉트되므로 이 아래는 보통 실행되지 않음
    if (error) setIsLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleKakaoLogin}
      disabled={isLoading}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] px-4 text-sm font-medium text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {/* 카카오 말풍선 아이콘 */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          fill="#191600"
          d="M12 3C6.477 3 2 6.477 2 10.8c0 2.77 1.86 5.2 4.66 6.58-.2.72-.74 2.66-.85 3.07-.13.51.19.5.4.37.16-.11 2.6-1.77 3.66-2.49.69.1 1.4.16 2.13.16 5.523 0 10-3.477 10-7.69C24 6.477 17.523 3 12 3Z"
        />
      </svg>
      {isLoading ? '연결 중...' : '카카오로 시작하기'}
    </button>
  );
}
