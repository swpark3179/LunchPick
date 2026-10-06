/**
 * 같이 고르기의 공용 연출 시간표. 호스트는 이 시간이 끝나면 결과를 확정하고,
 * 모든 화면은 같은 시간표로 애니메이션을 그린다 — 그래서 함수가 순수해야 한다.
 */
import type { Roll } from './protocol';

/** 첫 당첨까지는 오래, 다음부터는 짧게 건너뛴다. */
export const ROLL_FIRST_HOPS = 16;
export const ROLL_NEXT_HOPS = 8;
const LAND_PAUSE_MS = 340;
const AFTER_LAND_MS = 480;
const APPLY_MS = 250;

export type RollFrame = { at: number; id: string; pick: number; land: boolean };

/** 스포트라이트가 j 번째로 건너뛸 때까지의 간격 — 처음엔 빠르고 끝에서 느려진다. */
const hopDelay = (j: number, hops: number) => 50 + Math.pow(j / hops, 2.2) * 240;

export function rollTimeline(roll: Pick<Roll, 'seq' | 'speed'>): { frames: RollFrame[]; total: number } {
  const frames: RollFrame[] = [];
  let at = 0;
  roll.seq.forEach((steps, pick) => {
    const hops = steps.length - 1;
    for (let j = 0; j < hops; j++) {
      at += hopDelay(j, hops) * roll.speed;
      frames.push({ at, id: steps[j], pick, land: false });
    }
    at += LAND_PAUSE_MS * roll.speed;
    frames.push({ at, id: steps[hops], pick, land: true });
    at += AFTER_LAND_MS * roll.speed;
  });
  return { frames, total: at + APPLY_MS * roll.speed };
}

/** 사다리: 한 줄을 그리는 시간, 도착 후 결과가 드러나는 시점, 전체 출발 간격 */
export const LADDER_PATH_MS = 1400;
export const LADDER_REVEAL_MS = 1450;
export const LADDER_STAGGER_MS = 280;

/** AI 정렬 뒤 ▲▼ 표시를 남겨 두는 시간 */
export const DELTA_HOLD_MS = 3200;
