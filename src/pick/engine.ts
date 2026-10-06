/**
 * 고르기 엔진의 순수 로직. 목업의 알고리즘을 그대로 옮겼다 — 확률과 기하는 건드리지 않는다.
 */
import type { ModeId, PickItem } from '../lib/types';
import { pick, shuffle } from '../lib/util';

// ---------------------------------------------------------------- 게임 상태

export type ElimG = {
  kind: 'elim';
  out: Record<string, boolean>;
  flash: string | null;
  busy: boolean;
};

export type CupG = {
  kind: 'cup';
  round: PickItem[];
  next: PickItem[];
  i: number;
  chosen: string | null;
  enter: boolean;
  roundNo: number;
  done: boolean;
};

export type LadderG = {
  kind: 'ladder';
  rungs: boolean[][];
  slots: boolean[];
  drawn: Record<number, boolean>;
  revealed: Record<number, boolean>;
};

export type RouletteG = {
  kind: 'roulette';
  wheel: PickItem[];
  rot: number;
  noAnim: boolean;
  spinning: boolean;
  winners: PickItem[];
  last: PickItem | null;
};

export type SlotReel = { strip: PickItem[]; pos: number; anim: boolean; dur: number };

export type SlotG = {
  kind: 'slot';
  reels: SlotReel[];
  pulling: boolean;
  pulled: boolean;
  winners: PickItem[];
};

export type AiG = {
  kind: 'ai';
  mood: Record<string, boolean>;
  text: string;
  loading: boolean;
  /** key -> 추천 이유. null 이면 아직 물어보지 않은 상태. */
  picks: Record<string, string> | null;
  scan: string | null;
  error: string;
};

export type Game = ElimG | CupG | LadderG | RouletteG | SlotG | AiG;

// ---------------------------------------------------------------- 월드컵

/**
 * 라운드를 정규화한다. 홀수면 마지막 한 곳은 부전승으로 다음 라운드에 올린다.
 * 남은 수가 keep 이하가 되면 done 을 세워 돌려준다.
 */
export function cupNorm(g: CupG, keep: number): CupG {
  let round = g.round;
  let next = [...g.next];
  let i = g.i;
  let roundNo = g.roundNo;
  for (;;) {
    if (i < round.length && i + 1 >= round.length) {
      next.push(round[i]);
      i += 1;
    }
    if (i >= round.length) {
      if (next.length <= keep) return { ...g, round, next, i, roundNo, done: true };
      round = shuffle(next);
      next = [];
      i = 0;
      roundNo += 1;
      continue;
    }
    return { ...g, round, next, i, roundNo, done: false };
  }
}

export const cupRoundLabel = (size: number) =>
  size <= 2 ? '결승' : size <= 4 ? '준결승' : `${2 ** Math.ceil(Math.log2(size))}강`;

// ---------------------------------------------------------------- 사다리

const LADDER_ROWS = 8;

export function ladderGen(n: number, keep: number): LadderG {
  const rungs: boolean[][] = Array.from({ length: LADDER_ROWS }, () =>
    Array<boolean>(Math.max(0, n - 1)).fill(false),
  );
  // 같은 행에서 가로줄이 연달아 붙지 않게 한다 (왼쪽 칸이 켜져 있으면 건너뜀).
  for (let r = 0; r < LADDER_ROWS; r++) {
    for (let c = 0; c < n - 1; c++) {
      if (c > 0 && rungs[r][c - 1]) continue;
      rungs[r][c] = Math.random() < 0.42;
    }
  }
  // 한 줄도 없는 열이 있으면 보정한다 — 없으면 그 후보는 절대 움직이지 않는다.
  for (let c = 0; c < n - 1; c++) {
    if (rungs.some((row) => row[c])) continue;
    const ok: number[] = [];
    for (let r = 0; r < LADDER_ROWS; r++) {
      if (!(c > 0 && rungs[r][c - 1]) && !(c < n - 2 && rungs[r][c + 1])) ok.push(r);
    }
    if (ok.length) rungs[pick(ok)][c] = true;
  }
  const wins = shuffle([...Array(n).keys()]).slice(0, keep);
  const slots = Array.from({ length: n }, (_, i) => wins.includes(i));
  return { kind: 'ladder', rungs, slots, drawn: {}, revealed: {} };
}

export type LadderGeo = {
  W: number;
  H: number;
  pad: number;
  x: (c: number) => number;
  y: (r: number) => number;
};

export function ladderGeo(n: number): LadderGeo {
  const W = 720;
  const H = 300;
  const pad = 56;
  const x = (c: number) => (n === 1 ? W / 2 : pad + (c * (W - 2 * pad)) / (n - 1));
  const y = (r: number) => ((r + 1) * H) / (LADDER_ROWS + 1);
  return { W, H, pad, x, y };
}

/** 사다리 한 줄을 따라 내려간 경로와 도착 열. */
export function trace(g: LadderG, i: number, geo: LadderGeo) {
  let c = i;
  const pts: [number, number][] = [[geo.x(c), 0]];
  g.rungs.forEach((row, r) => {
    if (row[c]) {
      pts.push([geo.x(c), geo.y(r)], [geo.x(c + 1), geo.y(r)]);
      c += 1;
    } else if (c > 0 && row[c - 1]) {
      pts.push([geo.x(c), geo.y(r)], [geo.x(c - 1), geo.y(r)]);
      c -= 1;
    }
  });
  pts.push([geo.x(c), geo.H]);
  return { pts, end: c };
}

// ---------------------------------------------------------------- 초기 상태

export function initG(mode: ModeId, cands: PickItem[], keep: number): Game {
  switch (mode) {
    case 'elim':
      return { kind: 'elim', out: {}, flash: null, busy: false };
    case 'cup':
      return cupNorm(
        {
          kind: 'cup',
          round: cands,
          next: [],
          i: 0,
          chosen: null,
          enter: true,
          roundNo: 1,
          done: false,
        },
        keep,
      );
    case 'ladder':
      return ladderGen(cands.length, keep);
    case 'roulette':
      return {
        kind: 'roulette',
        wheel: [...cands],
        rot: 0,
        noAnim: false,
        spinning: false,
        winners: [],
        last: null,
      };
    case 'slot':
      return {
        kind: 'slot',
        reels: Array.from({ length: keep }, (_, r) => ({
          strip: [
            cands[r % cands.length],
            cands[(r + 1) % cands.length],
            cands[(r + 2) % cands.length],
          ],
          pos: 1,
          anim: false,
          dur: 0,
        })),
        pulling: false,
        pulled: false,
        winners: [],
      };
    case 'ai':
      return { kind: 'ai', mood: {}, text: '', loading: false, picks: null, scan: null, error: '' };
  }
}
