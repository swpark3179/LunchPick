/**
 * 같이 고르기의 사다리 — 디자인 시안의 기하(640×300, 가로줄 8단)를 그대로 쓴다.
 * 호스트는 genLadder 로 사다리를 만들고, 모든 화면은 traceLadder 로 같은 경로를 그린다.
 */
import { shuffle } from '../lib/util';

export const LW = 640;
export const LH = 300;
export const LR = 8;

export const lx = (n: number, i: number) => (n > 1 ? 50 + i * (540 / (n - 1)) : LW / 2);
export const ly = (r: number) => 22 + r * (256 / (LR - 1));

const RUNG_P = 0.45;

export function genLadder(n: number, keep: number): { rungs: boolean[][]; slots: boolean[] } {
  const rungs: boolean[][] = [];
  for (let r = 0; r < LR; r++) {
    const row: boolean[] = [];
    // 같은 단에서 가로줄이 이어 붙지 않게 한다.
    for (let c = 0; c < n - 1; c++) row.push(Math.random() < RUNG_P && !(c > 0 && row[c - 1]));
    rungs.push(row);
  }
  // 가로줄이 하나도 없는 칸이 있으면 하나 놓는다 — 없으면 그 후보는 제자리로만 내려간다.
  for (let c = 0; c < n - 1; c++) {
    if (rungs.some((row) => row[c])) continue;
    for (const r of shuffle([...Array(LR).keys()])) {
      if (!rungs[r][c - 1] && !rungs[r][c + 1]) {
        rungs[r][c] = true;
        break;
      }
    }
  }
  const win = shuffle([...Array(n).keys()]).slice(0, keep);
  return { rungs, slots: Array.from({ length: n }, (_, i) => win.includes(i)) };
}

/** i 번째 줄을 따라 내려간 경로(SVG points)와 도착 칸 */
export function traceLadder(rungs: boolean[][], n: number, i: number): { pts: string; end: number } {
  let col = i;
  const pts: [number, number][] = [[lx(n, col), 0]];
  for (let r = 0; r < LR; r++) {
    pts.push([lx(n, col), ly(r)]);
    if (rungs[r]?.[col]) {
      col += 1;
      pts.push([lx(n, col), ly(r)]);
    } else if (col > 0 && rungs[r]?.[col - 1]) {
      col -= 1;
      pts.push([lx(n, col), ly(r)]);
    }
  }
  pts.push([lx(n, col), LH]);
  return { pts: pts.map((p) => p.join(',')).join(' '), end: col };
}

/** 사다리에서 살아남는 후보 */
export const ladderWinners = (run: { cands: string[]; rungs: boolean[][]; slots: boolean[] }) =>
  run.cands.filter((_, i) => run.slots[traceLadder(run.rungs, run.cands.length, i).end]);
