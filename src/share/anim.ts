/**
 * 같이 고르기의 공용 연출 시간표. 호스트는 이 시간이 끝나면 결과를 확정하고,
 * 모든 화면은 같은 시간표로 애니메이션을 그린다 — 그래서 함수가 순수해야 한다.
 */
import type { LadderRun, Roll } from './protocol';

export const ROLL_FIRST_STEPS = 12;
export const ROLL_NEXT_STEPS = 8;
const ROLL_LAND_MS = 520;

/** t 번째 깜빡임 뒤에 쉬는 시간 — 점점 느려지다 멈춘다 (소거법 무작위와 같은 곡선). */
const stepDelay = (t: number) => 40 + t * t * 2.6;

export type RollFrame = { at: number; id: string; pick: number; land: boolean };

export function rollTimeline(roll: Pick<Roll, 'seq' | 'speed'>): { frames: RollFrame[]; total: number } {
  const frames: RollFrame[] = [];
  let at = 0;
  roll.seq.forEach((steps, pick) => {
    steps.forEach((id, i) => {
      const land = i === steps.length - 1;
      frames.push({ at, id, pick, land });
      at += (land ? ROLL_LAND_MS : stepDelay(i + 1)) * roll.speed;
    });
  });
  return { frames, total: at };
}

export const LADDER_PATH_MS = 1500;
export const LADDER_STAGGER_MS = 320;
const LADDER_SETTLE_MS = 900;

export function ladderTimeline(run: Pick<LadderRun, 'cands' | 'speed'>) {
  const start = (i: number) => i * LADDER_STAGGER_MS * run.speed;
  const path = LADDER_PATH_MS * run.speed;
  const n = run.cands.length;
  return {
    start,
    path,
    total: start(Math.max(0, n - 1)) + path + LADDER_SETTLE_MS * run.speed,
  };
}
