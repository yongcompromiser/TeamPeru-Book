'use client';

import { useEffect, useRef } from 'react';

/**
 * 독서토론 랜딩 히어로용 몰입형 배경.
 * 따뜻한 금빛 입자(먼지/불씨)가 중앙 광원으로 천천히 "빨려들어가며" 무한 순환한다.
 * - 마우스 이동 시 깊이(z)에 따른 시차(parallax)
 * - devicePixelRatio 대응(레티나 선명), 리사이즈/탭 비활성 처리
 * - 스프라이트 캐싱으로 매 프레임 그라데이션 생성 없이 부드럽게
 * - prefers-reduced-motion 이면 정지된 한 프레임만 렌더
 */
export function AmbientCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const context2d = el.getContext('2d');
    if (!context2d) return;
    // 이후 클로저에서 non-null 로 사용하기 위한 상수 별칭
    const canvas: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = context2d;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 따뜻한 서재 팔레트 + 브랜드 인디고 살짝
    const colors: number[][] = [
      [240, 196, 112], // amber
      [246, 224, 168], // gold
      [250, 242, 224], // cream
      [156, 166, 236], // soft indigo
    ];

    // 입자 스프라이트(색상별 1회 생성) — drawImage 로 빠르게 그린다
    const sprites = colors.map((rgb) => {
      const s = document.createElement('canvas');
      const S = 64;
      s.width = s.height = S;
      const c = s.getContext('2d')!;
      const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
      g.addColorStop(0.45, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`);
      g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
      return s;
    });

    type P = { x: number; y: number; vx: number; vy: number; z: number; r: number; c: number; ph: number; tw: number };
    let ps: P[] = [];
    let w = 0;
    let h = 0;
    let fx = 0;
    let fy = 0;
    let raf = 0;
    let last = 0;
    const mouse = { x: 0, y: 0, ax: 0, ay: 0 };

    function spawn(edge: boolean): P {
      let x: number;
      let y: number;
      if (edge) {
        // 바깥 링에서 생성 → 계속 안쪽으로 흘러들어오는 순환
        const a = Math.random() * Math.PI * 2;
        const rad = Math.max(w, h) * (0.42 + Math.random() * 0.22);
        x = fx + Math.cos(a) * rad;
        y = fy + Math.sin(a) * rad;
      } else {
        x = Math.random() * w;
        y = Math.random() * h;
      }
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        z: Math.random() * 0.85 + 0.15,
        r: Math.random() * 1.6 + 0.5,
        c: Math.floor(Math.random() * colors.length),
        ph: Math.random() * Math.PI * 2,
        tw: Math.random() * 0.003 + 0.001,
      };
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx = w * 0.5;
      fy = h * 0.34; // 광원(빨려드는 소실점)을 제목 위쪽에
      const count = Math.min(150, Math.max(40, Math.floor((w * h) / 8500)));
      ps = Array.from({ length: count }, () => spawn(false));
    }

    function drawGlow(t: number) {
      // 광원이 천천히 숨쉬듯 밝기·크기가 미세하게 오르내림
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.0006);
      const radius = Math.max(w, h) * (0.5 + 0.08 * breathe);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, radius);
      g.addColorStop(0, `rgba(242, 194, 124, ${0.14 + 0.08 * breathe})`);
      g.addColorStop(0.5, 'rgba(150, 130, 205, 0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    function drawParticle(p: P, t: number) {
      const sx = p.x + mouse.ax * 26 * (1 - p.z);
      const sy = p.y + mouse.ay * 26 * (1 - p.z);
      const size = p.r * (0.6 + p.z * 1.4);
      const tw = 0.55 + 0.45 * Math.sin(t * p.tw + p.ph);
      ctx.globalAlpha = (0.1 + p.z * 0.5) * tw;
      const d = size * 7;
      ctx.drawImage(sprites[p.c], sx - d / 2, sy - d / 2, d, d);
    }

    function frame(t: number) {
      const dt = Math.min(40, t - last || 16);
      last = t;
      const k = dt / 16.67;

      ctx.clearRect(0, 0, w, h);
      drawGlow(t);
      mouse.ax += (mouse.x - mouse.ax) * 0.04;
      mouse.ay += (mouse.y - mouse.ay) * 0.04;

      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        p.x += p.vx * k;
        p.y += p.vy * k;
        const dx = fx - p.x;
        const dy = fy - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const pull = 0.006 * k * (0.4 + p.z); // 안쪽으로 빨려듦
        p.x += dx * pull;
        p.y += dy * pull;
        if (dist < 24 + p.z * 30) Object.assign(p, spawn(true)); // 소실점 도달 → 재생성
        drawParticle(p, t);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    }

    resize();

    if (prefersReduced) {
      // 정지 프레임 한 장
      drawGlow(0);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) drawParticle(p, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => resize();
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!prefersReduced) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
