'use client';

import { useState, useEffect, use } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar,
  MapPin,
  User,
  Book,
  Users,
  Check,
  Loader2,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  presenter_name: string | null;
  book: { title: string; author: string; cover_url: string | null } | null;
  selection_reason: string | null;
  rsvp_count: number;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 초대장 안의 지면들. 순서대로 넘어간다. */
type Leaf = 'invite' | 'join' | 'signup' | 'done';

const LEAF_NO: Record<Leaf, number> = { invite: 1, join: 2, signup: 3, done: 3 };

/** 공기 중 먼지. 서버·클라이언트 렌더가 어긋나지 않게 고정값으로 배치한다. */
const DUST = [
  { left: '12%', bottom: '8%', size: 3, delay: 0, dur: 14 },
  { left: '26%', bottom: '2%', size: 2, delay: 3, dur: 18 },
  { left: '41%', bottom: '14%', size: 4, delay: 6, dur: 16 },
  { left: '58%', bottom: '5%', size: 2, delay: 1.5, dur: 20 },
  { left: '69%', bottom: '18%', size: 3, delay: 8, dur: 15 },
  { left: '81%', bottom: '3%', size: 2, delay: 4.5, dur: 19 },
  { left: '92%', bottom: '11%', size: 3, delay: 10, dur: 17 },
  { left: '34%', bottom: '24%', size: 2, delay: 7, dur: 21 },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function InvitePage({ params }: PageProps) {
  const { id } = use(params);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 책이 열렸는지. 열기 전에는 표지만 보여준다.
  const [opened, setOpened] = useState(false);
  const [contentShown, setContentShown] = useState(false);

  // 펼친 뒤의 지면 넘김
  const [leaf, setLeaf] = useState<Leaf>('invite');
  const [turning, setTurning] = useState(false);

  // 이메일 가입 (카카오 대안)
  const [emailName, setEmailName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invite/${id}`);
        if (res.ok) {
          const data = await res.json();
          setMeeting(data.meeting);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
      setIsLoading(false);
    })();
  }, [id]);

  // 표지가 열리는 동안 기다렸다가 내용을 올린다.
  // 모션을 줄이는 설정이면 곧바로 보여준다.
  const openBook = () => {
    if (opened) return;
    setOpened(true);
    if (prefersReducedMotion()) {
      setContentShown(true);
      return;
    }
    setTimeout(() => setContentShown(true), 850);
  };

  /** 한 장을 넘긴다. 넘어가는 동안(≈0.42s) 지면을 바꿔 끼운다. */
  const turnTo = (next: Leaf) => {
    if (turning || next === leaf) return;
    if (prefersReducedMotion()) {
      setLeaf(next);
      return;
    }
    setTurning(true);
    setTimeout(() => {
      setLeaf(next);
      setTurning(false);
    }, 420);
  };

  const handleEmailSignup = async () => {
    setEmailError('');
    setEmailSubmitting(true);
    try {
      const res = await fetch(`/api/invite/${id}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: emailName, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        turnTo('done');
      } else {
        setEmailError(data.error || '가입에 실패했어요. 다시 시도해주세요.');
      }
    } catch {
      setEmailError('가입 중 오류가 발생했습니다.');
    } finally {
      setEmailSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0a07] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-600/70 animate-spin" />
      </div>
    );
  }

  if (notFound || !meeting) {
    return (
      <div className="min-h-screen bg-[#0d0a07] flex flex-col items-center justify-center px-6 text-center">
        <Book className="w-12 h-12 text-amber-900 mb-4" />
        <h1 className="text-lg font-bold text-stone-300">초대장을 찾을 수 없어요</h1>
        <p className="text-sm text-stone-500 mt-1">
          링크가 만료되었거나 아직 공개되지 않은 모임입니다.
        </p>
      </div>
    );
  }

  const meetingDate = new Date(meeting.meeting_date);
  const cover = meeting.book?.cover_url;

  /* ─── 지면 내용 ─── */

  const leafInvite = (
    <>
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-20 h-28 rounded overflow-hidden bg-stone-200 shadow-lg">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={meeting.book?.title ?? ''}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-700">
              <Book className="w-7 h-7 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {meeting.book ? (
            <>
              <h2 className="text-lg font-bold text-stone-900 leading-snug break-keep">
                {meeting.book.title}
              </h2>
              <p className="text-sm text-stone-500 mt-0.5">{meeting.book.author}</p>
            </>
          ) : (
            <h2 className="text-lg font-bold text-stone-400">책 미정</h2>
          )}
          {meeting.presenter_name && (
            <p className="text-xs text-stone-600 mt-2 inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> 발제 {meeting.presenter_name}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-stone-400/30 space-y-2.5 text-sm text-stone-700">
        <p className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-700" />
          {format(meetingDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          {meeting.meeting_time && <span className="text-stone-500">· {meeting.meeting_time}</span>}
        </p>
        {meeting.location && (
          <p className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-700" />
            {meeting.location}
          </p>
        )}
        <p className="flex items-center gap-2 text-stone-500">
          <Users className="w-4 h-4 text-amber-700" />
          현재 {meeting.rsvp_count}명 참석 신청
        </p>
      </div>

      {meeting.selection_reason && (
        <div className="mt-4 pt-4 border-t border-stone-400/30">
          <p className="text-xs font-semibold text-amber-800 mb-1.5">
            {meeting.presenter_name
              ? `${meeting.presenter_name}님이 이 책을 고른 이유`
              : '이 책을 고른 이유'}
          </p>
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
            {meeting.selection_reason}
          </p>
        </div>
      )}

      <button
        onClick={() => turnTo('join')}
        className="group mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-700/30 bg-amber-800/[0.07] py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-800/[0.14]"
      >
        다음 장 · 참석하기
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </>
  );

  const leafJoin = (
    <>
      <div className="text-center">
        <p className="text-[10px] tracking-[0.35em] text-amber-700/70">RSVP</p>
        <h3 className="mt-2 text-lg font-bold text-stone-900">참석하시겠어요?</h3>
        <p className="text-sm text-stone-600 mt-1">
          카카오로 참여하면 참석 신청과 입장이 한 번에 끝나요.
        </p>
      </div>

      <a
        href={`/api/auth/kakao/start?mode=guest&next=/meetings/${id}`}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 text-base font-semibold text-[#191600] shadow-sm transition-opacity hover:opacity-90"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            fill="#191600"
            d="M12 3C6.477 3 2 6.477 2 10.8c0 2.77 1.86 5.2 4.66 6.58-.2.72-.74 2.66-.85 3.07-.13.51.19.5.4.37.16-.11 2.6-1.77 3.66-2.49.69.1 1.4.16 2.13.16 5.523 0 10-3.477 10-7.69C24 6.477 17.523 3 12 3Z"
          />
        </svg>
        카카오로 게스트 참여하기
      </a>
      <p className="text-[11px] text-stone-500 mt-2 text-center">닉네임만 받아요 · 승인 없이 바로 입장</p>

      <button
        onClick={() => turnTo('signup')}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-amber-700/40 bg-amber-800/[0.07] px-4 text-base font-semibold text-amber-900 transition-colors hover:bg-amber-800/[0.14]"
      >
        <Mail className="w-5 h-5" />
        그냥 가입하기
      </button>
      <p className="text-[11px] text-stone-500 mt-2 text-center">이메일로 가입 · 관리자 승인 후 입장</p>

      <ul className="text-xs text-stone-600 mt-5 pt-4 border-t border-stone-400/30 space-y-1.5">
        {['참석 명단에 자동으로 올라가요', '책·회의록을 둘러보고 한줄평과 평점을 남길 수 있어요'].map(
          (t) => (
            <li key={t} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              {t}
            </li>
          )
        )}
      </ul>
    </>
  );

  const leafSignup = (
    <>
      <div className="text-center">
        <p className="text-[10px] tracking-[0.35em] text-amber-700/70">SIGN UP</p>
        <h3 className="mt-2 text-lg font-bold text-stone-900">그냥 가입하기</h3>
        <p className="text-sm text-stone-600 mt-1">
          가입하면 <b className="text-stone-800">관리자 승인</b> 후 입장할 수 있어요.
        </p>
      </div>

      <div className="mt-5 space-y-2.5">
        {[
          { v: emailName, set: setEmailName, ph: '이름', type: 'text', max: 40 },
          { v: email, set: setEmail, ph: '이메일', type: 'email', max: 120 },
          {
            v: password,
            set: setPassword,
            ph: '비밀번호 (6자 이상)',
            type: 'password',
            max: 60,
          },
        ].map((f) => (
          <input
            key={f.ph}
            type={f.type}
            value={f.v}
            onChange={(e) => f.set(e.target.value)}
            placeholder={f.ph}
            maxLength={f.max}
            className="w-full rounded-lg border border-stone-400/50 bg-white/60 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
        ))}
        {emailError && <p className="text-xs text-red-600">{emailError}</p>}

        <button
          onClick={handleEmailSignup}
          disabled={emailSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-amber-700 text-base font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-60"
        >
          {emailSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '가입 신청'}
        </button>
      </div>
    </>
  );

  const leafDone = (
    <div className="text-center py-6">
      <div className="w-14 h-14 rounded-full bg-emerald-600/15 flex items-center justify-center mx-auto mb-3">
        <Check className="w-7 h-7 text-emerald-700" />
      </div>
      <p className="font-bold text-stone-900">가입 신청 완료!</p>
      <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
        관리자가 확인한 뒤 입장할 수 있어요.
        <br />
        승인되면 로그인해주세요.
      </p>
    </div>
  );

  const LEAVES: Record<Leaf, React.ReactNode> = {
    invite: leafInvite,
    join: leafJoin,
    signup: leafSignup,
    done: leafDone,
  };

  // 뒤로 넘길 곳 (첫 장과 완료 장에는 없다)
  const back: Leaf | null = leaf === 'join' ? 'invite' : leaf === 'signup' ? 'join' : null;

  return (
    // 어두운 나무결 위. 위에서 내려오는 따뜻한 빛 하나.
    <div className="relative min-h-screen overflow-hidden bg-[#0d0a07]">
      {/* 나무 결 */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          background:
            'repeating-linear-gradient(94deg, #1a1208 0px, #241a0e 3px, #17100a 7px, #1e150c 11px)',
        }}
      />
      {/* 위에서 떨어지는 광원 */}
      <div
        className="animate-ember absolute left-1/2 -translate-x-1/2 -top-40 w-[46rem] h-[46rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.20) 0%, transparent 62%)' }}
      />
      {/* 가장자리 어둠 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 35%, transparent 38%, rgba(0,0,0,0.78) 100%)',
        }}
      />
      {/* 먼지 */}
      <div className="absolute inset-0 pointer-events-none">
        {DUST.map((d, i) => (
          <span
            key={i}
            className="animate-dust absolute rounded-full bg-amber-200/50"
            style={{
              left: d.left,
              bottom: d.bottom,
              width: d.size,
              height: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center px-5 py-14">
        {!contentShown ? (
          /* ── 닫힌 책 ── */
          <div className="flex flex-col items-center">
            <p className="text-[11px] tracking-[0.45em] text-amber-600/70 mb-8">TEAM PERU</p>

            <button
              onClick={openBook}
              aria-label="초대장 열어보기"
              className={cn('group relative', !opened && 'animate-book-idle')}
              style={{ perspective: '1600px' }}
            >
              {/* 책등과 속지 */}
              <div className="relative w-[248px] h-[360px] sm:w-[280px] sm:h-[406px]">
                <div
                  className="absolute inset-0 rounded-r-md rounded-l-sm"
                  style={{
                    background: 'linear-gradient(100deg, #f5ecd8 0%, #e8dcc0 55%, #d9cba8 100%)',
                    boxShadow: '0 30px 70px rgba(0,0,0,.75)',
                  }}
                />
                {/* 책장 단면 */}
                <div
                  className="absolute right-0 top-2 bottom-2 w-2 rounded-r"
                  style={{
                    background: 'repeating-linear-gradient(180deg,#efe6d2 0 2px,#cdbf9f 2px 3px)',
                  }}
                />

                {/* 표지 — 왼쪽 경첩으로 열린다 */}
                <div
                  className={cn(
                    'absolute inset-0 rounded-r-md rounded-l-sm overflow-hidden',
                    opened && 'animate-cover-open'
                  )}
                  style={{
                    transformOrigin: 'left center',
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                    background: 'linear-gradient(140deg, #3b2a16 0%, #241809 60%, #1a1207 100%)',
                    boxShadow: 'inset 0 0 60px rgba(0,0,0,.55), 0 26px 60px rgba(0,0,0,.7)',
                  }}
                >
                  {/* 금박 테두리 */}
                  <div className="absolute inset-[10px] rounded-sm border border-amber-500/35" />
                  <div className="absolute inset-[15px] rounded-sm border border-amber-500/15" />

                  {/* 책등 */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-4"
                    style={{ background: 'linear-gradient(90deg,#120c05,#2e2010 70%,#1a1207)' }}
                  />

                  <div className="relative h-full flex flex-col items-center justify-center px-7 text-center">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="w-24 h-36 object-cover rounded shadow-2xl mb-5 ring-1 ring-amber-500/25"
                      />
                    ) : (
                      <Book className="w-12 h-12 text-amber-500/70 mb-5" />
                    )}
                    <p className="text-[10px] tracking-[0.35em] text-amber-500/70">INVITATION</p>
                    <p className="mt-2 text-lg font-bold text-amber-100/90 leading-snug break-keep">
                      {meeting.book?.title ?? '독서토론 모임'}
                    </p>
                    <div className="mt-4 w-10 h-px bg-amber-500/40" />
                    <p className="mt-4 text-xs text-amber-200/45">
                      {format(meetingDate, 'yyyy. MM. dd', { locale: ko })}
                    </p>
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={openBook}
              className="mt-9 text-sm text-amber-200/60 hover:text-amber-100 transition-colors"
            >
              <span className="animate-pulse-soft inline-block">책을 눌러 열어보세요</span>
            </button>
          </div>
        ) : (
          /* ── 펼쳐진 책 ── */
          <div className="w-full max-w-md animate-page-rise">
            <div className="text-center mb-5">
              <p className="text-[11px] tracking-[0.45em] text-amber-600/70">TEAM PERU</p>
              <h1 className="mt-2 text-xl font-bold text-amber-50">모임 초대장</h1>
            </div>

            {/* 책 몸통 */}
            <div className="relative" style={{ perspective: '1800px' }}>
              {/* 오른쪽에 쌓인 남은 책장들 */}
              <div
                className="absolute right-[-7px] top-3 bottom-3 w-[7px] rounded-r-sm"
                style={{
                  background: 'repeating-linear-gradient(180deg,#efe6d2 0 2px,#c9ba99 2px 3px)',
                  boxShadow: '0 18px 40px rgba(0,0,0,.6)',
                }}
              />
              <div
                className="absolute right-[-12px] top-5 bottom-5 w-[5px] rounded-r-sm"
                style={{
                  background: 'repeating-linear-gradient(180deg,#e2d7bd 0 2px,#b8a888 2px 3px)',
                }}
              />

              {/* 가죽 표지 테두리 */}
              <div
                className="relative rounded-l-sm rounded-r-lg p-[7px]"
                style={{
                  background: 'linear-gradient(140deg, #3b2a16 0%, #241809 60%, #1a1207 100%)',
                  boxShadow: '0 32px 70px rgba(0,0,0,.75), inset 0 0 40px rgba(0,0,0,.5)',
                }}
              >
                {/* 책등 */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[7px] rounded-l-sm"
                  style={{ background: 'linear-gradient(90deg,#120c05,#2e2010 70%,#1a1207)' }}
                />

                {/* 지면 — leaf 가 바뀌면 key 가 바뀌어 넘김 애니메이션이 다시 돈다 */}
                <div
                  key={leaf}
                  className={cn(
                    'relative min-h-[420px] rounded-l-[2px] rounded-r-md px-6 py-6 pb-10',
                    turning ? 'animate-page-turn-out' : 'animate-page-turn-in'
                  )}
                  style={{
                    transformOrigin: 'left center',
                    transformStyle: 'preserve-3d',
                    background: 'linear-gradient(170deg,#f7efdd 0%,#f1e7d1 100%)',
                    boxShadow: '0 6px 18px rgba(0,0,0,.35)',
                  }}
                >
                  {/* 경첩 쪽 그늘 — 책에 붙어 있는 느낌 */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-7 pointer-events-none rounded-l-[2px]"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(60,40,15,0.28) 0%, rgba(60,40,15,0.06) 55%, transparent 100%)',
                    }}
                  />

                  <div className="relative">{LEAVES[leaf]}</div>

                  {/* 쪽수 · 뒤로 */}
                  <div className="absolute inset-x-6 bottom-3 flex items-center justify-between">
                    {back ? (
                      <button
                        onClick={() => turnTo(back)}
                        disabled={emailSubmitting}
                        className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-50"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />앞 장
                      </button>
                    ) : (
                      <span />
                    )}
                    <span className="text-[11px] tracking-widest text-stone-400">
                      — {LEAF_NO[leaf]} —
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-stone-600 mt-6">
              팀 페루 독서토론 · 함께 읽고 나누는 즐거움
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
