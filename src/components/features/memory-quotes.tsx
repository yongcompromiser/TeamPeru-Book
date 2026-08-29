'use client';

import { useEffect, useState } from 'react';

export type Memory = { text: string; name: string; book: string };

/**
 * 모임에서 남긴 한줄평들이 화면 곳곳에 추억처럼 떠올랐다 사라진다.
 * 여러 슬롯이 각자 랜덤 위치·랜덤 인용구로 페이드인 → 잠시 머무름 → 페이드아웃 을 반복.
 */
export function MemoryQuotes({ quotes }: { quotes: Memory[] }) {
  if (!quotes || quotes.length === 0) return null;
  const slots = Math.min(6, quotes.length);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: slots }).map((_, i) => (
        <QuoteSlot key={i} quotes={quotes} index={i} />
      ))}
    </div>
  );
}

function QuoteSlot({ quotes, index }: { quotes: Memory[]; index: number }) {
  const [item, setItem] = useState<{ q: Memory; x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    let tid: ReturnType<typeof setTimeout>;

    const roll = () => {
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      // 중앙(제목 영역)은 비우고 좌/우 구역에 띄운다.
      const side = Math.random() < 0.5;
      const x = side ? 3 + Math.random() * 25 : 56 + Math.random() * 30;
      const y = 12 + Math.random() * 68;
      return { q, x, y };
    };

    const cycle = () => {
      if (!alive) return;
      setItem(roll());
      setVisible(false);
      tid = setTimeout(() => {
        if (!alive) return;
        setVisible(true); // 페이드 인
        tid = setTimeout(() => {
          if (!alive) return;
          setVisible(false); // 페이드 아웃
          tid = setTimeout(cycle, 1500); // 잠시 비었다가 다른 자리에 다시
        }, 4800 + Math.random() * 1600); // 머무는 시간
      }, 80);
    };

    // 슬롯마다 시작 시점을 어긋나게
    tid = setTimeout(cycle, index * 950 + Math.random() * 700);
    return () => {
      alive = false;
      clearTimeout(tid);
    };
  }, [quotes, index]);

  if (!item) return null;

  return (
    <div
      className="absolute max-w-[min(320px,72vw)] text-center transition-all duration-1000 ease-out"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        opacity: visible ? 1 : 0,
        transform: `translateY(${visible ? 0 : 14}px) scale(${visible ? 1 : 0.98})`,
      }}
    >
      <p
        className="text-sm italic leading-relaxed text-white/90 sm:text-base"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}
      >
        “{item.q.text}”
      </p>
      <p className="mt-1.5 text-xs text-amber-200/60" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
        — {item.q.name}
        {item.q.book ? ` · ${item.q.book}` : ''}
      </p>
    </div>
  );
}
