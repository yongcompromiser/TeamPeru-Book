'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { YearBackdrop } from '@/components/features/year-backdrop';
import { getTheme } from '@/lib/yearbook-themes';
import { cn } from '@/lib/utils';
import { Shield, ArrowLeft, Play, LayoutList, ChevronRight } from 'lucide-react';
import type { YearBook } from '@/lib/yearbook';

const ACCENT_HEX: Record<string, string> = {
  midnight: '#fbbf24',
  paper: '#f59e0b',
  neon: '#e879f9',
  forest: '#34d399',
};

export default function YearbookChooserPage() {
  const params = useParams();
  const year = params.year as string;
  const { profile } = useAuth();
  const canView = profile?.role === 'admin';

  const [data, setData] = useState<YearBook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/yearbook/${year}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(json.error || '불러오지 못했습니다.');
        else setData(json.yearbook);
      } catch {
        if (!cancelled) setError('불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, year]);

  if (!canView) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">관리자만 접근할 수 있습니다</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-red-600">{error ?? '데이터가 없습니다.'}</p>
        <Link href="/yearbook" className="text-sm text-amber-700 hover:underline">
          연말결산으로 돌아가기
        </Link>
      </div>
    );
  }

  const theme = getTheme(data.theme);
  const accentHex = ACCENT_HEX[theme.key] ?? '#fbbf24';

  const options = [
    {
      href: `/yearbook/${year}/slides`,
      icon: Play,
      title: '슬라이드로 보기',
      desc: '시상식처럼 한 장씩. 다 넘기면 한눈에 보기로 이어집니다.',
      badge: '발표용',
      primary: true,
    },
    {
      href: `/yearbook/${year}/overview`,
      icon: LayoutList,
      title: '한눈에 보기',
      desc: '스크롤 한 번으로 그 해 기록을 전부 훑어봅니다.',
      badge: null,
      primary: false,
    },
  ];

  return (
    <div
      className={cn(
        '-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 -mb-6 min-h-screen flex flex-col',
        theme.pageBg
      )}
    >
      <section className={cn('relative flex-1 flex flex-col overflow-hidden', theme.heroBg)}>
        <YearBackdrop kind={theme.backdrop} accentHex={accentHex} />

        <div className="relative flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto w-full">
          <Link
            href="/yearbook"
            className={cn(
              'inline-flex items-center gap-1 text-sm opacity-70 hover:opacity-100 transition-opacity',
              theme.textMuted
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            연말결산
          </Link>

          <div className="flex-1 flex flex-col justify-center py-10">
            <div className="text-center">
              <p
                className={cn(
                  'text-6xl sm:text-8xl font-black tracking-tight bg-clip-text text-transparent animate-fade-up',
                  theme.heroNumber
                )}
              >
                {data.year}
              </p>
              <h1
                className={cn('mt-2 text-lg sm:text-2xl font-bold animate-fade-up', theme.text)}
                style={{ animationDelay: '120ms' }}
              >
                {data.title || 'TEAM PERU 연말결산'}
              </h1>
              <p
                className={cn('mt-2 text-sm animate-fade-up', theme.textMuted)}
                style={{ animationDelay: '200ms' }}
              >
                모임 {data.meeting_count}회 · 함께 읽은 책 {data.book_count}권
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {options.map((o, i) => (
                <Link
                  key={o.href}
                  href={o.href}
                  className="group animate-fade-up"
                  style={{ animationDelay: `${320 + i * 100}ms` }}
                >
                  <div
                    className={cn(
                      'h-full rounded-2xl border p-6 transition-all duration-300 group-hover:-translate-y-1',
                      theme.card,
                      theme.cardHover,
                      o.primary && 'ring-1 ring-inset',
                      o.primary && theme.accentSoft
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <o.icon className={cn('w-7 h-7', theme.accent)} />
                      {o.badge && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                            theme.accentSoft
                          )}
                        >
                          {o.badge}
                        </span>
                      )}
                    </div>
                    <p className={cn('mt-4 text-lg font-bold', theme.text)}>{o.title}</p>
                    <p className={cn('mt-1 text-sm leading-relaxed', theme.textMuted)}>{o.desc}</p>
                    <span
                      className={cn(
                        'mt-4 inline-flex items-center gap-1 text-sm font-medium',
                        theme.accent
                      )}
                    >
                      시작
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
