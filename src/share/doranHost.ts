/**
 * 도란식사 정하기 — 호스트 쪽 처리. host.ts 가 방 상태와 도우미(ctx)를 넘겨 만든다.
 *
 * 점심 방과 다른 점
 * - 식당 목록은 호스트 PC 의 식당 목록이 아니라 방 안에서 모두가 입력한 것이다 (useData 를 건드리지 않는다).
 * - 고르는 단위는 선택지(식당 + 메뉴 구성)다. 살아 있는 선택지는 cands 에 두어 사다리·하트 걸기가 그대로 돈다.
 *   빠진 선택지는 cands 에서만 빠지고 목록에는 남아 다시 넣을 수 있다.
 * - 무작위는 '후보 올리기'가 아니라 살아 있는 선택지 중 n개만 '남기기'다.
 * - 확정하면 바로 예약으로 간다 (각자 메뉴 고르기 없음). 먹은 기록도 남기지 않는다.
 */
import { cleanItems, itemsText } from './order';
import { rollSteps, rollTimeline } from './anim';
import {
  candLabel,
  choiceName,
  choiceObj,
  choiceOf,
  cleanDoranRest,
  moneyText,
  nameTaken,
  restSig,
  sameItems,
} from './doran';
import { type Choice, type DoranRestInput, LIMITS, type Roll, type RoomState } from './protocol';
import { shuffle, uid, won } from '../lib/util';
import type { Restaurant } from '../lib/types';

export type DoranCtx = {
  get: () => RoomState;
  update: (fn: (s: RoomState) => RoomState) => void;
  withSys: (s: RoomState, text: string, by?: string) => RoomState;
  reject: (by: string, msg: string) => void;
  /** 채팅에 쓰는 짧은 이름 */
  nm: (id: string) => string;
  /** 확정·뽑기·하트 걸기 중이면 거절하고 true */
  blocked: (by: string) => boolean;
  rolling: () => boolean;
  later: (fn: () => void, ms: number) => void;
  /** 호스트의 애니메이션 속도 배율 */
  speed: () => number;
  /** 지운 선택지를 보던 사람의 '보는 중' 표시를 거둔다 */
  dropFocus: (ids: string[]) => void;
};

const cleanText = (raw: unknown, max: number) =>
  String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const omit = <T>(o: Record<string, T>, ids: readonly string[]) => {
  const out = { ...o };
  ids.forEach((id) => delete out[id]);
  return out;
};

