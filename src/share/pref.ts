/**
 * 하트 걸기 — 호스트와 화면이 같이 쓰는 계산. 무작위는 없다: 하트가 많은 순서대로 순위를 매기고,
 * 하트 수가 같으면 같은 순위(공동 n위)로 둔다.
 */
import type { Member, PrefRun } from './protocol';

type Run = Pick<PrefRun, 'cands' | 'hearts' | 'bets' | 'pass'>;

export const betSum = (b: readonly number[]) => b.reduce((a, n) => a + n, 0);

/** 아무것도 안 건 하트 (후보 수만큼 0) */
export const noBet = (run: Pick<PrefRun, 'cands'>) => run.cands.map(() => 0);

/** 이 사람이 건 하트 (안 걸었으면 모두 0) */
export const betOf = (run: Run, id: string) => run.bets[id] ?? noBet(run);

/**
 * 받은 하트를 검증한다 — 후보 수와 길이가 같고, 0 이상 정수이며, 합이 하트 수를 넘지 않아야 한다.
 * 어긋나면 null. 화면도 보내기 전에 같은 함수로 확인한다.
 */
export function cleanBet(raw: unknown, run: Pick<PrefRun, 'cands' | 'hearts'>): number[] | null {
  if (!Array.isArray(raw) || raw.length !== run.cands.length) return null;
  const out = raw.map((x) => Number(x));
  if (out.some((n) => !Number.isInteger(n) || n < 0 || n > run.hearts)) return null;
  return betSum(out) > run.hearts ? null : out;
}

/** 다 건 사람 — 하트를 모두 걸었거나 '아무데나 좋아요' 를 눌렀다 */
export const isDone = (run: Run, id: string) =>
  run.pass.includes(id) || betSum(run.bets[id] ?? []) >= run.hearts;

/** 후보별 하트 합계 (cands 순서) */
export function totals(run: Run): number[] {
  const t = noBet(run);
  for (const b of Object.values(run.bets))
    b.forEach((n, i) => {
      if (i < t.length) t[i] += n;
    });
  return t;
}

/** 후보별로 누가 몇 개 걸었는지 (members 순서) */
export function voters(run: Run, members: readonly Member[]) {
  return run.cands.map((_, i) =>
    members.flatMap((m) => {
      const n = run.bets[m.id]?.[i] ?? 0;
      return n ? [{ m, n }] : [];
    }),
  );
}

/** 순위 (cands 순서) — 하트가 같으면 같은 순위 (1, 1, 3 …) */
export const ranks = (t: readonly number[]) => t.map((v) => 1 + t.filter((x) => x > v).length);

/** 순위대로 늘어놓은 칸 번호 — 같은 순위는 원래 칸 순서 */
export const rankOrder = (t: readonly number[]) => t.map((_, i) => i).sort((a, b) => t[b] - t[a] || a - b);

/** 하트를 받은 1위가 둘 이상이면 그 후보들 */
export function topTie(run: Run): string[] {
  const t = totals(run);
  const max = Math.max(0, ...t);
  const ids = run.cands.filter((_, i) => t[i] === max);
  return max > 0 && ids.length > 1 ? ids : [];
}

/** 하트를 하나도 못 받은 후보 — 받은 곳과 못 받은 곳이 섞여 있을 때만 */
export function zeroIds(run: Run): string[] {
  const t = totals(run);
  const ids = run.cands.filter((_, i) => !t[i]);
  return ids.length && ids.length < run.cands.length ? ids : [];
}

/** '1위 진주집 ♥5 · 공동 2위 샐러디·만리향 ♥2' */
export function summaryText(run: Run, nameOf: (id: string) => string) {
  const t = totals(run);
  if (!betSum(t)) return '아무도 하트를 걸지 않았어요';
  const rk = ranks(t);
  const out: string[] = [];
  const done = new Set<number>();
  for (const i of rankOrder(t)) {
    if (done.has(rk[i])) continue;
    done.add(rk[i]);
    const same = run.cands.filter((_, j) => rk[j] === rk[i]);
    out.push(`${same.length > 1 ? '공동 ' : ''}${rk[i]}위 ${same.map(nameOf).join('·')} ♥${t[i]}`);
  }
  return out.join(' · ');
}
