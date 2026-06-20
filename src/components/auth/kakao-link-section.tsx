'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';

// 기존(이메일) 회원이 자기 계정에 카카오를 "추가 연결"하는 영역.
// 로그인된 상태에서 linkIdentity 를 호출하면 새 계정이 생기지 않고
// 현재 계정에 카카오 identity 가 붙어, 이후 이메일/카카오 둘 다로 로그인할 수 있다.
//
// 연결 상태는 별도 네트워크 호출(getUserIdentities) 대신 이미 로그인 세션에
// 들어있는 user.identities 를 그대로 읽는다. (네트워크 호출은 간헐적으로 멈춰
// "불러오는 중..." 스피너에서 빠져나오지 못하는 문제가 있었다)
export function KakaoLinkSection() {
  const supabase = createClient();
  const { user, isLoading } = useAuth();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const identities = user?.identities ?? [];
  const kakaoIdentity = identities.find((i) => i.provider === 'kakao');
  const kakaoLinked = !!kakaoIdentity;
  // 카카오 연결만 있고 다른 로그인 수단이 없으면 해제 불가(로그인 수단이 사라짐)
  const canUnlink = kakaoLinked && identities.length > 1;

  const handleLink = async () => {
    setWorking(true);
    setMessage(null);
    // 카카오 동의 화면으로 리다이렉트 → /auth/callback 에서 세션 교환 후 /profile 로 복귀
    const { error } = await supabase.auth.linkIdentity({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
        scopes: 'profile_nickname',
      },
    });
    // 성공 시 카카오로 리다이렉트되므로 아래는 보통 실행되지 않음
    if (error) {
      setMessage({ type: 'error', text: `연결에 실패했습니다: ${error.message}` });
      setWorking(false);
    }
  };

  const handleUnlink = async () => {
    if (!kakaoIdentity) return;
    setWorking(true);
    setMessage(null);
    const { error } = await supabase.auth.unlinkIdentity(kakaoIdentity);
    if (error) {
      setMessage({ type: 'error', text: `연결 해제에 실패했습니다: ${error.message}` });
      setWorking(false);
    } else {
      // 세션의 user.identities 를 갱신하기 위해 페이지를 새로고침한다.
      window.location.reload();
    }
  };

  return (
    <div className="border-t border-gray-100 pt-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">소셜 로그인 연결</label>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm mb-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
        </div>
      ) : kakaoLinked ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-gray-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FEE500]">
              <Check className="w-4 h-4 text-[#191600]" />
            </span>
            카카오 계정이 연결되어 있습니다
          </span>
          {canUnlink && (
            <Button type="button" variant="outline" size="sm" onClick={handleUnlink} disabled={working}>
              {working ? <Loader2 className="w-4 h-4 animate-spin" /> : '연결 해제'}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleLink}
            disabled={working}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] px-4 text-sm font-medium text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:self-start sm:px-6"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                fill="#191600"
                d="M12 3C6.477 3 2 6.477 2 10.8c0 2.77 1.86 5.2 4.66 6.58-.2.72-.74 2.66-.85 3.07-.13.51.19.5.4.37.16-.11 2.6-1.77 3.66-2.49.69.1 1.4.16 2.13.16 5.523 0 10-3.477 10-7.69C24 6.477 17.523 3 12 3Z"
              />
            </svg>
            {working ? '연결 중...' : '카카오 계정 연결하기'}
          </button>
          <p className="text-xs text-gray-400">
            연결하면 다음부터 이메일·카카오 둘 다로 로그인할 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}
