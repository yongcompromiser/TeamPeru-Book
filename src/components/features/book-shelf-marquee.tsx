'use client';

export interface ShelfBook {
  id: string;
  title: string;
  cover_url: string;
}

/**
 * 팀 페루가 읽은 책 표지가 천천히 옆으로 흐르는 트로피 선반.
 * 목록을 두 번 이어 붙이고 -50% 이동시켜 끊김 없이 반복한다.
 * prefers-reduced-motion 이면 흐르지 않고 가만히 있는다(가로 스크롤로 볼 수 있음).
 */
export function BookShelfMarquee({ books }: { books: ShelfBook[] }) {
  if (!books || books.length === 0) return null;
  const row = [...books, ...books]; // 끊김 없는 반복을 위해 2배

  return (
    <div
      className="animate-fade-up relative overflow-hidden rounded-2xl py-6 shadow-sm"
      style={{ backgroundImage: 'linear-gradient(160deg, #241a37, #15111f)' }}
    >
      {/* 양옆 페이드 */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16" style={{ backgroundImage: 'linear-gradient(90deg, #1c1531, transparent)' }} />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16" style={{ backgroundImage: 'linear-gradient(270deg, #15111f, transparent)' }} />

      <div className="mb-3 px-6">
        <p className="text-xs font-medium tracking-wide text-amber-200/70">🏆 팀 페루가 함께 읽은 책들</p>
      </div>

      <div className="group flex w-max animate-book-marquee items-end gap-4 px-6">
        {row.map((b, i) => (
          <div key={`${b.id}-${i}`} className="flex-shrink-0">
            <img
              src={b.cover_url}
              alt={b.title}
              title={b.title}
              loading="lazy"
              className="h-28 w-auto rounded-md object-cover shadow-lg ring-1 ring-white/10 sm:h-32"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
