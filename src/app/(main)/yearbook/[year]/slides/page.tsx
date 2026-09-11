'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Avatar } from '@/components/ui/avatar';
import { CountUp } from '@/components/features/reveal';
import { SlotReveal } from '@/components/features/slot-reveal';
import { YearBackdrop } from '@/components/features/year-backdrop';
import { getTheme, isDarkTheme } from '@/lib/yearbook-themes';
import { cn } from '@/lib/utils';
import {
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Star,
  Maximize2,
  Minimize2,
  LayoutList,
} from 'lucide-react';
import type { YearBook, YearBookEntry, YearMember, YearAward } from '@/lib/yearbook';

const ACCENT_HEX: Record<string, string> = {
  midnight: '#fbbf24',
  paper: '#f59e0b',
  neon: '#e879f9',
  forest: '#34d399',
};

// ── 슬라이드 정의 ────────────────────────────────────────────────────────
type Slide =
  | { kind: 'intro' }
  | { kind: 'stats' }
  | { kind: 'award'; award: YearAward; index: number; total: number }
  | { kind: 'member'; member: YearMember; index: number; total: number }
  | { kind: 'book'; entry: YearBookEntry; index: number; total: number }
  | { kind: 'text'; title: string; body: string }
  | { kind: 'outro' };

function buildSlides(data: YearBook): Slide[] {
  const slides: Slide[] = [{ kind: 'intro' }, { kind: 'stats' }];

  data.awards.forEach((award, i) =>
    slides.push({ kind: 'award', award, index: i, total: data.awards.length })
  );
  data.members.forEach((member, i) =>
    slides.push({ kind: 'member', member, index: i, total: data.members.length })
  );
  data.entries.forEach((entry, i) =>
    slides.push({ kind: 'book', entry, index: i, total: data.entries.length })
  );

  if (data.intro) slides.push({ kind: 'text', title: '올해를 돌아보며', body: data.intro });
  if (data.highlights) slides.push({ kind: 'text', title: '그리고 이런 일들이', body: data.highlights });

  slides.push({ kind: 'outro' });
  return slides;
}

export default function YearbookSlidesPage() {
  const params = useParams();
  const router = useRouter();
  const year = params.year as string;
  const { profile } = useAuth();
  const canView = profile?.role === 'member' || profile?.role === 'admin';

  const [data, setData] = useState<YearBook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

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

  const slides = data ? buildSlides(data) : [];
  const last = slides.length - 1;

  // 마지막에서 한 번 더 넘기면 '한눈에 보기'로 이어진다
  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= last) {
        router.push(`/yearbook/${year}/overview`);
        return i;
      }
      return i + 1;
    });
  }, [last, router, year]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // 아이폰 Safari 는 requestFullscreen 을 지원하지 않는다.
  // 이 경우에도 화면을 덮는 레이아웃이라 보는 경험은 크게 다르지 않다.
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      /* 미지원 기기 — 덮기 레이아웃으로 충분 */
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

  const theme = getTheme(data.theme);
  const dark = isDarkTheme(theme);
  const accentHex = ACCENT_HEX[theme.key] ?? '#fbbf24';
  const slide = slides[index];

  return (
    <div
      ref={rootRef}
      // 사이드바·헤더까지 덮는다. 전체화면 API 가 안 되는 기기에서도 몰입되도록.
      className={cn('fixed inset-0 z-50 overflow-hidden select-none', theme.pageBg)}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) (dx < 0 ? goNext : goPrev)();
        touchStartX.current = null;
      }}
    >
      {/* 배경 */}
      <div className={cn('absolute inset-0', theme.heroBg)}>
        <YearBackdrop kind={theme.backdrop} accentHex={accentHex} />
      </div>

      {/* 진행 바 */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3">
        {slides.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-0.5 flex-1 rounded-full transition-all duration-300',
              i <= index ? 'opacity-90' : 'opacity-20',
              dark ? 'bg-white' : 'bg-stone-700'
            )}
          />
        ))}
      </div>

      {/* 상단 버튼 */}
      <div className="absolute top-6 right-4 z-20 flex items-center gap-2">
        {/* 편집은 한눈에 보기 쪽에 있어 바로 갈 수 있게 둔다 */}
        <Link
          href={`/yearbook/${year}/overview`}
          title="한눈에 보기"
          className={cn(
            'p-2 rounded-full transition-colors',
            dark ? 'text-white/60 hover:bg-white/10' : 'text-stone-500 hover:bg-black/5'
          )}
        >
          <LayoutList className="w-5 h-5" />
        </Link>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? '전체화면 끄기' : '전체화면'}
          className={cn(
            'p-2 rounded-full transition-colors',
            dark ? 'text-white/60 hover:bg-white/10' : 'text-stone-500 hover:bg-black/5'
          )}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
        <Link
          href="/yearbook"
          className={cn(
            'p-2 rounded-full transition-colors',
            dark ? 'text-white/60 hover:bg-white/10' : 'text-stone-500 hover:bg-black/5'
          )}
          title="나가기"
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      {/* 슬라이드 — key 를 바꿔 매번 등장 애니메이션이 다시 돈다 */}
      <div
        key={index}
        className="relative z-10 h-full flex items-center justify-center px-6 sm:px-12 animate-slide-in"
        onClick={goNext}
      >
        <SlideBody slide={slide} data={data} theme={theme} dark={dark} accentHex={accentHex} />
      </div>

      {/* 좌우 이동 */}
      <button
        onClick={goPrev}
        disabled={index === 0}
        className={cn(
          'absolute left-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full transition-opacity disabled:opacity-0',
          dark ? 'text-white/40 hover:text-white/80' : 'text-stone-400 hover:text-stone-700'
        )}
        aria-label="이전"
      >
        <ChevronLeft className="w-7 h-7" />
      </button>
      <button
        onClick={goNext}
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full transition-opacity',
          dark ? 'text-white/40 hover:text-white/80' : 'text-stone-400 hover:text-stone-700'
        )}
        aria-label="다음"
      >
        <ChevronRight className="w-7 h-7" />
      </button>

      <p
        className={cn(
          'absolute bottom-4 left-0 right-0 text-center text-[11px] z-20',
          theme.textMuted
        )}
      >
        {index + 1} / {slides.length} · 화면을 누르거나 →
      </p>
    </div>
  );
}

