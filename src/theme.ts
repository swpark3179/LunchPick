/**
 * 디자인 토큰. 값은 `점심픽.dc.html` 에서 그대로 옮겼다 — 임의로 바꾸지 말 것.
 */

export const AC = 'oklch(0.56 0.16 40)'; // 액센트
export const AC_HOVER = 'oklch(0.5 0.16 40)';
export const LINE = 'oklch(0.9 0.006 75)';
export const INK = 'oklch(0.24 0.012 60)';
export const SOFT = 'oklch(0.965 0.025 50)';
export const AINK = 'oklch(0.45 0.14 40)';

export const DANGER = 'oklch(0.5 0.17 25)';
export const DANGER_STRONG = 'oklch(0.55 0.19 25)';
export const OK_BG = 'oklch(0.95 0.04 150)';
export const OK_FG = 'oklch(0.4 0.1 150)';
export const STAR = 'oklch(0.72 0.15 75)';

/** 본문 배경 / 패널 / 구분선 등 자주 쓰는 중립색 */
export const PANEL = 'oklch(0.955 0.005 75)';
export const APP_BG = 'oklch(0.975 0.004 75)';
export const HAIRLINE = 'oklch(0.91 0.006 75)';
export const SEG_TRACK = 'oklch(0.935 0.005 75)';
export const MUTED = 'oklch(0.5 0.012 60)';
export const MUTED_2 = 'oklch(0.55 0.012 60)';
export const MUTED_3 = 'oklch(0.6 0.01 60)';

export const CATS = ['한식', '중식', '일식', '양식', '분식', '아시안', '기타'] as const;
export type Cat = (typeof CATS)[number];

/** 분류별 색상 hue */
export const CH: Record<string, number> = {
  한식: 30,
  중식: 85,
  일식: 250,
  양식: 150,
  분식: 355,
  아시안: 115,
  기타: 300,
};

/** 사다리/룰렛에서 후보별로 돌려쓰는 hue */
export const HUES = [40, 155, 250, 320, 85, 200, 10, 285, 125, 60, 230, 350];

export const catDot = (c: string) => `oklch(0.62 0.15 ${CH[c] ?? 300})`;
export const catBg = (c: string) => `oklch(0.95 0.035 ${CH[c] ?? 300})`;
export const catFg = (c: string) => `oklch(0.42 0.11 ${CH[c] ?? 300})`;

/** 카드 1px 링 + 미세 그림자 (목록 카드 기본 상태) */
export const CARD_RING = '0 0 0 1px oklch(0.91 0.006 75), 0 1px 2px oklch(0.5 0.02 60 / .05)';
export const PANEL_RING = '0 0 0 1px oklch(0.91 0.006 75)';
export const SELECTED_RING = `0 0 0 2px ${AC}`;
