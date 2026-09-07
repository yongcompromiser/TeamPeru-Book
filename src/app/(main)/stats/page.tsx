'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { CategoryDistribution } from '@/components/features/category-distribution';
import { cn } from '@/lib/utils';
import { Shield, Users, Calendar, BookOpen, UserCheck, ArrowUpDown, Tag } from 'lucide-react';
import { formatLateMinutes } from '@/lib/attendance';
import type { MemberSummary, OverallSummary } from '@/lib/stats';

// 표의 각 열. numeric 항목은 우측 정렬 + 헤더 클릭으로 내림차순 정렬한다.
type ColumnKey =
  | 'name'
  | 'participated'
  | 'late_count'
  | 'absent_count'
  | 'presenter_count'
  | 'discussion_count'
  | 'avg_rating'
  | 'rating_bias'
  | 'books_registered'
  | 'board_post_count'
  | 'comment_count'
  | 'activity_score';

interface Column {
  key: ColumnKey;
  label: string;
  hint?: string;
  render: (m: MemberSummary) => React.ReactNode;
  value: (m: MemberSummary) => number;
}

const columns: Column[] = [
  {
    key: 'participated',
    label: '참석',
    hint: '참석한 모임 횟수',
    render: (m) => `${m.participated}회`,
    value: (m) => m.participated,
  },
  {
    key: 'late_count',
    label: '지각',
    hint: '지각 횟수 (괄호는 지각한 날의 평균 지각 시간)',
    render: (m) => (
      <>
        {m.late_count}
        {m.avg_late_minutes !== null && (
          <span className="text-amber-600 text-xs ml-1">
            (평균 {formatLateMinutes(m.avg_late_minutes)})
          </span>
        )}
      </>
    ),
    value: (m) => m.late_count,
  },
  {
    key: 'absent_count',
    label: '불참',
    hint: '불참으로 기록된 횟수',
    render: (m) => m.absent_count,
    value: (m) => m.absent_count,
  },
  {
    key: 'presenter_count',
    label: '발제자',
    hint: '발제자를 맡은 횟수',
    render: (m) => `${m.presenter_count}회`,
    value: (m) => m.presenter_count,
  },
  {
    key: 'discussion_count',
    label: '발제 문항',
    hint: '작성한 발제 문항 총합',
    render: (m) => m.discussion_count,
    value: (m) => m.discussion_count,
  },
  {
    key: 'avg_rating',
    label: '평균 별점',
    hint: '모임에서 매긴 별점의 평균',
    render: (m) => (m.avg_rating === null ? '-' : m.avg_rating.toFixed(1)),
    value: (m) => m.avg_rating ?? -1,
  },
  {
    key: 'rating_bias',
    label: '평점 성향',
    hint: '모임 전체 평균 대비. 양수면 후한 편, 음수면 짠 편',
    render: (m) => {
      if (m.rating_bias === null) return '-';
      if (Math.abs(m.rating_bias) < 0.05) return <span className="text-gray-400">평균</span>;
      const up = m.rating_bias > 0;
      return (
        <span className={up ? 'text-rose-600' : 'text-sky-600'}>
          {up ? '+' : ''}
          {m.rating_bias.toFixed(1)}
        </span>
      );
    },
    value: (m) => m.rating_bias ?? -99,
  },
  {
    key: 'books_registered',
    label: '책 등록',
    hint: '등록한 책 수 (괄호는 선정된 수)',
    render: (m) => (
      <>
        {m.books_registered}
        {m.books_selected > 0 && (
          <span className="text-amber-600 text-xs ml-1">({m.books_selected})</span>
        )}
      </>
    ),
    value: (m) => m.books_registered,
  },
  {
    key: 'board_post_count',
    label: '게시글',
    render: (m) => m.board_post_count,
    value: (m) => m.board_post_count,
  },
  {
    key: 'comment_count',
    label: '댓글',
    render: (m) => m.comment_count,
    value: (m) => m.comment_count,
  },
  {
    key: 'activity_score',
    label: '영향력',
    hint: '참석·발제·한줄평·게시글·댓글·책등록을 가중 합산한 값',
    render: (m) => m.activity_score,
    value: (m) => m.activity_score,
  },
];

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

export default function StatsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  // 정회원이면 볼 수 있다. 게스트/가입대기는 모임 내부 기록이라 제외.
  const canView = profile?.role === 'member' || profile?.role === 'admin';

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [overall, setOverall] = useState<OverallSummary | null>(null);
  const [sortKey, setSortKey] = useState<ColumnKey>('activity_score');
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

  const sorted =
    sortKey === 'name'
      ? [...members].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      : [...members].sort((a, b) => {
          const col = columns.find((c) => c.key === sortKey);
          return col ? col.value(b) - col.value(a) : 0;
        });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">멤버 통계</h1>
        <p className="text-sm text-gray-500 mt-1">
          지난 모임 기준입니다. 참석은 모임 페이지에 발제·한줄평·별점 중 하나라도 제출한 경우로
          집계합니다. 열 제목을 누르면 정렬되고, 이름을 누르면 상세로 이동합니다.
        </p>
      </div>

      {overall && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <OverallCard title="멤버" value={overall.member_count} icon={Users} />
          <OverallCard title="지난 모임" value={overall.meeting_count} icon={Calendar} />
          <OverallCard title="함께 읽은 책" value={overall.book_count} icon={BookOpen} />
          <OverallCard title="누적 참석" value={overall.total_attendance} icon={UserCheck} />
        </div>
      )}

      {overall && overall.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-500" />
              우리가 읽은 분야
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDistribution categories={overall.categories} />
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            집계할 멤버가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {/* 멤버 열은 가로 스크롤 시에도 고정 */}
                  <th
                    onClick={() => setSortKey('name')}
                    className={cn(
                      'sticky left-0 z-10 bg-gray-50 text-left font-medium px-4 py-3 whitespace-nowrap cursor-pointer select-none border-r border-gray-200',
                      sortKey === 'name' ? 'text-amber-700' : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      멤버
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    </span>
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      title={col.hint}
                      onClick={() => setSortKey(col.key)}
                      className={cn(
                        'text-right font-medium px-4 py-3 whitespace-nowrap cursor-pointer select-none',
                        sortKey === col.key
                          ? 'text-amber-700'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, idx) => (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/stats/${m.id}`)}
                    className={cn(
                      'border-b border-gray-100 cursor-pointer hover:bg-amber-50/60 transition-colors',
                      idx % 2 === 1 && 'bg-gray-50/50'
                    )}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-10 px-4 py-3 whitespace-nowrap border-r border-gray-200',
                        idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Avatar src={m.avatar_url} name={m.name} size="xs" />
                        <span className="font-medium text-gray-900">{m.name}</span>
                        {m.role === 'admin' && (
                          <span className="text-[10px] text-blue-600">관리자</span>
                        )}
                      </span>
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-right tabular-nums whitespace-nowrap',
                          sortKey === col.key ? 'text-gray-900 font-semibold' : 'text-gray-700'
                        )}
                      >
                        {col.render(m)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
