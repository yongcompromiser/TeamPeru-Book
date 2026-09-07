'use client';

import type { RadarAxis } from '@/lib/stats';

/**
 * 5축 레이더. 축마다 단위가 달라 절대 비교가 안 되므로,
 * 멤버 중 최고값을 100 으로 둔 상대값(value)만 그린다.
 * 축 이름 옆에 실제 값(raw)을 같이 적어 오해를 줄인다.
 */
export function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 84;
  const n = axes.length;
  if (n < 3) return null;

  // 12시 방향에서 시작해 시계방향
  const angleAt = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointAt = (i: number, ratio: number) => {
    const a = angleAt(i);
    return [cx + Math.cos(a) * radius * ratio, cy + Math.sin(a) * radius * ratio] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const shape = axes.map((a, i) => pointAt(i, Math.max(a.value, 0) / 100).join(',')).join(' ');

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-56 h-56 shrink-0" role="img">
        {/* 격자 */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={axes.map((_, i) => pointAt(i, r).join(',')).join(' ')}
            fill="none"
            stroke="currentColor"
            className="text-gray-200"
            strokeWidth="1"
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pointAt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              className="text-gray-200"
              strokeWidth="1"
            />
          );
        })}

        {/* 값 */}
        <polygon
          points={shape}
          className="fill-amber-400/30 stroke-amber-500"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {axes.map((a, i) => {
          const [x, y] = pointAt(i, Math.max(a.value, 0) / 100);
          return <circle key={a.axis} cx={x} cy={y} r="3" className="fill-amber-500" />;
        })}

        {/* 축 이름 */}
        {axes.map((a, i) => {
          const [x, y] = pointAt(i, 1.22);
          return (
            <text
              key={a.axis}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-500 text-[11px]"
            >
              {a.axis}
            </text>
          );
        })}
      </svg>

      <ul className="w-full sm:w-auto space-y-2">
        {axes.map((a) => (
          <li key={a.axis} className="flex items-center gap-3 text-sm">
            <span className="text-gray-600 w-10 shrink-0">{a.axis}</span>
            <div className="flex-1 sm:w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${a.value}%` }}
              />
            </div>
            <span className="text-gray-500 tabular-nums w-8 text-right shrink-0">{a.raw}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
