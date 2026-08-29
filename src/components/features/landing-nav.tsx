'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 랜딩 상단 네비.
 * - 최상단(다크 히어로 위): 투명 배경 + 흰색 글자 → 몰입형 배경과 이어짐
 * - 스크롤 내리면: 밝은 바 + 어두운 글자 → 아래 밝은 섹션에서 가독성 유지
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'bg-[#faf8f5]/90 backdrop-blur-md border-b border-amber-100/50'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-6 py-4">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span
              className={`text-xl font-bold transition-colors ${
                scrolled
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent'
                  : 'text-white'
              }`}
            >
              팀 페루
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                className={scrolled ? 'text-gray-600' : 'text-white hover:bg-white/10'}
              >
                로그인
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-indigo-900/20">
                시작하기
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
