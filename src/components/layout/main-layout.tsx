'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (!isLoading && user && profile?.role === 'pending') {
      router.push('/pending');
    }
  }, [isLoading, user, profile, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (profile?.role === 'pending') {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  const isGuest = profile?.role === 'guest';

  // profile이 null이어도 user가 있으면 보여주기 (프로필 조회 실패 케이스)
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      {isGuest && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
          👋 <b>게스트 모드</b>예요. 초대받은 모임에 발제·한줄평·평점을 남길 수 있어요.
          일정·책 투표와 책 등록은 정회원부터예요.
          <a href="/profile" className="ml-2 font-semibold underline hover:text-amber-900">정회원 신청</a>
        </div>
      )}
      <div className="flex">
        <Sidebar
          profile={profile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {/* min-w-0: 내부에 넓은 콘텐츠(마퀴 등)가 있어도 flex 아이템이 줄어들어
            가로 스크롤/사이드바 눌림이 생기지 않게 한다 */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
