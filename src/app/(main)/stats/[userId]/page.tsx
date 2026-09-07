'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Shield,
  ArrowLeft,
  UserCheck,
  FileText,
  Star,
  Mic,
  BookOpen,
  MessageSquare,
  Calendar,
  ThumbsUp,
} from 'lucide-react';
import type { MemberDetail, ReadBook } from '@/lib/stats';

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 text-gray-500">
          <Icon className="w-4 h-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ratingComment(avg: number | null): string | null {
  if (avg === null) return null;
  if (avg >= 4.5) return '별점을 후하게 주는 편이에요';
  if (avg >= 3.5) return '무난하게 주는 편이에요';
  if (avg >= 2.5) return '조금 깐깐한 편이에요';
  return '별점에 인색한 편이에요';
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'w-3.5 h-3.5',
            n <= rating ? 'text-amber-500 fill-amber-500' : 'text-gray-200 fill-gray-200'
          )}
        />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating}점</span>
    </span>
  );
}

// 책 한 권 = 한 줄. 표지 옆에 그 모임에 남긴 별점·한줄평·발제문을 함께 보여준다.
function BookRow({ book }: { book: ReadBook }) {
  return (
    <div className="flex gap-4 py-4">
      <Link href={`/meetings/${book.schedule_id}`} className="shrink-0">
        <div className="w-16 aspect-[2/3] rounded-md overflow-hidden bg-gray-100 border border-gray-200">
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-1">
              <span className="text-[10px] text-gray-500 text-center line-clamp-4">
                {book.title}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={`/meetings/${book.schedule_id}`}
            className="font-semibold text-gray-900 hover:text-amber-700 truncate"
          >
            {book.title}
          </Link>
          <span className="text-xs text-gray-400 shrink-0">
            {format(new Date(book.meeting_date), 'yyyy.MM.dd')}
          </span>
        </div>
        {book.author && <p className="text-xs text-gray-500 -mt-1">{book.author}</p>}

        {book.rating ? (
          <Stars rating={book.rating} />
        ) : (
          <span className="text-xs text-gray-400">별점 없음</span>
        )}

        {book.one_liner && (
          <p className="text-sm text-gray-700 bg-amber-50/70 border border-amber-100 rounded-md px-3 py-2">
            “{book.one_liner}”
          </p>
        )}

        {book.discussions.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">
              발제문 {book.discussions.length}개
            </p>
            <ul className="space-y-1">
              {book.discussions.map((d, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-gray-400 shrink-0">{i + 1}.</span>
                  <span className="whitespace-pre-wrap">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-gray-400">발제문 없음</p>
        )}
      </div>
    </div>
  );
}

export default function MemberStatsPage() {
  const params = useParams();
  const userId = params.userId as string;
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [detail, setDetail] = useState<MemberDetail | null>(null);
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
        const res = await fetch(`/api/stats/${userId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || '통계를 불러오지 못했습니다.');
        } else {
          setDetail(data.detail);
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
  }, [isAdmin, userId]);

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

  if (error || !detail) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-red-600">{error ?? '데이터가 없습니다.'}</p>
        <Link href="/stats" className="text-sm text-amber-700 hover:underline">
          멤버 통계로 돌아가기
        </Link>
      </div>
    );
  }

  const { summary: s, monthly, rating_distribution, books, presented } = detail;
  const maxDist = Math.max(1, ...rating_distribution.map((d) => d.count));
  const comment = ratingComment(s.avg_rating);

  return (
    <div className="space-y-6">
      <Link
        href="/stats"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="w-4 h-4" />
        멤버 통계
      </Link>

      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Avatar src={s.avatar_url} name={s.name} size="lg" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{s.name}</h1>
            {s.role === 'admin' && <Badge variant="info">관리자</Badge>}
          </div>
          <p className="text-sm text-gray-500">
            {format(new Date(s.joined_at), 'yyyy년 M월 d일', { locale: ko })} 합류 · 대상 모임{' '}
            {s.attendable}회
          </p>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="참석"
          value={`${s.participated}회`}
          sub={`대상 모임 ${s.attendable}회`}
          icon={UserCheck}
        />
        <StatTile
          label="발제 문항"
          value={`${s.discussion_count}개`}
          sub={`한줄평 ${s.one_liner_count}회`}
          icon={FileText}
        />
        <StatTile
          label="평균 별점"
          value={s.avg_rating === null ? '-' : s.avg_rating.toFixed(1)}
          sub={`${s.rating_count}회 평가`}
          icon={Star}
        />
        <StatTile
          label="발제자 담당"
          value={`${s.presenter_count}회`}
          icon={Mic}
        />
      </div>

      {/* 월별 참여 추이 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            월별 참여 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">아직 지난 모임이 없습니다.</p>
          ) : (
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {monthly.map((m) => {
                const ratio = m.total > 0 ? m.participated / m.total : 0;
                return (
                  <div key={m.month} className="flex flex-col items-center gap-1 min-w-[44px]">
                    <span className="text-[11px] text-gray-500">
                      {m.participated}/{m.total}
                    </span>
                    <div className="w-8 h-24 bg-gray-100 rounded-md flex items-end overflow-hidden">
                      <div
                        className={cn(
                          'w-full rounded-md transition-all',
                          ratio >= 0.8 ? 'bg-green-400' : ratio > 0 ? 'bg-amber-400' : 'bg-gray-200'
                        )}
                        style={{ height: `${Math.max(ratio * 100, ratio > 0 ? 8 : 3)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {m.month.slice(2).replace('-', '.')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 별점 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              내가 준 별점 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.rating_count === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">아직 준 별점이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {[...rating_distribution].reverse().map((d) => (
                  <div key={d.rating} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-8 shrink-0">{d.rating}점</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${(d.count / maxDist) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right shrink-0">{d.count}</span>
                  </div>
                ))}
                {comment && <p className="text-xs text-gray-400 pt-2">{comment}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 기여 요약 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-gray-500" />
              기여 요약
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-600">
                  <BookOpen className="w-4 h-4 text-gray-400" />책 등록
                </dt>
                <dd className="font-semibold text-gray-900">
                  {s.books_registered}
                  {s.books_selected > 0 && (
                    <span className="text-xs font-normal text-amber-600 ml-1">
                      (선정 {s.books_selected})
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-600">
                  <MessageSquare className="w-4 h-4 text-gray-400" />게시글
                </dt>
                <dd className="font-semibold text-gray-900">{s.board_post_count}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-600">댓글</dt>
                <dd className="font-semibold text-gray-900">{s.comment_count}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-600">한줄평</dt>
                <dd className="font-semibold text-gray-900">{s.one_liner_count}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* 발제자 이력 */}
      {presented.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4 text-gray-500" />
              발제자를 맡은 모임 ({presented.length}회)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {presented.map((p) => (
                <li key={p.schedule_id}>
                  <Link
                    href={`/meetings/${p.schedule_id}`}
                    className="flex items-center justify-between text-sm py-1.5 hover:text-amber-700"
                  >
                    <span className="truncate">{p.title}</span>
                    <span className="text-xs text-gray-400 shrink-0 ml-3">
                      {format(new Date(p.meeting_date), 'yyyy.MM.dd')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 함께 읽은 책 — 참여한 모임만, 책 한 권당 한 줄 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-500" />
            함께 읽은 책 ({books.length}권)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {books.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">참여한 모임이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {books.map((b) => (
                <BookRow key={`${b.schedule_id}-${b.id}`} book={b} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
