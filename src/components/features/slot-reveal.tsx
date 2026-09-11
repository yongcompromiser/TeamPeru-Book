'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 후보들을 슬롯머신처럼 빠르게 돌리다가 점점 느려지며 수상자에서 멈춘다.
 *
 * - 처음엔 빠르게(약 60ms) 넘기다가 지수적으로 느려져 마지막엔 한 박자 쉬고 멈춘다.
 * - 후보가 1명뿐이거나 prefers-reduced-motion 이면 돌리지 않고 바로 결과를 보여준다.
 * - 멈춘 뒤 onSettled 로 알려, 표지·부가 설명을 그때 띄울 수 있게 한다.
 */
export function SlotReveal({
  candidates,
  winner,
  spins = 14,
  className,
  spinningClassName,
  onSettled,
}: {
  candidates: string[];
  winner: string;
  /** 총 몇 번 넘길지 */
  spins?: number;
  className?: string;
  spinningClassName?: string;
  onSettled?: () => void;
}) {
  // 수상자가 후보에 없으면 넣어준다(데이터가 어긋나도 화면이 이상해지지 않게)
  const pool = candidates.includes(winner) ? candidates : [...candidates, winner];

  const [text, setText] = useState(() => (pool.length > 1 ? pool[0] : winner));
  const [done, setDone] = useState(pool.length <= 1);
  const settledRef = useRef(false);

  useEffect(() => {
    const finish = () => {
      setText(winner);
      setDone(true);
      if (!settledRef.current) {
        settledRef.current = true;
        onSettled?.();
      }
    };

    if (pool.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    let step = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (step >= spins) {
        finish();
        return;
      }
      setText(pool[step % pool.length]);
      step += 1;
      // 60ms 에서 시작해 끝으로 갈수록 느려진다. 전체 약 2초.
      // 상이 여섯 개쯤 되므로 한 번에 3초를 넘기면 지루해진다.
      const progress = step / spins;
      const delay = 60 + Math.pow(progress, 3) * 320;
      timer = setTimeout(tick, delay);
    };

    tick();
    return () => clearTimeout(timer);
    // winner 가 바뀌면(슬라이드 이동) 처음부터 다시 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, spins]);

  return (
    <span
      className={cn(
        'inline-block transition-all duration-300',
        done ? className : cn(spinningClassName ?? className, 'opacity-60 blur-[1px]'),
        done && 'animate-focus-in'
      )}
    >
      {text}
    </span>
  );
}
