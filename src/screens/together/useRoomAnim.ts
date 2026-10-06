/**
 * 호스트가 정한 무작위 뽑기를 각자 화면에서 같은 시간표(anim.ts)로 재생한다.
 * 이미 끝난 뽑기를 늦게 받은 경우(나중에 들어온 사람)에는 재생하지 않는다.
 */
import { useEffect, useRef, useState } from 'react';

import { rollTimeline } from '../../share/anim';
import type { Roll } from '../../share/protocol';

/** cursor: 스포트라이트가 지금 머무는 카드, landed: 당첨이 확정된 카드들 */
export type RollView = { id: string; by: string; count: number; cursor: string | null; landed: string[] };

export function useRollAnim(roll: Roll | null): RollView | null {
  const [view, setView] = useState<RollView | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!roll || seen.current.has(roll.id)) return;
    seen.current.add(roll.id);
    if (roll.done) return;
    const { frames, total } = rollTimeline(roll);
    const ids: ReturnType<typeof setTimeout>[] = [];
    setView({ id: roll.id, by: roll.by, count: roll.count, cursor: roll.seq[0]?.[0] ?? null, landed: [] });
    frames.forEach((f) => {
      ids.push(
        setTimeout(() => {
          setView((v) =>
            v && v.id === roll.id
              ? {
                  ...v,
                  cursor: f.id,
                  landed: f.land && !v.landed.includes(f.id) ? [...v.landed, f.id] : v.landed,
                }
              : v,
          );
        }, f.at),
      );
    });
    ids.push(setTimeout(() => setView((v) => (v && v.id === roll.id ? null : v)), total));
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
