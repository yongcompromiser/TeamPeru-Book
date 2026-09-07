// 연말결산 테마.
//
// 해마다 다른 느낌을 내되 매년 화면을 새로 짜지 않아도 되도록 프리셋으로 둔다.
// 색만 바꾸는 게 아니라 배경 연출(canvas/blob/none)까지 바꿔서 인상이 달라지게 했다.

export type BackdropKind = 'constellation' | 'aurora' | 'grain';

export interface YearTheme {
  key: string;
  label: string;
  description: string;

  /** 페이지 전체 배경 */
  pageBg: string;
  /** 히어로 영역 배경 (그라데이션) */
  heroBg: string;
  backdrop: BackdropKind;

  /** 본문 텍스트 */
  text: string;
  textMuted: string;
  /** 강조(연도 숫자, 수치) */
  accent: string;
  accentSoft: string;

  /** 카드 */
  card: string;
  cardHover: string;
  /** 구분선 */
  divider: string;

  /** 히어로 위 대형 숫자에 쓰는 그라데이션 텍스트 */
  heroNumber: string;
}

export const YEAR_THEMES: YearTheme[] = [
  {
    key: 'midnight',
    label: '미드나잇',
    description: '깊은 남색 밤하늘에 금빛 별. 차분하고 묵직한 회고.',
    pageBg: 'bg-[#0b1020] text-slate-200',
    heroBg: 'bg-gradient-to-b from-[#0b1020] via-[#111a35] to-[#0b1020]',
    backdrop: 'constellation',
    text: 'text-slate-100',
    textMuted: 'text-slate-400',
    accent: 'text-amber-300',
    accentSoft: 'bg-amber-400/10 border-amber-400/25 text-amber-200',
    card: 'bg-white/[0.04] border-white/10 backdrop-blur-sm',
    cardHover: 'hover:bg-white/[0.07] hover:border-amber-300/40',
    divider: 'divide-white/10',
    heroNumber: 'bg-gradient-to-br from-amber-200 via-amber-400 to-orange-300',
  },
  {
    key: 'paper',
    label: '따뜻한 종이',
    description: '크림색 종이 위의 활자. 손편지 같은 결산.',
    pageBg: 'bg-[#faf6ee] text-stone-800',
    heroBg: 'bg-gradient-to-b from-[#f6ecd9] via-[#faf6ee] to-[#faf6ee]',
    backdrop: 'grain',
    text: 'text-stone-900',
    textMuted: 'text-stone-500',
    accent: 'text-amber-700',
    accentSoft: 'bg-amber-100/70 border-amber-200 text-amber-800',
    card: 'bg-white/80 border-stone-200 shadow-sm',
    cardHover: 'hover:border-amber-300 hover:shadow-md',
    divider: 'divide-stone-200',
    heroNumber: 'bg-gradient-to-br from-amber-700 via-orange-600 to-rose-600',
  },
  {
    key: 'neon',
    label: '네온',
    description: '검정 위 형광. 시상식처럼 화려하게.',
    pageBg: 'bg-[#08080c] text-zinc-200',
    heroBg: 'bg-gradient-to-b from-[#12061f] via-[#0a0a14] to-[#08080c]',
    backdrop: 'aurora',
    text: 'text-zinc-50',
    textMuted: 'text-zinc-400',
    accent: 'text-fuchsia-300',
    accentSoft: 'bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-200',
    card: 'bg-white/[0.04] border-white/10 backdrop-blur-sm',
    cardHover: 'hover:bg-white/[0.08] hover:border-fuchsia-400/50',
    divider: 'divide-white/10',
    heroNumber: 'bg-gradient-to-br from-fuchsia-300 via-violet-300 to-cyan-300',
  },
  {
    key: 'forest',
    label: '숲',
    description: '짙은 초록. 차분하게 쌓인 한 해.',
    pageBg: 'bg-[#0a1410] text-emerald-50',
    heroBg: 'bg-gradient-to-b from-[#0a1410] via-[#0f2019] to-[#0a1410]',
    backdrop: 'aurora',
    text: 'text-emerald-50',
    textMuted: 'text-emerald-200/60',
    accent: 'text-emerald-300',
    accentSoft: 'bg-emerald-400/10 border-emerald-400/25 text-emerald-200',
    card: 'bg-white/[0.04] border-white/10 backdrop-blur-sm',
    cardHover: 'hover:bg-white/[0.07] hover:border-emerald-300/40',
    divider: 'divide-white/10',
    heroNumber: 'bg-gradient-to-br from-emerald-200 via-teal-300 to-lime-300',
  },
];

export const DEFAULT_THEME_KEY = 'midnight';

export function getTheme(key: string | null | undefined): YearTheme {
  return YEAR_THEMES.find((t) => t.key === key) ?? YEAR_THEMES[0];
}

export function isDarkTheme(theme: YearTheme): boolean {
  return theme.key !== 'paper';
}
