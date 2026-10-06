/**
 * 호스트가 정한 연출(무작위 뽑기·사다리)을 각자 화면에서 같은 시간표로 재생한다.
 * 이미 끝난 연출을 늦게 받은 경우(나중에 들어온 사람)에는 재생하지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ladderTimeline, rollTimeline } from '../../share/anim';
import type { LadderRun, Roll } from '../../share/protocol';

export type RollView = {
  id: string;
  by: string;
  count: number;
  flash: string | null;
  landed: string[];
  active: boolean;
};

const LANDED_HOLD_MS = 1600;

export function useRollAnim(roll: Roll | null): RollView | null {
  const [view, setView] = useState<RollView | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!roll || seen.current.has(roll.id)) return;
    seen.current.add(roll.id);
    if (roll.done) return;
    const { frames, total } = rollTimeline(roll);
    const ids: ReturnType<typeof setTimeout>[] = [];
    const base = { id: roll.id, by: roll.by, count: roll.count };
    setView({ ...base, flash: null, landed: [], active: true });
    frames.forEach((f) => {
      ids.push(
        setTimeout(() => {
          setView((v) =>
            v && v.id === roll.id
              ? {
                  ...v,
                  flash: f.id,
                  landed: f.land && !v.landed.includes(f.id) ? [...v.landed, f.id] : v.landed,
                }
              : v,
          );
        }, f.at),
      );
    });
    ids.push(
      setTimeout(
        () => setView((v) => (v && v.id === roll.id ? { ...v, flash: null, active: false } : v)),
        total,
      ),
    );
    ids.push(setTimeout(() => setView((v) => (v && v.id === roll.id ? null : v)), total + LANDED_HOLD_MS));
    return () => {
      ids.forEach(clearTimeout);
      // StrictMode 의 이펙트 재실행에서도 다시 재생되도록 표시를 지운다.
      seen.current.delete(roll.id);
    };
    // 같은 뽑기는 한 번만 재생한다 — done 이 바뀌어도 다시 돌리지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll?.id]);

  return view;
}

export type LadderView = {
  run: LadderRun;
  drawn: Record<number, boolean>;
  revealed: Record<number, boolean>;
  finished: boolean;
};

export function useLadderAnim(run: LadderRun | null): [LadderView | null, () => void] {
  const [view, setView] = useState<LadderView | null>(null);
  const seen = useRef(new Set<string>());

  // 결과(done)가 오면 run 을 최신으로 바꿔 둔다.
  useEffect(() => {
    if (run) setView((v) => (v && v.run.id === run.id ? { ...v, run } : v));
  }, [run]);

  useEffect(() => {
    if (!run || seen.current.has(run.id)) return;
    seen.current.add(run.id);
    if (run.done) return;
    const tl = ladderTimeline(run);
    setView({ run, drawn: {}, revealed: {}, finished: false });
    const ids: ReturnType<typeof setTimeout>[] = [];
    run.cands.forEach((_, i) => {
      ids.push(
        setTimeout(
          () => setView((v) => (v ? { ...v, drawn: { ...v.drawn, [i]: true } } : v)),
          tl.start(i) + 60,
        ),
      );
      ids.push(
        setTimeout(
          () => setView((v) => (v ? { ...v, revealed: { ...v.revealed, [i]: true } } : v)),
          tl.start(i) + tl.path + 60,
        ),
      );
    });
    ids.push(setTimeout(() => setView((v) => (v ? { ...v, finished: true } : v)), tl.total));
    return () => {
      ids.forEach(clearTimeout);
      seen.current.delete(run.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id]);

  const close = useCallback(() => setView(null), []);
  return [view, close];
}
