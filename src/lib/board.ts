// 자유게시판 카테고리 정의 (클라이언트·서버 공용)

export interface BoardCategory {
  key: string;
  label: string;
  adminOnly?: boolean;
  // Tailwind 클래스 (뱃지용)
  badge: string;
}

export const BOARD_CATEGORIES: BoardCategory[] = [
  { key: '잡담', label: '잡담', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: '질문', label: '질문', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: '책추천', label: '책추천', badge: 'bg-green-100 text-green-700 border-green-200' },
  { key: '나눔', label: '나눔', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: '공지', label: '공지', adminOnly: true, badge: 'bg-amber-100 text-amber-800 border-amber-300' },
];

export const DEFAULT_CATEGORY = '잡담';

export function isValidCategory(key: string): boolean {
  return BOARD_CATEGORIES.some((c) => c.key === key);
}

export function categoryBadge(key: string | null | undefined): BoardCategory {
  return BOARD_CATEGORIES.find((c) => c.key === key) ?? BOARD_CATEGORIES[0];
}
