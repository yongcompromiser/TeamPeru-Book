'use client';

import { AmbientCanvas } from '@/components/features/ambient-canvas';
import type { BackdropKind } from '@/lib/yearbook-themes';

/**
 * 연말결산 히어로 배경. 테마마다 다른 연출을 쓴다.
 * - constellation: 랜딩과 같은 별자리 캔버스
 * - aurora: 천천히 흐르는 색 덩어리 (CSS만, 가벼움)
 * - grain: 종이 질감 위 은은한 얼룩
 * 모두 prefers-reduced-motion 이면 정지한다(globals.css 에서 일괄 처리).
 */
export function YearBackdrop({ kind, accentHex }: { kind: BackdropKind; accentHex: string }) {
  if (kind === 'constellation') {
    return <AmbientCanvas className="absolute inset-0 w-full h-full" />;
  }

  if (kind === 'aurora') {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="animate-blob absolute -top-24 -left-16 w-[38rem] h-[38rem] rounded-full blur-3xl opacity-30"
          style={{ background: `radial-gradient(circle, ${accentHex} 0%, transparent 65%)` }}
        />
        <div
          className="animate-blob absolute top-10 right-0 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-25"
          style={{
            background: `radial-gradient(circle, ${accentHex} 0%, transparent 65%)`,
            animationDelay: '4s',
          }}
        />
        <div
          className="animate-blob absolute -bottom-32 left-1/3 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${accentHex} 0%, transparent 65%)`,
            animationDelay: '8s',
          }}
        />
      </div>
    );
  }

  // grain — 밝은 테마용. 은은한 얼룩 + 미세 노이즈
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="animate-blob absolute -top-20 left-1/4 w-[34rem] h-[34rem] rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${accentHex} 0%, transparent 70%)` }}
      />
      <div
        className="absolute inset-0 opacity-[0.15] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
