'use client';

import { useEffect, useRef } from 'react';

/**
 * 별자리 네트워크 배경 — "책으로 연결되는 우리의 이야기".
 * 별(노드)이 천천히 떠다니고, 가까운 별끼리 선으로 연결된다.
 * 마우스 근처의 별들은 따뜻한 금빛 선으로 이어져 상호작용한다.
 * - devicePixelRatio 대응, 리사이즈/탭 비활성 처리
 * - prefers-reduced-motion 이면 정지된 한 프레임만 렌더
 */
export function AmbientCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const context2d = el.getContext('2d');
    if (!context2d) return;
    const canvas: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = context2d;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const LINK = 150; // 별끼리 연결되는 최대 거리(px)
    const LINK2 = LINK * LINK;
    const MOUSE_R = 220; // 마우스와 연결되는 거리
    const MOUSE_R2 = MOUSE_R * MOUSE_R;

    type N = { x: number; y: number; vx: number; vy: number; r: number; warm: boolean; ph: number; tw: number };
    let nodes: N[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let fx = 0;
    let fy = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    function spawn(): N {
      const sp = 0.16;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * sp,
        vy: (Math.random() - 0.5) * sp,
        r: Math.random() * 1.4 + 0.8,
        warm: Math.random() < 0.18, // 일부만 따뜻한 금빛 별
        ph: Math.random() * Math.PI * 2,
        tw: Math.random() * 0.002 + 0.0008,
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
      fy = h * 0.4;
      const count = Math.min(130, Math.max(36, Math.floor((w * h) / 15000)));
      nodes = Array.from({ length: count }, spawn);
    }

    function drawGlow(t: number) {
      // 은은한 중앙 온기(깊이감)
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.0006);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(w, h) * 0.6);
      g.addColorStop(0, `rgba(240, 196, 130, ${0.07 + 0.04 * breathe})`);
      g.addColorStop(0.55, 'rgba(140, 130, 210, 0.04)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    function render(t: number, animate: boolean) {
      ctx.clearRect(0, 0, w, h);
      drawGlow(t);

      // 위치 업데이트
      if (animate) {
        const k = Math.min(2.5, (t - last || 16) / 16.67);
        for (const n of nodes) {
          n.x += n.vx * k;
          n.y += n.vy * k;
          if (n.x < -30) n.x = w + 30;
          else if (n.x > w + 30) n.x = -30;
          if (n.y < -30) n.y = h + 30;
          else if (n.y > h + 30) n.y = -30;
        }
      }

      // 별끼리 연결선
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            const alpha = (1 - Math.sqrt(d2) / LINK) * 0.2;
            ctx.strokeStyle = `rgba(184, 194, 244, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // 마우스와 연결(따뜻한 금빛)
        if (mouse.active) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MOUSE_R2) {
            const alpha = (1 - Math.sqrt(d2) / MOUSE_R) * 0.5;
            ctx.strokeStyle = `rgba(245, 212, 150, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // 별(노드)
      for (const n of nodes) {
        const tw = 0.6 + 0.4 * Math.sin(t * n.tw + n.ph);
        const r = n.r * (0.8 + 0.4 * tw);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.warm
          ? `rgba(246, 208, 146, ${0.5 * tw + 0.22})`
          : `rgba(212, 220, 250, ${0.45 * tw + 0.2})`;
        ctx.fill();
      }

      // 마우스 커서 별
      if (mouse.active) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 212, 150, 0.9)';
        ctx.fill();
      }
    }

    function frame(t: number) {
      render(t, true);
      last = t;
      raf = requestAnimationFrame(frame);
    }

    resize();

    if (prefersReduced) {
      render(0, false);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => resize();
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
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
    window.addEventListener('pointerout', onLeave);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