export function doranHandlers(c: DoranCtx) {
  const st = c.get;
  const restOf = (id: string) => st().restaurants.find((r) => r.id === id);
  const label = (id: string, s = st()) => candLabel(s, id);
  /** 살아 있는 선택지 (만든 순서) */
  const liveIds = (s: RoomState) => s.choices.filter((x) => s.cands[x.id]).map((x) => x.id);

  // ------------------------------------------------------------ 식당

  const saveRest = (by: string, raw: DoranRestInput) => {
    const s = st();
    const wantId = raw && typeof raw === 'object' && raw.id ? String(raw.id) : '';
    const cur = wantId ? restOf(wantId) : undefined;
    if (wantId && !cur) return c.reject(by, '그 식당을 찾을 수 없어요. 다른 사람이 지웠을 수 있어요.');
    if (!cur && s.restaurants.length >= LIMITS.doranRests)
      return c.reject(by, `식당은 ${LIMITS.doranRests}곳까지 올릴 수 있어요.`);
    const r = cleanDoranRest(raw, { cur, taken: new Set(s.restaurants.map((x) => x.id)) });
    if (!r) return c.reject(by, '식당 이름을 적어 주세요.');
    if (nameTaken(s.restaurants, r.name, r.id)) return c.reject(by, `‘${r.name}’ 식당은 이미 있어요.`);
    if (cur && restSig(cur) === restSig(r)) return;
    c.update((s) => {
      const restaurants = cur ? s.restaurants.map((x) => (x.id === r.id ? r : x)) : [...s.restaurants, r];
      // 메뉴가 바뀌면 그 식당 선택지의 메뉴 줄도 새 메뉴에 맞춘다 — 가격이 정해지면 합계가 따라 바뀐다.
      const choices = cur
        ? s.choices.map((x) =>
            x.restId === r.id ? { ...x, items: cleanItems(x.items, r, LIMITS.reserveQty) } : x,
          )
        : s.choices;
      return c.withSys(
        { ...s, restaurants, choices, edited: cur ? { ...s.edited, [r.id]: Date.now() } : s.edited },
        cur
          ? `${c.nm(by)}님이 ‘${r.name}’ 정보를 고쳤어요`
          : `${c.nm(by)}님이 ‘${r.name}’ 식당을 올렸어요${r.menus.length ? ` · 메뉴 ${r.menus.length}개` : ''}`,
        by,
      );
    });
  };

  /** 내 PC 에 저장해 둔 식당들 — 방에 이미 있는 식당(같은 id·이름)은 건너뛴다 */
  const loadRests = (by: string, raw: unknown) => {
    const s = st();
    const list = Array.isArray(raw) ? raw.slice(0, LIMITS.doranRests) : [];
    const ids = new Set(s.restaurants.map((x) => x.id));
    const names = new Set(s.restaurants.map((x) => x.name.trim().toLowerCase()));
    const room = LIMITS.doranRests - s.restaurants.length;
    const added: Restaurant[] = [];
    for (const one of list) {
      if (added.length >= room) break;
      const rawId = one && typeof one === 'object' ? String((one as { id?: unknown }).id ?? '') : '';
      if (rawId && ids.has(rawId)) continue;
      const r = cleanDoranRest(one, { taken: ids, keepId: true });
      if (!r || names.has(r.name.trim().toLowerCase())) continue;
      ids.add(r.id);
      names.add(r.name.trim().toLowerCase());
      added.push(r);
    }
    if (!added.length)
      return c.reject(
        by,
        room <= 0
          ? `식당은 ${LIMITS.doranRests}곳까지 올릴 수 있어요.`
          : list.length
            ? '고른 식당은 이미 방에 있어요.'
            : '불러올 식당이 없어요.',
      );
    c.update((s) =>
      c.withSys(
        { ...s, restaurants: [...s.restaurants, ...added] },
        `${c.nm(by)}님이 저장해 둔 식당 ${added.length}곳을 불러왔어요 · ${added.map((r) => r.name).join(', ')}`,
        by,
      ),
    );
  };

  const removeRest = (by: string, restId: string) => {
    const s = st();
    const r = restOf(restId);
    if (!r) return;
    const mine = s.choices.filter((x) => x.restId === restId).map((x) => x.id);
    if (s.final?.restId === restId)
      return c.reject(by, '확정된 선택지의 식당이에요. 확정을 푼 뒤에 지울 수 있어요.');
    if (c.rolling()) return c.reject(by, '무작위로 뽑는 중이에요. 끝나면 다시 해 주세요.');
    if (s.ladder?.cands.some((id) => mine.includes(id)))
      return c.reject(by, '사다리에 올라간 선택지가 있는 식당이에요. 사다리를 닫은 뒤에 지워 주세요.');
    if (s.pref?.cands.some((id) => mine.includes(id)))
      return c.reject(by, '하트 걸기에 올라간 선택지가 있는 식당이에요. 하트 걸기를 닫은 뒤에 지워 주세요.');
    c.update((s) =>
      c.withSys(
        {
          ...s,
          restaurants: s.restaurants.filter((x) => x.id !== restId),
          choices: s.choices.filter((x) => x.restId !== restId),
          cands: omit(s.cands, mine),
          prefTally: s.prefTally ? omit(s.prefTally, mine) : null,
          edited: omit(s.edited, [restId]),
        },
        `${c.nm(by)}님이 ‘${r.name}’ 식당을 지웠어요${mine.length ? ` · 선택지 ${mine.length}개도 함께` : ''}`,
        by,
      ),
    );
    c.dropFocus(mine);
  };

  // ------------------------------------------------------------ 선택지

  /** 같은 식당·같은 메뉴 구성의 선택지 (자기 자신은 빼고) */
  const twinOf = (s: RoomState, restId: string, items: Choice['items'], selfId?: string) =>
    s.choices.find((x) => x.id !== selfId && x.restId === restId && sameItems(x.items, items));

  const addChoice = (by: string, restId: string, rawItems: unknown, rawLabel: unknown, rawNote: unknown) => {
    if (c.blocked(by)) return;
    const s = st();
    if (s.ladder) return c.reject(by, '사다리를 닫은 뒤에 만들어 주세요.');
    const r = restOf(restId);
    if (!r) return c.reject(by, '그 식당을 찾을 수 없어요. 다른 사람이 지웠을 수 있어요.');
    if (s.choices.length >= LIMITS.choices)
      return c.reject(by, `선택지는 ${LIMITS.choices}개까지 만들 수 있어요. 안 쓰는 걸 지워 주세요.`);
    const items = cleanItems(rawItems, r, LIMITS.reserveQty);
    const twin = twinOf(s, r.id, items);
    if (twin) return c.reject(by, `${choiceName(twin)}과 같은 구성이에요.`);
    const at = Date.now();
    const ch: Choice = {
      id: uid(),
      no: s.choiceSeq + 1,
      restId: r.id,
      items,
      label: cleanText(rawLabel, LIMITS.choiceLabel),
      note: cleanText(rawNote, LIMITS.choiceNote),
      by,
      at,
    };
    c.update((s) =>
      c.withSys(
        { ...s, choices: [...s.choices, ch], choiceSeq: ch.no, cands: { ...s.cands, [ch.id]: { by, at } } },
        `${c.nm(by)}님이 선택지 ${choiceObj(ch)} 만들었어요 · ${r.name}${items.length ? ` · ${itemsText(items)}` : ''} · ${moneyText(items)}`,
        by,
      ),
    );
  };

  const editChoice = (by: string, id: string, rawItems: unknown, rawLabel: unknown, rawNote: unknown) => {
    const s = st();
    const ch = choiceOf(s, id);
    if (!ch) return c.reject(by, '그 선택지를 찾을 수 없어요. 다른 사람이 지웠을 수 있어요.');
    if (s.final) return c.reject(by, '확정을 풀면 다시 고칠 수 있어요.');
    if (c.rolling()) return c.reject(by, '무작위로 뽑는 중이에요. 끝나면 다시 해 주세요.');
    const r = restOf(ch.restId);
    const items = cleanItems(rawItems, r, LIMITS.reserveQty);
    const next = {
      items,
      label: cleanText(rawLabel, LIMITS.choiceLabel),
      note: cleanText(rawNote, LIMITS.choiceNote),
    };
    const twin = twinOf(s, ch.restId, items, ch.id);
    if (twin) return c.reject(by, `${choiceName(twin)}과 같은 구성이에요.`);
    if (sameItems(ch.items, items) && ch.label === next.label && ch.note === next.note) return;
    c.update((s) =>
      c.withSys(
        { ...s, choices: s.choices.map((x) => (x.id === id ? { ...x, ...next } : x)) },
        `${c.nm(by)}님이 ${choiceObj(ch)} 고쳤어요 · ${moneyText(items)}`,
        by,
      ),
    );
  };

  const removeChoice = (by: string, id: string) => {
    const s = st();
    const ch = choiceOf(s, id);
    if (!ch) return;
    if (s.final?.choiceId === id) return c.reject(by, '확정된 선택지예요. 확정을 푼 뒤에 지울 수 있어요.');
    if (c.rolling()) return c.reject(by, '무작위로 뽑는 중이에요. 끝나면 다시 해 주세요.');
    if (s.ladder?.cands.includes(id))
      return c.reject(by, '사다리에 올라간 선택지예요. 사다리를 닫은 뒤에 지워 주세요.');
    if (s.pref?.cands.includes(id))
      return c.reject(by, '하트 걸기에 올라간 선택지예요. 하트 걸기를 닫은 뒤에 지워 주세요.');
    const name = label(id, s);
    c.update((s) =>
      c.withSys(
        {
          ...s,
          choices: s.choices.filter((x) => x.id !== id),
          cands: omit(s.cands, [id]),
          prefTally: s.prefTally ? omit(s.prefTally, [id]) : null,
        },
        `${c.nm(by)}님이 ‘${name}’ 선택지를 지웠어요`,
        by,
      ),
    );
    c.dropFocus([id]);
  };

  /** 빼기 / 다시 넣기 */
  const toggleLive = (by: string, id: string) => {
    const ch = choiceOf(st(), id);
    if (!ch || c.blocked(by)) return;
    if (st().ladder) return c.reject(by, '사다리를 닫은 뒤에 바꿔 주세요.');
    const name = label(id);
    c.update((s) => {
      const cands = { ...s.cands };
      if (cands[id]) {
        delete cands[id];
        return c.withSys({ ...s, cands }, `${c.nm(by)}님이 ‘${name}’ 선택지를 뺐어요`, by);
      }
      // 다시 넣어도 만든 순서 자리로 돌아가게 만든 시각을 쓴다.
      cands[id] = { by, at: ch.at };
      return c.withSys({ ...s, cands }, `${c.nm(by)}님이 ‘${name}’ 선택지를 다시 넣었어요`, by);
    });
  };

  /** 무작위 n개 남기기 — 살아 있는 선택지 위를 스포트라이트가 건너뛰다 n개에 멈추고, 나머지는 빠진다. */
  const startRoll = (by: string, count: number) => {
    if (c.blocked(by)) return;
    const s = st();
    if (s.ladder) return c.reject(by, '사다리를 닫은 뒤에 뽑아 주세요.');
    const pool = liveIds(s);
    if (pool.length < 2) return c.reject(by, '선택지가 2개 이상 남아 있어야 뽑을 수 있어요.');
    const n = Math.max(1, Math.min(Math.floor(count) || 1, LIMITS.rollMax, pool.length - 1));
    const picks = shuffle(pool).slice(0, n);
    const roll: Roll = {
      id: uid(),
      by,
      count: n,
      seq: rollSteps(pool, picks),
      picks,
      speed: c.speed(),
      done: false,
    };
    c.update((s) => ({ ...s, roll }));
    c.later(() => {
      if (st().roll?.id !== roll.id) return;
      c.update((s) => {
        const keep = roll.picks.filter((id) => s.choices.some((x) => x.id === id));
        const cands: RoomState['cands'] = {};
        keep.forEach((id) => {
          cands[id] = s.cands[id] ?? { by, at: choiceOf(s, id)!.at };
        });
        const out = Object.keys(s.cands).filter((id) => !cands[id]).length;
        return c.withSys(
          { ...s, cands, roll: { ...roll, done: true } },
          `${c.nm(by)}님이 무작위로 ${keep.length}개만 남겼어요 · ${keep.map((id) => label(id, s)).join(', ')}${out ? ` · ${out}개 빠짐` : ''}`,
          by,
        );
      });
    }, rollTimeline(roll).total);
  };

  const finalChoice = (by: string, id: string) => {
    const s = st();
    const ch = choiceOf(s, id);
    if (!ch) return;
    if (s.final?.choiceId === id) return;
    if (!s.cands[id]) return c.reject(by, '빠진 선택지예요. 다시 넣은 뒤에 확정해 주세요.');
    if (s.reservation) return c.reject(by, '예약을 취소한 뒤에 다른 선택지로 바꿀 수 있어요.');
    if (c.rolling()) return c.reject(by, '무작위로 뽑는 중이에요. 끝나면 다시 해 주세요.');
    const name = label(id, s);
    c.update((s) =>
      c.withSys(
        {
          ...s,
          final: { restId: ch.restId, choiceId: id, by, at: Date.now() },
          ladder: null,
          pref: null,
          reserving: null,
        },
        `${c.nm(by)}님이 ‘${name}’ 최종 확정했어요 · 이제 누군가 예약해요`,
        by,
      ),
    );
  };

  const setBudget = (by: string, raw: unknown) => {
    const n = raw === null || raw === undefined ? NaN : Math.floor(Number(raw));
    const amount = Number.isFinite(n) && n > 0 ? Math.min(n, LIMITS.budgetMax) : null;
    if (amount === st().budget) return;
    c.update((s) =>
      c.withSys(
        { ...s, budget: amount },
        amount
          ? `${c.nm(by)}님이 총사용금액을 ${won(amount)}으로 정했어요`
          : `${c.nm(by)}님이 총사용금액을 지웠어요`,
        by,
      ),
    );
  };

  return {
    saveRest,
    loadRests,
    removeRest,
    addChoice,
    editChoice,
    removeChoice,
    toggleLive,
    startRoll,
    finalChoice,
    setBudget,
  };
}
