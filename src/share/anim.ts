/**
 * 같이 고르기의 공용 연출 시간표. 호스트는 이 시간이 끝나면 결과를 확정하고,
 * 모든 화면은 같은 시간표로 애니메이션을 그린다 — 그래서 함수가 순수해야 한다.
 */
import { pick as pickOne } from '../lib/util';
import type { Roll } from './protocol';

/** 첫 당첨까지는 오래, 다음부터는 짧게 건너뛴다. */
export const ROLL_FIRST_HOPS = 16;
export const ROLL_NEXT_HOPS = 8;
const LAND_PAUSE_MS = 340;
const AFTER_LAND_MS = 480;
const APPLY_MS = 250;

export type RollFrame = { at: number; id: string; pick: number; land: boolean };

/**
 * 호스트가 뽑기를 시작할 때 — 당첨(picks)마다 스포트라이트가 ids 위를 건너뛰는 순서를 정한다 (마지막이 당첨).
 * 무작위라 호스트만 부르고, 정한 순서를 방 상태로 보내 모두가 같은 연출을 본다.
 */
export function rollSteps(ids: readonly string[], picks: readonly string[]): string[][] {
  return picks.map((p, k) => {
    const hops = k === 0 ? ROLL_FIRST_HOPS : ROLL_NEXT_HOPS;
    const steps: string[] = [];
    for (let j = 0; j < hops; j++) {
      let id = pickOne(ids);
      // 같은 카드에 연달아 머무르지 않게 옆으로 비킨다.
      if (id === steps[steps.length - 1] && ids.length > 1) id = ids[(ids.indexOf(id) + 1) % ids.length];
      steps.push(id);
    }
    steps.push(p);
    return steps;
  });
}

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

/**
 * 하트 걸기 — 화면 연출만 (호스트는 기다리지 않는다). 각자 설정의 애니메이션 속도를 곱한다.
 * 내 하트가 트레이와 칸 사이를 날아가는 시간, 남이 건 하트가 떨어져 앉는 시간, 마감 뒤 칸이 순위 자리로
 * 옮겨 가는 시간, 순위 배지가 하나씩 튀어나오는 간격, 1위의 하트 터짐.
 */
export const PREF_FLY_MS = 560;
export const PREF_DROP_MS = 520;
export const PREF_SORT_MS = 700;
export const PREF_STAGGER_MS = 160;
export const PREF_BURST_MS = 1300;
/** 시소가 기울며 출렁이는 시간 (후보가 2곳일 때) */
export const PREF_TILT_MS = 850;

/** AI 정렬 뒤 ▲▼ 표시를 남겨 두는 시간 */
export const DELTA_HOLD_MS = 3200;
