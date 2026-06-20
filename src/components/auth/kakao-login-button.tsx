'use client';

import { useState } from 'react';

// 카카오 OAuth 로그인 버튼.
// Supabase 내장 provider 대신 직접 구현한 흐름(/api/auth/kakao/start)으로 이동한다.
// → 카카오 동의(닉네임) → /api/auth/kakao/callback 에서 세션 발급 → /dashboard
export function KakaoLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleKakaoLogin = () => {
    setIsLoading(true);
    window.location.href = '/api/auth/kakao/start';
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
