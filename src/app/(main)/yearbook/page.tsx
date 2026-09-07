'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Sparkles, ChevronRight } from 'lucide-react';

interface YearItem {
  year: number;
  meeting_count: number;
  title: string | null;
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((y) => (
            <Link key={y.year} href={`/yearbook/${y.year}`}>
              <Card className="h-full hover:border-amber-300 hover:shadow-md transition-all">
                <CardContent className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-amber-50">
                    <Sparkles className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold text-gray-900">{y.year}년</p>
                    <p className="text-sm text-gray-500 truncate">
                      {y.title ?? `모임 ${y.meeting_count}회`}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
