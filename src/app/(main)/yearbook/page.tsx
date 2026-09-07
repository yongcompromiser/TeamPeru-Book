'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Sparkles, ChevronRight } from 'lucide-react';
import { getTheme } from '@/lib/yearbook-themes';
import { cn } from '@/lib/utils';

// 테마 강조색의 실제 hex (배경 연출용)
const ACCENT_HEX: Record<string, string> = {
  midnight: '#fbbf24',
  paper: '#f59e0b',
  neon: '#e879f9',
  forest: '#34d399',
};

interface YearItem {
  year: number;
  meeting_count: number;
  title: string | null;
  theme: string | null;
  has_review: boolean;
}

export default function YearbookListPage() {
  const { profile } = useAuth();
  const canView = profile?.role === 'member' || profile?.role === 'admin';

  const [years, setYears] = useState<YearItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/yearbook');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error || '불러오지 못했습니다.');
        else setYears(data.years || []);
      } catch {
        if (!cancelled) setError('불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  if (!canView) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">정회원만 볼 수 있습니다</p>
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

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">연말결산</h1>
        <p className="text-sm text-gray-500 mt-1">
          그 해에 읽은 책, 평점, 참여, 시상을 모아봅니다. 기록에서 자동으로 만들어집니다.
        </p>
      </div>

      {years.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            아직 지난 모임이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((y, i) => {
            const theme = getTheme(y.theme);
            return (
              <Link
                key={y.year}
                href={`/yearbook/${y.year}`}
                className="group animate-fade-up"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {/* 그 해 테마를 그대로 미리 보여준다 */}
                <div
                  className={cn(
                    'relative h-44 rounded-2xl overflow-hidden border border-black/5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl',
                    theme.heroBg
                  )}
                >
                  <div
                    className="animate-blob absolute -top-10 -right-8 w-56 h-56 rounded-full blur-3xl opacity-40"
                    style={{
                      background: `radial-gradient(circle, ${ACCENT_HEX[theme.key] ?? '#fbbf24'} 0%, transparent 65%)`,
                    }}
                  />
                  <div className="relative h-full p-5 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <Sparkles className={cn('w-5 h-5', theme.accent)} />
                      <ChevronRight
                        className={cn(
                          'w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all',
                          theme.textMuted
                        )}
                      />
                    </div>
                    <div>
                      <p
                        className={cn(
                          'text-4xl font-black bg-clip-text text-transparent',
                          theme.heroNumber
                        )}
                      >
                        {y.year}
                      </p>
                      <p className={cn('text-sm mt-1 truncate', theme.textMuted)}>
                        {y.title ?? `모임 ${y.meeting_count}회`}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
