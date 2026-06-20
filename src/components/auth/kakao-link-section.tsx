'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';

// 기존(이메일) 회원이 자기 계정에 카카오를 "추가 연결"하는 영역.
// 직접 구현한 흐름(/api/auth/kakao/start?mode=link)으로 이동하면 콜백에서
// 현재 계정의 profiles.kakao_id 에 카카오 id 를 매핑한다. 이후 카카오로 로그인하면
// 같은 계정으로 들어온다. 연결 여부는 profile.kakao_id 로 판단한다.
export function KakaoLinkSection() {
  const { profile, isLoading } = useAuth();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 콜백에서 ?linked / ?error 로 돌아오면 결과 메시지를 보여주고 URL 을 정리한다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('linked') === 'kakao') {
      setMessage({ type: 'success', text: '카카오 계정이 연결되었습니다.' });
      window.history.replaceState({}, '', '/profile');
    } else if (params.get('error')) {
      const text =
        params.get('error') === 'kakao_already_linked'
          ? '이미 다른 계정에 연결된 카카오입니다.'
          : '카카오 연결에 실패했습니다. 다시 시도해주세요.';
      setMessage({ type: 'error', text });
      window.history.replaceState({}, '', '/profile');
    }
  }, []);

  const kakaoLinked = !!profile?.kakao_id;
  // 카카오로만 가입한 계정(@kakao.local)은 해제하면 로그인 수단이 사라지므로 숨긴다
  const isKakaoOnly = (profile?.email ?? '').endsWith('@kakao.local');
  const canUnlink = kakaoLinked && !isKakaoOnly;

  const handleConnect = () => {
    setWorking(true);
    window.location.href = '/api/auth/kakao/start?mode=link';
  };

  const handleTestNotify = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch('/api/kakao/notify-self', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: 'success', text: '테스트 알림을 보냈어요! 카카오톡 "나와의 채팅"을 확인하세요.' });
      } else {
        setMessage({ type: 'error', text: data.error || '알림 전송에 실패했습니다.' });
      }
    } catch {
      setMessage({ type: 'error', text: '알림 전송 중 오류가 발생했습니다.' });
    }
    setWorking(false);
  };

  const handleUnlink = async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/kakao/unlink', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: data.error || '연결 해제에 실패했습니다.' });
        setWorking(false);
        return;
      }
      window.location.reload();
    } catch {
      setMessage({ type: 'error', text: '연결 해제 중 오류가 발생했습니다.' });
      setWorking(false);
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
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleTestNotify} disabled={working}>
              {working ? <Loader2 className="w-4 h-4 animate-spin" /> : '테스트 알림'}
            </Button>
            {canUnlink && (
              <Button type="button" variant="outline" size="sm" onClick={handleUnlink} disabled={working}>
                연결 해제
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleConnect}
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
