'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Shield,
  Users,
  Calendar,
  BookOpen,
  UserCheck,
  ChevronRight,
  Star,
  Mic,
} from 'lucide-react';
import type { MemberSummary, OverallSummary } from '@/lib/stats';

type SortKey = 'activity' | 'attend' | 'submit' | 'rating' | 'joined';

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'activity', label: '활동량' },
  { key: 'attend', label: '참여율' },
  { key: 'submit', label: '발제 작성률' },
  { key: 'rating', label: '평균 별점' },
  { key: 'joined', label: '가입순' },
];

function sortMembers(members: MemberSummary[], key: SortKey): MemberSummary[] {
  const sorted = [...members];
  switch (key) {
    case 'attend':
      return sorted.sort(
        (a, b) => (b.participation_rate ?? -1) - (a.participation_rate ?? -1)
      );
    case 'submit':
      return sorted.sort((a, b) => (b.discussion_rate ?? -1) - (a.discussion_rate ?? -1));
    case 'rating':
      return sorted.sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1));
    case 'joined':
      return sorted.sort(
        (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      );
    default:
      return sorted.sort((a, b) => b.activity_score - a.activity_score);
  }
}

function rateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-400';
  if (rate >= 80) return 'text-green-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-gray-500';
}

function OverallCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-50">
          <Icon className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// 비율 막대. 분모가 0이면(가입 직후 등) 값 대신 '-' 를 보여준다.
function RateBar({ label, rate, detail }: { label: string; rate: number | null; detail: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={cn('text-sm font-semibold', rateColor(rate))}>
          {rate === null ? '-' : `${rate}%`}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all"
          style={{ width: `${rate ?? 0}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1">{detail}</p>
    </div>
  );
}

export default function StatsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [overall, setOverall] = useState<OverallSummary | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('activity');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || '통계를 불러오지 못했습니다.');
        } else {
          setMembers(data.members || []);
          setOverall(data.overall || null);
        }
      } catch {
        if (!cancelled) setError('통계를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
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

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const sorted = sortMembers(members, sortKey);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">멤버 통계</h1>
        <p className="text-sm text-gray-500 mt-1">
          지난 모임 기준입니다. 참여는 모임 페이지에 발제·한줄평·별점 중 하나라도 제출한 경우로
          집계하며, 분모는 각 멤버가 가입한 이후에 열린 모임 수입니다.
        </p>
      </div>

      {overall && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <OverallCard title="멤버" value={overall.member_count} icon={Users} />
          <OverallCard title="지난 모임" value={overall.meeting_count} icon={Calendar} />
          <OverallCard title="함께 읽은 책" value={overall.book_count} icon={BookOpen} />
          <OverallCard title="누적 참여" value={overall.total_attendance} icon={UserCheck} />
        </div>
      )}

      {/* 정렬 */}
      <div className="flex flex-wrap gap-2">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortKey(opt.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              sortKey === opt.key
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            집계할 멤버가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((m) => (
            <Link key={m.id} href={`/stats/${m.id}`}>
              <Card className="h-full hover:border-amber-300 hover:shadow-md transition-all">
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={m.avatar_url} name={m.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                        {m.role === 'admin' && <Badge variant="info">관리자</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">
                        활동량 {m.activity_score}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>

                  <RateBar
                    label="참여율"
                    rate={m.participation_rate}
                    detail={`${m.participated} / ${m.attendable}회`}
                  />
                  <RateBar
                    label="발제 작성률"
                    rate={m.discussion_rate}
                    detail={`${m.discussion_submitted} / ${m.attendable}회`}
                  />

                  <div className="flex items-center gap-4 pt-1 border-t border-gray-100 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      {m.avg_rating === null ? '-' : m.avg_rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5 text-gray-400" />
                      발제자 {m.presenter_count}회
                    </span>
                    <span className="ml-auto text-gray-400">댓글 {m.comment_count}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
