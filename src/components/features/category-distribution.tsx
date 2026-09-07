'use client';

import { cn } from '@/lib/utils';
import type { CategorySlice } from '@/lib/stats';

// 분야마다 고정 색을 준다. 같은 분야는 어느 화면에서든 같은 색으로 보이게 하기 위함.
const CATEGORY_COLORS: Record<string, string> = {
  '문학/소설': 'bg-rose-400',
  인문학: 'bg-amber-400',
  사회과학: 'bg-orange-400',
  자기계발: 'bg-lime-400',
  '경제/경영': 'bg-emerald-400',
  과학: 'bg-sky-400',
  예술: 'bg-violet-400',
  역사: 'bg-yellow-500',
  철학: 'bg-indigo-400',
  에세이: 'bg-teal-400',
  기타: 'bg-slate-400',
  미분류: 'bg-gray-300',
};

function colorOf(category: string): string {
  return CATEGORY_COLORS[category] ?? 'bg-slate-400';
}

interface Props {
  categories: CategorySlice[];
  emptyText?: string;
}

export function CategoryDistribution({ categories, emptyText = '아직 읽은 책이 없습니다.' }: Props) {
  if (categories.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {/* 한 줄 누적 막대 */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {categories.map((c) => (
          <div
            key={c.category}
            className={cn('h-full', colorOf(c.category))}
            style={{ width: `${c.percent}%` }}
            title={`${c.category} ${c.count}권 (${c.percent}%)`}
          />
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
        {categories.map((c) => (
          <li key={c.category} className="flex items-center gap-2 text-sm">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', colorOf(c.category))} />
            <span
              className={cn(
                'truncate',
                c.category === '미분류' ? 'text-gray-400' : 'text-gray-700'
              )}
            >
              {c.category}
            </span>
            <span className="ml-auto text-gray-500 tabular-nums shrink-0">
              {c.count}권 · {c.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