// ── 시상 슬라이드 ────────────────────────────────────────────────────────
// 후보를 슬롯머신으로 돌리다가 수상자에서 멈추고, 그 뒤에 표지·근거를 띄운다.
function AwardSlide({
  award,
  theme,
  dark,
  accentHex,
}: {
  award: YearAward;
  theme: ReturnType<typeof getTheme>;
  dark: boolean;
  accentHex: string;
}) {
  // 슬라이드가 바뀌면 상위에서 key 로 재마운트되므로 여기서 따로 초기화할 필요가 없다
  const [settled, setSettled] = useState(false);

  return (
    <div className="text-center w-full max-w-3xl relative">
      <div
        className="animate-halo absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentHex}44 0%, transparent 65%)` }}
      />
      <div className="relative">
        <Trophy
          className="w-12 h-12 mx-auto animate-sparkle"
          style={{ color: accentHex }}
        />
        <p
          className={cn(
            'mt-6 text-xl sm:text-3xl tracking-[0.2em] animate-reveal-up',
            theme.textMuted
          )}
        >
          {award.label}
        </p>

        {/* 슬롯머신 */}
        <p className="mt-8 text-4xl sm:text-6xl font-black break-keep leading-tight min-h-[1.2em]">
          <SlotReveal
            candidates={award.candidates}
            winner={award.winner}
            className={theme.text}
            spinningClassName={theme.textMuted}
            onSettled={() => setSettled(true)}
          />
        </p>

        {/* 멈춘 뒤에 공개되는 것들 */}
        {settled && (
          <>
            {award.cover_url && (
              <div className="mt-8 flex justify-center animate-reveal-up">
                <div
                  className={cn(
                    'w-28 sm:w-36 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border',
                    dark ? 'border-white/10' : 'border-stone-200'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={award.cover_url}
                    alt={award.winner}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <p
              className={cn('mt-6 text-lg sm:text-2xl font-bold animate-reveal-up', theme.accent)}
              style={{ animationDelay: '200ms' }}
            >
              {award.detail}
            </p>

            {award.note && (
              <p
                className={cn('mt-2 text-sm sm:text-base animate-reveal-up', theme.textMuted)}
                style={{ animationDelay: '380ms' }}
              >
                {award.note}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 슬라이드 내용 ────────────────────────────────────────────────────────
function SlideBody({
  slide,
  data,
  theme,
  dark,
  accentHex,
}: {
  slide: Slide;
  data: YearBook;
  theme: ReturnType<typeof getTheme>;
  dark: boolean;
  accentHex: string;
}) {
  if (slide.kind === 'intro') {
    return (
      <div className="text-center">
        <p className={cn('text-sm tracking-[0.3em] animate-reveal-up', theme.textMuted)}>
          TEAM PERU
        </p>
        <p
          className={cn(
            'text-[22vw] sm:text-[16vw] lg:text-[13vw] leading-none font-black bg-clip-text text-transparent animate-focus-in',
            theme.heroNumber
          )}
        >
          {data.year}
        </p>
        <p
          className={cn('mt-4 text-xl sm:text-3xl font-bold animate-reveal-up', theme.text)}
          style={{ animationDelay: '600ms' }}
        >
          {data.title || '연말결산'}
        </p>
      </div>
    );
  }

  if (slide.kind === 'stats') {
    const items = [
      { label: '모임', value: data.meeting_count, unit: '회' },
      { label: '읽은 책', value: data.book_count, unit: '권' },
      { label: '함께한 멤버', value: data.members.length, unit: '명' },
    ];
    return (
      <div className="w-full max-w-4xl">
        <p
          className={cn('text-center text-lg sm:text-2xl mb-12 animate-reveal-up', theme.textMuted)}
        >
          우리가 함께한 {data.year}년
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 text-center">
          {items.map((s, i) => (
            <div
              key={s.label}
              className="animate-reveal-up"
              style={{ animationDelay: `${300 + i * 220}ms` }}
            >
              <p className={cn('text-7xl sm:text-8xl font-black', theme.accent)}>
                <CountUp value={s.value} duration={1400} />
                <span className="text-3xl sm:text-4xl font-medium opacity-60">{s.unit}</span>
              </p>
              <p className={cn('mt-3 text-base', theme.textMuted)}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slide.kind === 'award') {
    return <AwardSlide award={slide.award} theme={theme} dark={dark} accentHex={accentHex} />;
  }

  if (slide.kind === 'member') {
    const m = slide.member;
    const rate = m.attendable > 0 ? Math.round((m.participated / m.attendable) * 100) : 0;
    const rows = [
      { label: '참석', value: `${m.participated} / ${m.attendable}회` },
      { label: '발제자', value: `${m.presenter_count}회` },
      { label: '발제 문항', value: `${m.discussion_count}개` },
      { label: '평균 별점', value: m.avg_rating === null ? '-' : m.avg_rating.toFixed(1) },
    ];
    return (
      <div className="w-full max-w-2xl text-center">
        <div className="animate-reveal-up flex justify-center">
          <Avatar src={m.avatar_url} name={m.name} size="lg" className="w-24 h-24 text-3xl" />
        </div>
        <p
          className={cn('mt-6 text-5xl sm:text-6xl font-black animate-focus-in', theme.text)}
          style={{ animationDelay: '250ms' }}
        >
          {m.name}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-6">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="animate-reveal-up text-left"
              style={{ animationDelay: `${600 + i * 140}ms` }}
            >
              <p className={cn('text-xs', theme.textMuted)}>{r.label}</p>
              <p className={cn('text-2xl sm:text-3xl font-bold', theme.text)}>{r.value}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-10 animate-reveal-up"
          style={{ animationDelay: '1200ms' }}
        >
          <div className={cn('h-2 rounded-full overflow-hidden', dark ? 'bg-white/10' : 'bg-stone-200')}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${rate}%`, background: accentHex }}
            />
          </div>
          <p className={cn('mt-2 text-sm', theme.textMuted)}>참석률 {rate}%</p>
        </div>

        {/* 그 해 이 사람이 가장 좋게 / 아쉽게 본 책 */}
        {(m.best || m.worst) && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
            {[
              { label: '가장 좋았던 책', pick: m.best, delay: 1400 },
              { label: '가장 아쉬웠던 책', pick: m.worst, delay: 1600 },
            ]
              .filter((x) => x.pick)
              .map(({ label, pick, delay }) => (
                <div
                  key={label}
                  className={cn(
                    'rounded-xl border p-4 flex gap-3 animate-reveal-up',
                    dark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-stone-200'
                  )}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div
                    className={cn(
                      'w-12 shrink-0 aspect-[2/3] rounded overflow-hidden border',
                      dark ? 'border-white/10 bg-white/5' : 'border-stone-200 bg-stone-100'
                    )}
                  >
                    {pick!.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pick!.cover_url}
                        alt={pick!.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-0.5">
                        <span className={cn('text-[8px] text-center', theme.textMuted)}>
                          {pick!.title}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[11px]', theme.accent)}>{label}</p>
                    <p className={cn('text-sm font-bold truncate', theme.text)}>{pick!.title}</p>
                    <p className={cn('text-xs mt-0.5', theme.textMuted)}>{pick!.rating}점</p>
                    {pick!.one_liner && (
                      <p className={cn('text-xs mt-1.5 line-clamp-3 leading-relaxed', theme.text)}>
                        “{pick!.one_liner}”
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }

  if (slide.kind === 'book') {
    const e = slide.entry;
    return (
      <div className="w-full max-w-5xl">
        <div className="flex flex-col sm:flex-row items-center gap-8 sm:gap-14">
          <div className="shrink-0 animate-reveal-up">
            <div
              className={cn(
                'w-40 sm:w-56 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border',
                dark ? 'border-white/10' : 'border-stone-200'
              )}
            >
              {e.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.cover_url}
                  alt={e.title}
                  className="w-full h-full object-cover animate-ken-burns"
                />
              ) : (
                <div
                  className={cn(
                    'w-full h-full flex items-center justify-center p-4',
                    dark ? 'bg-white/5' : 'bg-stone-100'
                  )}
                >
                  <span className={cn('text-sm text-center', theme.textMuted)}>{e.title}</span>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p
              className={cn('text-xs tracking-[0.2em] animate-reveal-up', theme.textMuted)}
            >
              {slide.index + 1}번째 책
            </p>
            <p
              className={cn(
                'mt-3 text-3xl sm:text-5xl font-black break-keep leading-tight animate-focus-in',
                theme.text
              )}
              style={{ animationDelay: '200ms' }}
            >
              {e.title}
            </p>
            <p
              className={cn('mt-2 text-base animate-reveal-up', theme.textMuted)}
              style={{ animationDelay: '500ms' }}
            >
              {e.author}
              {e.presenter_name && ` · 발제 ${e.presenter_name}`}
            </p>

            {e.avg_rating !== null && (
              <div
                className="mt-5 flex items-center justify-center sm:justify-start gap-1 animate-reveal-up"
                style={{ animationDelay: '700ms' }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      'w-6 h-6',
                      n <= Math.round(e.avg_rating!)
                        ? 'fill-current'
                        : dark
                          ? 'text-white/15 fill-white/15'
                          : 'text-stone-200 fill-stone-200'
                    )}
                    style={n <= Math.round(e.avg_rating!) ? { color: accentHex } : undefined}
                  />
                ))}
                <span className={cn('ml-2 text-xl font-bold', theme.accent)}>{e.avg_rating}</span>
              </div>
            )}

            {e.one_liners.length > 0 && (
              <ul className="mt-7 space-y-2.5 max-h-56 overflow-y-auto">
                {e.one_liners.map((o, k) => (
                  <li
                    key={k}
                    className={cn('text-sm sm:text-base leading-relaxed animate-reveal-up', theme.text)}
                    style={{ animationDelay: `${900 + k * 160}ms` }}
                  >
                    <span className={cn('text-xs mr-2', theme.accent)}>{o.name}</span>
                    {o.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'text') {
    return (
      <div className="w-full max-w-3xl text-center">
        <p
          className={cn('text-sm tracking-[0.25em] animate-reveal-up', theme.textMuted)}
        >
          {slide.title}
        </p>
        <p
          className={cn(
            'mt-8 text-xl sm:text-3xl leading-relaxed whitespace-pre-wrap break-keep animate-reveal-up max-h-[65vh] overflow-y-auto',
            theme.text
          )}
          style={{ animationDelay: '300ms' }}
        >
          {slide.body}
        </p>
      </div>
    );
  }

  // outro
  return (
    <div className="text-center">
      <p
        className={cn(
          'text-5xl sm:text-7xl font-black bg-clip-text text-transparent animate-focus-in',
          theme.heroNumber
        )}
      >
        고생했어요
      </p>
      <p
        className={cn('mt-6 text-lg sm:text-xl animate-reveal-up', theme.textMuted)}
        style={{ animationDelay: '600ms' }}
      >
        {data.year}년, 함께 {data.book_count}권을 읽었습니다
      </p>
      <p
        className={cn('mt-12 text-sm animate-reveal-up', theme.accent)}
        style={{ animationDelay: '1100ms' }}
      >
        한 번 더 넘기면 한눈에 보기로 이어집니다 →
      </p>
    </div>
  );
}
