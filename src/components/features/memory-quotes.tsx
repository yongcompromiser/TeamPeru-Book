'use client';

import { useEffect, useRef, useState } from 'react';

export type Memory = { text: string; name: string; book: string; cover?: string };

type Sticker = {
  id: number;
  q: Memory;
  x: number; // %
  y: number; // %
  rot: number; // deg
  tone: number; // 0..3 색조
  z: number; // 최근일수록 큼
  phase: 'in' | 'hold' | 'out';
};

// 스티커 색조(포스트잇 느낌) — 다크 배경 위에서 은은하게
const TONES = [
  { bg: 'rgba(255, 246, 224, 0.94)', bar: '#e0a94b', ink: '#3a2f1a', sub: '#8a6d34' }, // amber
  { bg: 'rgba(233, 244, 255, 0.94)', bar: '#5b8fd6', ink: '#1f2b3a', sub: '#3f5f86' }, // blue
  { bg: 'rgba(244, 236, 255, 0.94)', bar: '#8a6fd0', ink: '#2c2340', sub: '#5b4a86' }, // violet
  { bg: 'rgba(255, 236, 240, 0.94)', bar: '#d3708a', ink: '#3a2028', sub: '#8a4a5e' }, // rose
];

/**
 * 모임에서 남긴 한줄평이 스티커(포스트잇)처럼 화면 곳곳에 붙었다 사라진다.
 * - 일정 간격으로 새 스티커가 등장하고, 최근에 생긴 것일수록 위(z-index 최상단)에 배치 → 겹쳐도 최신 것은 항상 읽힘
 * - 오래된 스티커는 서서히 흐려지고, 수명이 다하면 사라진다
 */
export function MemoryQuotes({ quotes }: { quotes: Memory[] }) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const idRef = useRef(0);
  const zRef = useRef(0);
  const qiRef = useRef(0);
  const stickersRef = useRef<Sticker[]>([]);
  stickersRef.current = stickers;

  useEffect(() => {
    if (!quotes || quotes.length === 0) return;

    const MAX = 3; // 동시에 떠 있는 최대 스티커 수
    const LIFE = 8200; // 스티커 수명(ms)
    const SPAWN = 3200; // 새 스티커 생성 간격(ms)
    const MIN_GAP = 30; // 스티커 간 최소 중심 거리(% 단위)

    // 셔플된 인용구를 순서대로 소비 → 짧은 시간에 같은 문구 중복 최소화
    const order = quotes.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // 중앙(제목·버튼) 영역: x 32~68%, y 30~70% 는 피한다.
    const inCenter = (x: number, y: number) => x > 32 && x < 68 && y > 30 && y < 70;

    const pickPos = (existing: Sticker[]) => {
      // 중앙을 피하고, 기존 스티커와 최소 거리(MIN_GAP)를 확보하도록 여러 번 시도.
      // 조건을 만족하는 첫 위치를 쓰고, 못 찾으면 가장 멀리 떨어진 위치를 사용.
      const gap2 = MIN_GAP * MIN_GAP;
      let best = { x: 8, y: 14, d: -1 };
      for (let t = 0; t < 50; t++) {
        const x = 6 + Math.random() * 78; // 6%~84%
        const y = 12 + Math.random() * 66; // 12%~78%
        if (inCenter(x, y)) continue; // 중앙 회피
        let dmin = Infinity;
        for (const s of existing) {
          const dx = s.x - x;
          const dy = s.y - y;
          const d = dx * dx + dy * dy;
          if (d < dmin) dmin = d;
        }
        if (existing.length === 0 || dmin >= gap2) return { x, y };
        if (dmin > best.d) best = { x, y, d: dmin };
      }
      return { x: best.x, y: best.y };
    };

    const spawn = () => {
      const qi = order[qiRef.current % order.length];
      qiRef.current += 1;
      const q = quotes[qi];
      const cur = stickersRef.current;
      const { x, y } = pickPos(cur);
      const id = idRef.current++;
      zRef.current += 1;
      const sticker: Sticker = {
        id,
        q,
        x,
        y,
        rot: 0,
        tone: Math.floor(Math.random() * TONES.length),
        z: zRef.current,
        phase: 'in',
      };

      setStickers((prev) => {
        const next = [...prev, sticker];
        // 최대 개수 초과 시 가장 오래된(작은 z) 것을 out 처리
        if (next.length > MAX) {
          const oldest = next.reduce((a, b) => (a.z < b.z ? a : b));
          return next.map((s) => (s.id === oldest.id ? { ...s, phase: 'out' } : s));
        }
        return next;
      });

      // in → hold
      timers.push(
        setTimeout(() => {
          setStickers((prev) => prev.map((s) => (s.id === id && s.phase === 'in' ? { ...s, phase: 'hold' } : s)));
        }, 60)
      );
      // hold → out
      timers.push(
        setTimeout(() => {
          setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, phase: 'out' } : s)));
        }, LIFE)
      );
      // out 후 제거
      timers.push(
        setTimeout(() => {
          setStickers((prev) => prev.filter((s) => s.id !== id));
        }, LIFE + 1100)
      );
    };

    // 초기 몇 개를 시차 두고 등장
    spawn();
    timers.push(setTimeout(spawn, 900));
    timers.push(setTimeout(spawn, 1800));
    const interval = setInterval(spawn, SPAWN);

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [quotes]);

  if (!quotes || quotes.length === 0) return null;

  const maxZ = stickers.reduce((m, s) => Math.max(m, s.z), 0);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stickers.map((s) => {
        const tone = TONES[s.tone];
        const visible = s.phase !== 'in' && s.phase !== 'out';
        const isTop = s.z === maxZ;
        // 최신 스티커는 또렷하게, 오래될수록 살짝 흐리게(겹쳐도 최신이 읽힘)
        const age = maxZ - s.z; // 0=최신
        const dim = visible ? Math.max(0.62, 1 - age * 0.12) : 0;
        return (
          <div
            key={s.id}
            className="absolute w-[min(300px,74vw)] transition-all duration-700 ease-out"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              zIndex: s.z,
              opacity: dim,
              transform: `translate(-50%, -50%) rotate(${s.rot}deg) translateY(${visible ? 0 : 16}px) scale(${visible ? (isTop ? 1 : 0.97) : 0.9})`,
            }}
          >
            <div
              className="flex gap-3 rounded-2xl px-4 py-4"
              style={{
                background: tone.bg,
                boxShadow: isTop
                  ? '0 18px 46px rgba(0,0,0,0.5), 0 2px 0 rgba(255,255,255,0.4) inset'
                  : '0 10px 30px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(2px)',
              }}
            >
              {s.q.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.q.cover}
                  alt=""
                  className="h-[68px] w-[46px] flex-shrink-0 rounded-md object-cover"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}
                  loading="lazy"
                />
              ) : null}
              <div className="min-w-0">
                <div className="mb-1.5 h-1 w-8 rounded-full" style={{ background: tone.bar }} />
                <p className="text-[15px] font-medium leading-snug" style={{ color: tone.ink }}>
                  “{s.q.text}”
                </p>
                <p className="mt-2 text-xs font-medium" style={{ color: tone.sub }}>
                  — {s.q.name}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
