'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Reveal, CountUp } from '@/components/features/reveal';
import { YearBackdrop } from '@/components/features/year-backdrop';
import { getTheme, isDarkTheme, YEAR_THEMES } from '@/lib/yearbook-themes';
import { cn } from '@/lib/utils';
import { Shield, ArrowLeft, Trophy, Star, Mic, Pencil, Check, X } from 'lucide-react';
import type { YearBook } from '@/lib/yearbook';

// 테마 강조색의 실제 hex (배경 연출용 — Tailwind 클래스로는 넘길 수 없다)
const ACCENT_HEX: Record<string, string> = {
  midnight: '#fbbf24',
  paper: '#f59e0b',
  neon: '#e879f9',
  forest: '#34d399',
};

function Stars({ rating, dark }: { rating: number; dark: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'w-3.5 h-3.5',
            n <= Math.round(rating)
              ? 'text-amber-400 fill-amber-400'
              : dark
                ? 'text-white/15 fill-white/15'
                : 'text-stone-200 fill-stone-200'
          )}
        />
      ))}
      <span className="text-xs ml-1 font-semibold opacity-80">{rating}</span>
    </span>
  );
}

export default function YearbookDetailPage() {
  const params = useParams();
  const year = params.year as string;
  const { profile } = useAuth();
  // 연말결산은 아직 다듬는 중이라 관리자에게만 보인다.
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
  const [themeInput, setThemeInput] = useState('midnight');
  const [publishedInput, setPublishedInput] = useState(false);

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
        setThemeInput(json.yearbook.theme ?? 'midnight');
        setPublishedInput(json.yearbook.is_published === true);
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
          theme: themeInput,
          is_published: publishedInput,
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
        <Link href={`/yearbook/${year}`} className="text-sm text-amber-700 hover:underline">
          다시 선택하기
        </Link>
      </div>
    );
  }

  // 편집 중에는 고른 테마를 즉시 미리보기
  const theme = getTheme(isEditing ? themeInput : data.theme);
  const dark = isDarkTheme(theme);
  const accentHex = ACCENT_HEX[theme.key] ?? '#fbbf24';

  return (
    // 사이드바 안쪽 여백을 벗어나 화면 끝까지 채운다
    <div
      className={cn(
        '-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 -mb-6 min-h-screen',
        theme.pageBg,
        'transition-colors duration-500'
      )}
    >
      {/* ── 히어로 ── */}
      <section className={cn('relative overflow-hidden', theme.heroBg)}>
        <YearBackdrop kind={theme.backdrop} accentHex={accentHex} />

        <div className="relative px-4 sm:px-6 lg:px-8 pt-8 pb-16 sm:pb-24 max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/yearbook/${year}`}
              className={cn(
                'inline-flex items-center gap-1 text-sm hover:opacity-100 transition-opacity opacity-70',
                theme.textMuted
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              연말결산
            </Link>
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors',
                  theme.accentSoft
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
                편집
              </button>
            )}
          </div>

          <div className="mt-10 sm:mt-16 text-center">
            <p
              className={cn(
                'text-6xl sm:text-8xl lg:text-9xl font-black tracking-tight bg-clip-text text-transparent animate-fade-up',
                theme.heroNumber
              )}
            >
              {data.year}
            </p>
            <h1
              className={cn(
                'mt-2 text-xl sm:text-3xl font-bold animate-fade-up',
                theme.text
              )}
              style={{ animationDelay: '120ms' }}
            >
              {data.title || 'TEAM PERU 연말결산'}
            </h1>

            {/* 수치 */}
            <div
              className="mt-10 grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto animate-fade-up"
              style={{ animationDelay: '240ms' }}
            >
              {[
                { label: '모임', value: data.meeting_count, unit: '회' },
                { label: '읽은 책', value: data.book_count, unit: '권' },
                { label: '함께한 멤버', value: data.members.length, unit: '명' },
              ].map((s) => (
                <div key={s.label}>
                  <p className={cn('text-3xl sm:text-5xl font-bold', theme.accent)}>
                    <CountUp value={s.value} />
                    <span className="text-base sm:text-2xl font-medium opacity-70">{s.unit}</span>
                  </p>
                  <p className={cn('text-xs sm:text-sm mt-1', theme.textMuted)}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto pb-24 space-y-16 -mt-8 relative">
        {/* ── 편집 ── */}
        {isEditing && (
          <div className={cn('rounded-2xl border p-5 space-y-4', theme.card)}>
            <p className={cn('font-semibold', theme.text)}>결산 편집</p>

            {/* 공개 여부 — 체크해야 멤버에게 보인다 */}
            <button
              type="button"
              onClick={() => setPublishedInput((v) => !v)}
              className={cn(
                'w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                publishedInput ? theme.accentSoft : cn(theme.card, theme.textMuted)
              )}
            >
              <span>
                <span className={cn('block text-sm font-medium', publishedInput ? '' : theme.text)}>
                  {publishedInput ? '멤버에게 공개 중' : '비공개 (관리자만)'}
                </span>
                <span className="block text-xs opacity-70 mt-0.5">
                  {publishedInput
                    ? '정회원이 목록에서 이 해를 볼 수 있어요.'
                    : '다 다듬은 뒤 켜면 정회원에게 열립니다.'}
                </span>
              </span>
              <span
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                  publishedInput ? 'bg-green-500' : dark ? 'bg-white/20' : 'bg-stone-300'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                    publishedInput ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </span>
            </button>

            <div>
              <label className={cn('block text-sm mb-2', theme.textMuted)}>테마</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {YEAR_THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setThemeInput(t.key)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-all',
                      themeInput === t.key
                        ? theme.accentSoft
                        : cn(theme.card, theme.cardHover, theme.textMuted)
                    )}
                  >
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-[11px] opacity-70 mt-0.5">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={cn('block text-sm mb-1', theme.textMuted)}>제목</label>
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder={`TEAM PERU ${data.year} 연말결산`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className={cn('block text-sm mb-1', theme.textMuted)}>총평</label>
              <Textarea
                value={introInput}
                onChange={(e) => setIntroInput(e.target.value)}
                rows={5}
                placeholder="올해를 한 문단으로."
              />
            </div>
            <div>
              <label className={cn('block text-sm mb-1', theme.textMuted)}>
                에피소드 · 뒷이야기
              </label>
              <Textarea
                value={highlightsInput}
                onChange={(e) => setHighlightsInput(e.target.value)}
                rows={8}
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
                  setThemeInput(data.theme ?? 'midnight');
                  setPublishedInput(data.is_published === true);
                }}
              >
                <X className="w-4 h-4 mr-1" />
                취소
              </Button>
            </div>
          </div>
        )}

        {/* ── 총평 ── */}
        {!isEditing && (data.intro || data.highlights) && (
          <Reveal>
            <div className={cn('rounded-2xl border p-6 sm:p-8 space-y-6', theme.card)}>
              {data.intro && (
                <p
                  className={cn(
                    'text-lg sm:text-xl leading-relaxed whitespace-pre-wrap',
                    theme.text
                  )}
                >
                  {data.intro}
                </p>
              )}
              {data.highlights && (
                <div className={cn('pt-6 border-t', dark ? 'border-white/10' : 'border-stone-200')}>
                  <p className={cn('text-xs font-semibold tracking-wider mb-3', theme.accent)}>
                    에피소드 · 뒷이야기
                  </p>
                  <p className={cn('whitespace-pre-wrap leading-relaxed', theme.textMuted)}>
                    {data.highlights}
                  </p>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* ── 시상 ── */}
        {data.awards.length > 0 && (
          <section>
            <Reveal>
              <h2
                className={cn(
                  'text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-2',
                  theme.text
                )}
              >
                <Trophy className={cn('w-6 h-6', theme.accent)} />
                올해의 기록
              </h2>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.awards.map((a, i) => (
                <Reveal key={a.key} delay={i * 80}>
                  <div
                    className={cn(
                      'rounded-2xl border p-5 h-full transition-all duration-300 hover:-translate-y-1',
                      theme.card,
                      theme.cardHover
                    )}
                  >
                    <p className={cn('text-xs font-semibold tracking-wide', theme.accent)}>
                      {a.label}
                    </p>
                    <p className={cn('text-lg font-bold mt-1 break-keep', theme.text)}>
                      {a.winner}
                    </p>
                    <p className={cn('text-sm mt-1', theme.textMuted)}>{a.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ── 멤버 ── */}
        <section>
          <Reveal>
            <h2 className={cn('text-2xl sm:text-3xl font-bold mb-6', theme.text)}>멤버별 기록</h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.members.map((m, i) => {
              const rate = m.attendable > 0 ? (m.participated / m.attendable) * 100 : 0;
              return (
                <Reveal key={m.id} delay={i * 70}>
                  <Link
                    href={`/stats/${m.id}`}
                    className={cn(
                      'block rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1',
                      theme.card,
                      theme.cardHover
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={m.avatar_url} name={m.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className={cn('font-bold', theme.text)}>{m.name}</p>
                        <p className={cn('text-xs', theme.textMuted)}>
                          참석 {m.participated}/{m.attendable}회 · 발제자 {m.presenter_count}회
                        </p>
                      </div>
                      {m.avg_rating !== null && (
                        <div className="text-right shrink-0">
                          <p className={cn('text-xl font-bold', theme.accent)}>
                            {m.avg_rating.toFixed(1)}
                          </p>
                          <p className={cn('text-[10px]', theme.textMuted)}>평균 별점</p>
                        </div>
                      )}
                    </div>

                    <div
                      className={cn(
                        'mt-4 h-1.5 rounded-full overflow-hidden',
                        dark ? 'bg-white/10' : 'bg-stone-200'
                      )}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${rate}%`, background: accentHex }}
                      />
                    </div>
                    <div className={cn('mt-2 flex gap-4 text-[11px]', theme.textMuted)}>
                      <span>발제 문항 {m.discussion_count}</span>
                      {m.late_count > 0 && <span>지각 {m.late_count}회</span>}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ── 읽은 책 ── */}
        <section>
          <Reveal>
            <h2 className={cn('text-2xl sm:text-3xl font-bold mb-6', theme.text)}>
              {data.year}년에 읽은 책
            </h2>
          </Reveal>

          <div className="space-y-6">
            {data.entries.map((e, i) => (
              <Reveal key={e.schedule_id} delay={i * 60}>
                <div
                  className={cn(
                    'rounded-2xl border p-5 flex flex-col sm:flex-row gap-5 transition-all duration-300 hover:-translate-y-1',
                    theme.card,
                    theme.cardHover
                  )}
                >
                  <Link href={`/meetings/${e.schedule_id}`} className="shrink-0 mx-auto sm:mx-0">
                    <div
                      className={cn(
                        'w-28 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden border shadow-lg',
                        dark ? 'border-white/10' : 'border-stone-200'
                      )}
                    >
                      {e.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.cover_url}
                          alt={e.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className={cn(
                            'w-full h-full flex items-center justify-center p-2',
                            dark ? 'bg-white/5' : 'bg-stone-100'
                          )}
                        >
                          <span className={cn('text-[11px] text-center', theme.textMuted)}>
                            {e.title}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <Link
                        href={`/meetings/${e.schedule_id}`}
                        className={cn('text-lg font-bold break-keep hover:underline', theme.text)}
                      >
                        {e.title}
                      </Link>
                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1',
                          theme.textMuted
                        )}
                      >
                        {e.author && <span>{e.author}</span>}
                        {e.presenter_name && (
                          <span className="inline-flex items-center gap-1">
                            <Mic className="w-3 h-3" />
                            {e.presenter_name}
                          </span>
                        )}
                        {e.category && (
                          <span className={cn('px-2 py-0.5 rounded-full border', theme.accentSoft)}>
                            {e.category}
                          </span>
                        )}
                        <span>{format(new Date(e.meeting_date), 'M월 d일')}</span>
                      </div>
                    </div>

                    {e.avg_rating !== null && (
                      <div className={theme.text}>
                        <Stars rating={e.avg_rating} dark={dark} />
                      </div>
                    )}

                    {e.one_liners.length > 0 && (
                      <ul className="space-y-1.5">
                        {e.one_liners.map((o, k) => (
                          <li key={k} className={cn('text-sm leading-relaxed', theme.text)}>
                            <span className={cn('text-xs mr-2', theme.accent)}>
                              {o.name}
                              {o.rating !== null && ` ${o.rating}`}
                            </span>
                            <span className="opacity-90">{o.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
