'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { CategoryDistribution } from '@/components/features/category-distribution';
import { cn } from '@/lib/utils';
import {
  Shield,
  ArrowLeft,
  Trophy,
  BookOpen,
  Users,
  Star,
  Mic,
  Pencil,
  Check,
  X,
  Tag,
} from 'lucide-react';
import type { YearBook } from '@/lib/yearbook';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'w-3.5 h-3.5',
            n <= Math.round(rating)
              ? 'text-amber-500 fill-amber-500'
              : 'text-gray-200 fill-gray-200'
          )}
        />
      ))}
      <span className="text-xs text-gray-600 ml-1 font-medium">{rating}</span>
    </span>
  );
}

export default function YearbookDetailPage() {
  const params = useParams();
  const year = params.year as string;
  const { profile } = useAuth();
  const canView = profile?.role === 'member' || profile?.role === 'admin';

  const [data, setData] = useState<YearBook | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [introInput, setIntroInput] = useState('');
  const [highlightsInput, setHighlightsInput] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`/api/yearbook/${year}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '불러오지 못했습니다.');
      } else {
        setData(json.yearbook);
        setCanEdit(!!json.canEdit);
        setTitleInput(json.yearbook.title ?? '');
        setIntroInput(json.yearbook.intro ?? '');
        setHighlightsInput(json.yearbook.highlights ?? '');
      }
    } catch {
      setError('불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, year]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/yearbook/${year}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput,
          intro: introInput,
          highlights: highlightsInput,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || '저장에 실패했습니다.');
        return;
      }
      setIsEditing(false);
      await load();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <Link
        href="/yearbook"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="w-4 h-4" />
        연말결산
      </Link>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {data.title || `TEAM PERU ${data.year} 연말결산`}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            모임 {data.meeting_count}회 · 함께 읽은 책 {data.book_count}권
          </p>
        </div>
        {canEdit && !isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="w-4 h-4 mr-1" />
            총평 편집
          </Button>
        )}
      </div>

      {/* 총평 편집 */}
      {isEditing ? (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="text-base">총평 편집</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder={`TEAM PERU ${data.year} 연말결산`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">총평</label>
              <Textarea
                value={introInput}
                onChange={(e) => setIntroInput(e.target.value)}
                rows={6}
                placeholder="올해를 한 문단으로. 줄바꿈은 그대로 반영됩니다."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                에피소드 · 뒷이야기
              </label>
              <Textarea
                value={highlightsInput}
                onChange={(e) => setHighlightsInput(e.target.value)}
                rows={10}
                placeholder="기록에서 자동으로 나오지 않는 것들 — 그날의 사건, 명언, 뒷이야기"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} isLoading={isSaving}>
                <Check className="w-4 h-4 mr-1" />
                저장
              </Button>
              <Button
                variant="outline"
                disabled={isSaving}
                onClick={() => {
                  setIsEditing(false);
                  setTitleInput(data.title ?? '');
                  setIntroInput(data.intro ?? '');
                  setHighlightsInput(data.highlights ?? '');
                }}
              >
                <X className="w-4 h-4 mr-1" />
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        (data.intro || data.highlights) && (
          <Card>
            <CardContent className="space-y-4">
              {data.intro && (
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{data.intro}</p>
              )}
              {data.highlights && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-500 mb-2">에피소드 · 뒷이야기</p>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                    {data.highlights}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* 시상 */}
      {data.awards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              올해의 기록
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.awards.map((a) => (
                <div
                  key={a.key}
                  className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3"
                >
                  <p className="text-xs text-amber-700 font-medium">{a.label}</p>
                  <p className="text-gray-900 font-semibold truncate">{a.winner}</p>
                  <p className="text-xs text-gray-500">{a.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 멤버 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            멤버별 기록
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="text-left font-medium py-2">멤버</th>
                <th className="text-right font-medium py-2 px-3">참석</th>
                <th className="text-right font-medium py-2 px-3">발제자</th>
                <th className="text-right font-medium py-2 px-3">발제 문항</th>
                <th className="text-right font-medium py-2 px-3">평균 별점</th>
                <th className="text-right font-medium py-2 px-3">지각</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2">
                    <Link
                      href={`/stats/${m.id}`}
                      className="flex items-center gap-2 hover:text-amber-700"
                    >
                      <Avatar src={m.avatar_url} name={m.name} size="xs" />
                      <span className="font-medium text-gray-900">{m.name}</span>
                    </Link>
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    {m.participated}
                    <span className="text-gray-400"> / {m.attendable}</span>
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">{m.presenter_count}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{m.discussion_count}</td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    {m.avg_rating === null ? '-' : m.avg_rating.toFixed(1)}
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">{m.late_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 분야 분포 */}
      {data.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-500" />
              읽은 분야
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDistribution categories={data.categories} />
          </CardContent>
        </Card>
      )}

      {/* 책별 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-500" />
            {data.year}년에 읽은 책
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {data.entries.map((e) => (
              <div key={e.schedule_id} className="flex gap-4 py-4">
                <Link href={`/meetings/${e.schedule_id}`} className="shrink-0">
                  <div className="w-16 aspect-[2/3] rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                    {e.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.cover_url} alt={e.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-1">
                        <span className="text-[10px] text-gray-500 text-center line-clamp-4">
                          {e.title}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/meetings/${e.schedule_id}`}
                      className="font-semibold text-gray-900 hover:text-amber-700 truncate"
                    >
                      {e.title}
                    </Link>
                    <span className="text-xs text-gray-400 shrink-0">
                      {format(new Date(e.meeting_date), 'M월 d일')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {e.presenter_name && (
                      <span className="inline-flex items-center gap-1">
                        <Mic className="w-3 h-3" />
                        {e.presenter_name}
                      </span>
                    )}
                    {e.category && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                        <Tag className="w-2.5 h-2.5" />
                        {e.category}
                      </span>
                    )}
                    {e.avg_rating !== null && <Stars rating={e.avg_rating} />}
                  </div>

                  {e.one_liners.length > 0 && (
                    <ul className="space-y-1">
                      {e.one_liners.map((o, i) => (
                        <li key={i} className="text-sm text-gray-700">
                          <span className="text-gray-400">{o.name}</span>
                          {o.rating !== null && (
                            <span className="text-amber-600 text-xs"> {o.rating}점</span>
                          )}
                          <span className="text-gray-300"> · </span>
                          {o.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
