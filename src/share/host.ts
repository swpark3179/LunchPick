/**
 * 같이 고르기 — 호스트 쪽 방 엔진.
 *
 * 호스트 PC 의 프론트엔드가 방 상태의 유일한 주인이다. 참여자의 Action 과 호스트 자신의
 * Action 이 모두 `act()` 를 지나가고, 바뀐 상태는 곧바로 호스트 화면에, 잠시 모아서
 * 참여자들에게 방송된다. 무작위 뽑기는 연출 시간표(anim.ts)가 끝나면 확정하고,
 * 사다리는 누구든 출발·결과 적용을 누를 때 진행한다.
 */
import { ERR_NO_CREDS, fabrixChat, type ChatTurn } from '../lib/ipc';
import { mergeRestaurants, sanitizeRestaurants } from '../lib/shareFormat';
import type { Restaurant } from '../lib/types';
import { fmtPhone, pick, shuffle, uid } from '../lib/util';
import { useData } from '../store/dataStore';
import { speedMul, useSettings } from '../store/settingsStore';
import {
  AI_SYSTEM,
  conceptsOf,
  fallbackRank,
  listText,
  localKeywords,
  parseRanked,
  tagsOfConcepts,
  turnPrompt,
} from './ai';
import {
  DELTA_HOLD_MS,
  LADDER_REVEAL_MS,
  LADDER_STAGGER_MS,
  ROLL_FIRST_HOPS,
  ROLL_NEXT_HOPS,
  rollTimeline,
} from './anim';
import { genLadder, ladderWinners } from './ladder';
import {
  type Action,
  type AiTurn,
  type C2H,
  type ChatMsg,
  type EditableRest,
  type FocusMap,
  type H2C,
  LIMITS,
  type LadderRun,
  type Member,
  PROTOCOL,
  type Removed,
  type RoomState,
  type SyncRun,
  cleanName,
  hashHue,
  josa,
  shortName,
} from './protocol';
import { type HostEvent, hostTransport } from './transport';

const BROADCAST_DELAY_MS = 30;
const FOCUS_DELAY_MS = 60;
const HELLO_TIMEOUT_MS = 5000;
const SILENT_KICK_MS = 35000;
const SWEEP_MS = 10000;
const TYPING_MS = 3500;
/** AI 응답이 너무 빨리 와도 '정렬 중…' 이 잠깐은 보이게 한다 (시안: 2초) */
const AI_MIN_SPIN_MS = 2000;
const AI_HISTORY_TURNS = 6;
/** 식당 정보 동기화에 답할 시간 — 지나면 답하지 않은 사람은 거절로 친다 */
const SYNC_WAIT_MS = 60000;
/** 1초에 이보다 많이 보내면 그 연결의 요청은 버린다 */
const RATE_PER_SEC = 25;

type Conn = {
  peer: string;
  memberId: string | null;
  lastSeen: number;
  helloTimer: ReturnType<typeof setTimeout> | undefined;
  bucket: number;
  bucketAt: number;
};

export type HostCallbacks = {
  onState: (s: RoomState) => void;
  onFocus: (f: FocusMap) => void;
  /** 참여자가 처음 들어왔을 때 */
  onGuestJoined: (m: Member) => void;
  /** 호스트 자신의 요청이 거절됐을 때 */
  onError: (msg: string) => void;
};

export type HostRoom = {
  getState: () => RoomState;
  getFocus: () => FocusMap;
  act: (memberId: string, a: Action) => void;
  handle: (e: HostEvent) => void;
  kick: (memberId: string) => void;
  /** 작별 인사를 보내고 정리한다. 전송 계층을 닫는 건 호출한 쪽이 한다. */
  dispose: (reason: string) => void;
};

const aiReadyNow = () => {
  const s = useSettings.getState();
  return s.hasClientKey && s.hasOpenapiToken && !!s.fabrix.endpointUrl.trim();
};

const errText = (e: unknown) =>
  (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)).split('\n')[0];

const FIELD_NAMES = { phone: '전화번호', menus: '메뉴', memo: '메모' } as const;

export function createHostRoom(cb: HostCallbacks): HostRoom {
  const settings = useSettings.getState();
  const hostId = settings.shareId || uid();
  const hostName = cleanName(settings.name) || '호스트';
  const now = Date.now();
  const restaurants = useData.getState().restaurants;

  let state: RoomState = {
    v: PROTOCOL,
    rev: 1,
    hostId,
    aiReady: aiReadyNow(),
    members: [
      {
        id: hostId,
        name: hostName,
        hue: hashHue(hostName),
        host: true,
        online: true,
        typing: false,
        joinedAt: now,
      },
    ],
    restaurants,
    dislikes: {},
    exclOrder: [],
    cands: {},
    order: [],
    reasons: {},
    aiTags: [],
    aiTurns: 0,
    delta: null,
    ai: [],
    roll: null,
    ladder: null,
    final: null,
    edited: {},
    chat: [{ id: uid(), at: now, kind: 'sys', text: `방이 열렸어요 · 식당 ${restaurants.length}곳 기준` }],
    sync: null,
    removed: [],
  };
  let focus: FocusMap = {};

  const conns = new Map<string, Conn>();
  const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /** AI 에 보낸 원문. 방송하지 않는다. */
  const prompts = new Map<string, string>();
  /**
   * 반영된 AI 요청들 (반영된 순서). 요청 하나를 지우면 여기서 빠져 순서·대화 맥락·태그 강조에서
   * 함께 사라진다. 칩이 오래돼 큐에서 밀려나도 기록은 남는다.
   */
  const applied = new Map<
    string,
    {
      /** AI 와 주고받은 한 쌍 (user/assistant) */
      msgs: ChatTurn[];
      /** 요청에서 뽑은 개념 — 키워드 정렬로 대신할 때 누적해서 쓴다 */
      concepts: string[];
      /** 카드의 #태그 강조에 쓰는 태그 */
      tags: string[];
      /** 이 요청이 매긴 순서와 앞쪽 몇 곳의 이유 */
      ids: string[];
      why: Record<string, string>;
    }
  >();
  let aiEpoch = 0;
  let aiBusy = false;
  /** 최종 확정 때 남긴 먹은 기록 — 확정을 취소하면 지운다 */
  let eatenMark: { restId: string; since: number } | null = null;
  let broadcastTimer: ReturnType<typeof setTimeout> | undefined;
  let focusTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  // ------------------------------------------------------------ 상태 · 방송

  const send = (peers: string[], msg: H2C) => hostTransport.send(peers, JSON.stringify(msg));

  const readyPeers = () => [...conns.values()].filter((c) => c.memberId).map((c) => c.peer);

  const flush = () => {
    broadcastTimer = undefined;
    if (disposed) return;
    send(readyPeers(), { t: 'state', state });
  };

  const commit = (next: RoomState) => {
    state = { ...next, rev: state.rev + 1 };
    cb.onState(state);
    if (broadcastTimer === undefined) broadcastTimer = setTimeout(flush, BROADCAST_DELAY_MS);
  };

  const update = (fn: (s: RoomState) => RoomState) => commit(fn(state));

  const withSys = (s: RoomState, text: string, by?: string): RoomState => ({
    ...s,
    chat: [...s.chat, { id: uid(), at: Date.now(), kind: 'sys', text, by } as ChatMsg].slice(
      -LIMITS.chatKeep,
    ),
  });

  const setFocus = (memberId: string, restId: string | null) => {
    if ((focus[memberId] ?? null) === restId) return;
    const next = { ...focus };
    if (restId) next[memberId] = restId;
    else delete next[memberId];
    focus = next;
    cb.onFocus(focus);
    if (focusTimer === undefined)
      focusTimer = setTimeout(() => {
        focusTimer = undefined;
        if (!disposed) send(readyPeers(), { t: 'focus', focus });
      }, FOCUS_DELAY_MS);
  };

  const member = (id: string) => state.members.find((m) => m.id === id);
  /** 채팅에 쓰는 짧은 이름 ('박서원' → '서원') */
  const nm = (id: string) => shortName(member(id)?.name ?? '누군가');
  const restOf = (id: string) => state.restaurants.find((r) => r.id === id);
  const rname = (id: string) => restOf(id)?.name ?? '';
  const rolling = () => !!state.roll && !state.roll.done;

  const patchMember = (s: RoomState, id: string, p: Partial<Member>): RoomState => ({
    ...s,
    members: s.members.map((m) => (m.id === id ? { ...m, ...p } : m)),
  });

  /** 가기 싫은 곳으로 빠지지 않은 식당 (AI 순서가 있으면 그 순서대로) */
  const visible = (s: RoomState) => {
    const live = s.restaurants.filter((r) => !s.dislikes[r.id]?.length);
    if (!s.order.length) return live;
    const idx = new Map(s.order.map((id, i) => [id, i]));
    return [...live].sort((a, b) => (idx.get(a.id) ?? 1e9) - (idx.get(b.id) ?? 1e9));
  };

  // ------------------------------------------------------------ 식당 데이터 · 설정 구독

  const unsubData = useData.subscribe((d, prev) => {
    if (d.restaurants === prev.restaurants) return;
    const ids = new Set(d.restaurants.map((r) => r.id));
    const keep = <T>(o: Record<string, T>) =>
      Object.fromEntries(Object.entries(o).filter(([k]) => ids.has(k)));
    update((s) => ({
      ...s,
      restaurants: d.restaurants,
      dislikes: keep(s.dislikes),
      exclOrder: s.exclOrder.filter((id) => ids.has(id)),
      cands: keep(s.cands),
      reasons: keep(s.reasons),
      edited: keep(s.edited),
      order: s.order.filter((id) => ids.has(id)),
      final: s.final && ids.has(s.final.restId) ? s.final : null,
    }));
  });

  const unsubSettings = useSettings.subscribe((st, prev) => {
    const ready = aiReadyNow();
    const nameChanged = st.name !== prev.name;
    if (ready === state.aiReady && !nameChanged) return;
    update((s) => {
      let n = { ...s, aiReady: ready };
      if (nameChanged) {
        const name = cleanName(st.name) || '호스트';
        n = patchMember(n, hostId, { name, hue: hashHue(name) });
      }
      return n;
    });
  });

  // ------------------------------------------------------------ 거절

  const reject = (memberId: string, msg: string) => {
    if (memberId === hostId) {
      cb.onError(msg);
      return;
    }
    const peers = [...conns.values()].filter((c) => c.memberId === memberId).map((c) => c.peer);
    send(peers, { t: 'err', msg });
  };

  /** 확정됐거나 뽑는 중이면 고르기 조작을 막는다. */
  const blocked = (by: string) => {
    if (state.final) {
      reject(by, '확정을 풀면 다시 고를 수 있어요.');
      return true;
    }
    if (rolling()) {
      reject(by, '무작위로 뽑는 중이에요. 끝나면 다시 해 주세요.');
      return true;
    }
    return false;
  };

  // ------------------------------------------------------------ 가기 싫은 곳 · 후보

  const toggleDislike = (by: string, id: string) => {
    if (!restOf(id) || blocked(by)) return;
    const cur = state.dislikes[id] ?? [];
    const mine = cur.includes(by);
    const list = mine ? cur.filter((x) => x !== by) : [...cur, by];
    const rn = rname(id);
    update((s) => {
      const dislikes = { ...s.dislikes };
      let exclOrder = s.exclOrder;
      if (list.length) {
        dislikes[id] = list;
        if (!exclOrder.includes(id)) exclOrder = [...exclOrder, id];
      } else {
        delete dislikes[id];
        exclOrder = exclOrder.filter((x) => x !== id);
      }
      // 한 명이라도 싫다고 하면 후보에서도 내린다.
      const cands = { ...s.cands };
      if (list.length) delete cands[id];
      const n = { ...s, dislikes, exclOrder, cands };
      if (!mine) return withSys(n, `${nm(by)}님 · ‘${rn}’ 가기 싫어요`, by);
      if (!list.length) return withSys(n, `‘${rn}’ 다시 목록으로`, by);
      return n;
    });
  };

  const toggleCand = (by: string, id: string) => {
    if (!restOf(id) || blocked(by)) return;
    if (state.dislikes[id]?.length) return reject(by, '가기 싫은 곳으로 빠진 식당이에요.');
    const rn = rname(id);
    update((s) => {
      const cands = { ...s.cands };
      if (cands[id]) {
        delete cands[id];
        return withSys({ ...s, cands }, `${nm(by)}님이 ‘${rn}’ 후보를 내렸어요`, by);
      }
      cands[id] = { by, at: Date.now() };
      return withSys({ ...s, cands }, `${nm(by)}님이 ‘${rn}’ 후보로 올렸어요`, by);
    });
  };

  // ------------------------------------------------------------ 무작위 뽑기

  const startRoll = (by: string, count: number) => {
    if (blocked(by)) return;
    if (state.ladder) return reject(by, '사다리를 닫은 뒤에 뽑아 주세요.');
    const pool = visible(state).filter((r) => !state.cands[r.id]);
    if (!pool.length) return reject(by, '후보로 올릴 식당이 남아 있지 않아요.');
    const n = Math.max(1, Math.min(Math.floor(count) || 1, LIMITS.rollMax, pool.length));
    const picks = shuffle(pool)
      .slice(0, n)
      .map((r) => r.id);
    const ids = pool.map((r) => r.id);
    const seq = picks.map((p, k) => {
      const hops = k === 0 ? ROLL_FIRST_HOPS : ROLL_NEXT_HOPS;
      const steps: string[] = [];
      for (let j = 0; j < hops; j++) {
        let id = pick(ids);
        // 같은 카드에 연달아 머무르지 않게 옆으로 비킨다.
        if (id === steps[steps.length - 1] && ids.length > 1) id = ids[(ids.indexOf(id) + 1) % ids.length];
        steps.push(id);
      }
      steps.push(p);
      return steps;
    });
    const roll = {
      id: uid(),
      by,
      count: n,
      seq,
      picks,
      speed: speedMul(useSettings.getState().animSpeed),
      done: false,
    };
    update((s) => ({ ...s, roll }));
    later(() => {
      if (state.roll?.id !== roll.id) return;
      update((s) => {
        const cands = { ...s.cands };
        const at = Date.now();
        // 연출 중에 누가 싫다고 했으면 그 식당은 빼고 올린다.
        roll.picks.forEach((id, i) => {
          if (!s.dislikes[id]?.length && !cands[id] && s.restaurants.some((r) => r.id === id))
            cands[id] = { by, at: at + i };
        });
        const names = roll.picks.map((id) => s.restaurants.find((r) => r.id === id)?.name).filter(Boolean);
        return withSys(
          { ...s, cands, roll: { ...roll, done: true } },
          `${nm(by)}님이 무작위로 ${names.length}곳을 뽑았어요 · ${names.join(', ')}`,
          by,
        );
      });
    }, rollTimeline(roll).total);
  };

  // ------------------------------------------------------------ 사다리 (같이 보고 같이 누른다)

  const candOrder = () =>
    Object.entries(state.cands)
      .sort((a, b) => a[1].at - b[1].at)
      .map(([id]) => id)
      .filter((id) => restOf(id));

  const openLadder = (by: string, keepRaw: number) => {
    if (blocked(by)) return;
    if (state.ladder) return;
    const cands = candOrder();
    const n = cands.length;
    if (n < 2) return reject(by, '후보가 2곳 이상이어야 사다리를 탈 수 있어요.');
    if (n > LIMITS.ladderMax) return reject(by, `사다리는 후보 ${LIMITS.ladderMax}곳 이하에서 탈 수 있어요.`);
    const keep = Math.max(1, Math.min(Math.floor(keepRaw) || 1, n - 1));
    const { rungs, slots } = genLadder(n, keep);
    const run: LadderRun = {
      id: uid(),
      by,
      cands,
      keep,
      rungs,
      slots,
      drawn: Array(n).fill(false),
      revealed: Array(n).fill(false),
      speed: speedMul(useSettings.getState().animSpeed),
    };
    update((s) =>
      withSys({ ...s, ladder: run }, `${nm(by)}님이 사다리를 꺼냈어요 · ${n}곳 중 ${keep}곳`, by),
    );
  };

  const ladderRun = (i: number) => {
    const L = state.ladder;
    if (!L || !Number.isInteger(i) || i < 0 || i >= L.cands.length || L.drawn[i]) return;
    update((s) =>
      s.ladder?.id === L.id
        ? { ...s, ladder: { ...s.ladder, drawn: s.ladder.drawn.map((v, j) => v || j === i) } }
        : s,
    );
    later(() => {
      update((s) =>
        s.ladder?.id === L.id
          ? { ...s, ladder: { ...s.ladder, revealed: s.ladder.revealed.map((v, j) => v || j === i) } }
          : s,
      );
    }, LADDER_REVEAL_MS * L.speed);
  };

  const ladderAll = () => {
    const L = state.ladder;
    if (!L) return;
    L.drawn
      .map((d, i) => (d ? -1 : i))
      .filter((i) => i >= 0)
      .forEach((i, k) =>
        later(
          () => {
            if (state.ladder?.id === L.id) ladderRun(i);
          },
          k * LADDER_STAGGER_MS * L.speed,
        ),
      );
  };

  const ladderApply = (by: string) => {
    const L = state.ladder;
    if (!L) return;
    if (!L.revealed.every(Boolean)) return reject(by, '모든 줄이 도착한 뒤에 적용할 수 있어요.');
    const winners = ladderWinners(L);
    update((s) => {
      const cands: RoomState['cands'] = {};
      winners.forEach((id, k) => {
        cands[id] = s.cands[id] ?? { by, at: Date.now() + k };
      });
      const names = winners.map((id) => s.restaurants.find((r) => r.id === id)?.name).join(', ');
      return withSys({ ...s, cands, ladder: null }, `사다리 결과 · ${names} 남았어요`, by);
    });
  };

  // ------------------------------------------------------------ AI 정렬 (대기열)

  /** ids 를 앞에 세운 순서 — 나머지는 base(비어 있으면 식당 목록 순서)를 따른다. */
  const stack = (s: RoomState, base: string[], ids: string[]) => {
    const seen = new Set(ids);
    return [...ids, ...(base.length ? base : s.restaurants.map((r) => r.id)).filter((id) => !seen.has(id))];
  };

  /** 순서를 바꾸고, 바뀌기 전후의 '남은 식당' 자리를 비교해 ▲▼ 와 이동 수를 만든다. */
  const reorder = (s: RoomState, order: string[]) => {
    const before = new Map(visible(s).map((r, i) => [r.id, i]));
    const next = { ...s, order };
    const map: Record<string, number> = {};
    visible(next).forEach((r, i) => {
      const d = (before.get(r.id) ?? i) - i;
      if (d) map[r.id] = d;
    });
    return { next, map, moved: Object.keys(map).length };
  };

  /** ▲▼ 표시 — 잠시 보였다가 지운다. */
  const flashDelta = (map: Record<string, number>) => {
    const id = uid();
    later(() => {
      if (state.delta?.id === id) update((s) => ({ ...s, delta: null }));
    }, DELTA_HOLD_MS);
    return { id, map };
  };

  const kwText = (keywords: string[]) => keywords.map((k) => `#${k}`).join(' ');

  const queueAi = (by: string, raw: string, ref: unknown) => {
    const prompt = String(raw ?? '')
      .trim()
      .slice(0, LIMITS.prompt);
    if (!prompt) return;
    if (state.final) return reject(by, '확정을 풀면 다시 정렬할 수 있어요.');
    const pending = state.ai.filter((t) => t.status === 'queued' || t.status === 'running').length;
    if (pending >= LIMITS.aiPending) return reject(by, 'AI 요청이 밀려 있어요. 잠시 후 다시 보내 주세요.');
    // 시안처럼 대기 중에도 키워드는 바로 보인다 — 사전으로 뽑은 일반 낱말이라 원문이 드러나지 않는다.
    // AI 가 더 나은 키워드를 주면 끝났을 때 바꾼다.
    const turn: AiTurn = {
      id: uid(),
      by,
      keywords: conceptsOf(prompt).slice(0, 3),
      status: 'queued',
      at: Date.now(),
      ref: typeof ref === 'string' ? ref.slice(0, 24) : undefined,
    };
    prompts.set(turn.id, prompt);
    update((s) => {
      // 오래된 완료 기록부터 덜어낸다 (대기·진행 중인 건 남긴다).
      let ai = [...s.ai, turn];
      while (ai.length > LIMITS.aiKeep) {
        const i = ai.findIndex((t) => t.status === 'done' || t.status === 'failed');
        if (i < 0) break;
        ai = ai.filter((_, j) => j !== i);
      }
      return { ...s, ai };
    });
    void pumpAi();
  };

  const pumpAi = async () => {
    if (aiBusy || disposed) return;
    const turn = state.ai.find((t) => t.status === 'queued');
    if (!turn) return;
    aiBusy = true;
    const myEpoch = aiEpoch;
    const t0 = Date.now();
    update((s) => ({ ...s, ai: s.ai.map((t) => (t.id === turn.id ? { ...t, status: 'running' } : t)) }));

    const prompt = prompts.get(turn.id) ?? '';
    const list = visible(state);
    const { history } = useData.getState();
    const past = [...applied.values()];
    const askedConcepts = conceptsOf(prompt);
    let ids: string[] = [];
    let why: Record<string, string> = {};
    let keywords: string[] = [];
    let note = '';
    let failed = false;
    // 대화·개념 누적은 결과를 실제로 반영할 때만 한다 (그사이 초기화했거나 지웠을 수 있다).
    let learned: ChatTurn[] = [];

    if (!list.length) {
      failed = true;
      note = '남은 식당이 없어 정렬하지 못했어요.';
    } else {
      const turnNo = past.length + 1;
      const userMsg = turnPrompt(listText(list, history), prompt, turnNo);
      try {
        if (!state.aiReady) throw new Error(ERR_NO_CREDS);
        const text = await fabrixChat(useSettings.getState().fabrix, [
          { role: 'system', content: AI_SYSTEM },
          ...past.slice(-AI_HISTORY_TURNS).flatMap((h) => h.msgs),
          { role: 'user', content: userMsg },
        ]);
        const parsed = parseRanked(text, list.length);
        if (!parsed) throw new Error('AI 응답 형식이 올바르지 않아요');
        ids = parsed.order.map((no) => list[no - 1].id);
        why = Object.fromEntries(Object.entries(parsed.why).map(([no, w]) => [list[Number(no) - 1].id, w]));
        keywords = parsed.keywords.length ? parsed.keywords : localKeywords(prompt);
        learned = [
          { role: 'user', content: userMsg },
          { role: 'assistant', content: JSON.stringify({ keywords, order: parsed.order }) },
        ];
      } catch (e) {
        // AI 가 없거나 실패해도 흐름은 이어간다 — 누적 키워드로 정렬한다.
        const fb = fallbackRank(list, history, [...past.map((h) => h.concepts), askedConcepts]);
        ids = fb.ids;
        why = fb.why;
        keywords = askedConcepts.length ? askedConcepts.slice(0, 3) : localKeywords(prompt);
        const msg = errText(e);
        note = msg.includes(ERR_NO_CREDS)
          ? '호스트 PC에 AI 키가 없어 키워드로 정렬했어요.'
          : `AI 응답을 받지 못해 키워드로 정렬했어요. (${msg})`;
        // 다음 AI 요청도 이 요청을 알 수 있게 대화에 남긴다.
        learned = [
          { role: 'user', content: userMsg },
          {
            role: 'assistant',
            content: JSON.stringify({
              keywords,
              order: ids.map((id) => list.findIndex((r) => r.id === id) + 1),
            }),
          },
        ];
      }
    }

    const wait = Math.max(0, AI_MIN_SPIN_MS - (Date.now() - t0));
    if (wait) await new Promise((r) => later(() => r(null), wait));
    aiBusy = false;
    prompts.delete(turn.id);
    if (disposed) return;
    // 그사이 정렬을 초기화했거나 이 요청을 지웠다면 결과는 버린다.
    if (myEpoch !== aiEpoch || !state.ai.some((t) => t.id === turn.id)) {
      void pumpAi();
      return;
    }

    if (failed) {
      update((s) => ({
        ...s,
        ai: s.ai.map((t) => (t.id === turn.id ? { ...t, status: 'failed' as const, keywords, note } : t)),
      }));
      void pumpAi();
      return;
    }

    const tags = tagsOfConcepts([...askedConcepts, ...conceptsOf(keywords.join(' '))]);
    applied.set(turn.id, { msgs: learned, concepts: askedConcepts, tags, ids, why });
    update((s) => {
      const { next, map, moved } = reorder(s, stack(s, s.order, ids));
      const no = s.aiTurns + 1;
      const top = ids.slice(0, LIMITS.aiTop).map((id) => ({
        id,
        name: s.restaurants.find((r) => r.id === id)?.name ?? '',
        why: why[id],
      }));
      return withSys(
        {
          ...next,
          reasons: why,
          aiTags: [...new Set([...s.aiTags, ...tags])],
          aiTurns: no,
          delta: flashDelta(map),
          ai: s.ai.map((t) =>
            t.id === turn.id
              ? { ...t, status: 'done' as const, keywords, moved, no, top, note: note || undefined }
              : t,
          ),
        },
        `AI 정렬 ${no}차 · ${nm(turn.by)}님 ${kwText(keywords) || '#요청'} → ${moved}곳 순서 변경`,
        turn.by,
      );
    });
    void pumpAi();
  };

  /**
   * AI 요청 하나를 지운다. 대기·정렬 중이면 취소하고, 반영된 요청이면 남은 요청들로 순서를
   * 다시 쌓는다 — 마지막 요청을 지우면 그 직전 순서로 돌아가고, 다음 정렬의 맥락에서도 빠진다.
   */
  const removeAi = (by: string, id: string) => {
    const t = state.ai.find((x) => x.id === id);
    if (!t) return;
    const kw = t.keywords.length ? ` ${kwText(t.keywords)}` : '';
    if (t.status === 'queued' || t.status === 'running') {
      // 정렬 중이던 요청은 응답이 와도 pumpAi 가 버린다.
      prompts.delete(t.id);
      update((s) =>
        withSys(
          { ...s, ai: s.ai.filter((x) => x.id !== t.id) },
          `${nm(by)}님이 ${josa(`AI 요청${kw}`, '을', '를')} 취소했어요`,
          by,
        ),
      );
      return;
    }
    const had = applied.delete(t.id);
    if (!had) {
      update((s) => ({ ...s, ai: s.ai.filter((x) => x.id !== t.id) }));
      return;
    }
    update((s) => {
      const left = [...applied.values()];
      const live = new Set(s.restaurants.map((r) => r.id));
      const order = left.reduce<string[]>((o, h) => stack(s, o, h.ids), []).filter((x) => live.has(x));
      const ai = s.ai.filter((x) => x.id !== t.id);
      const { next, map, moved } = reorder(s, order);
      return withSys(
        {
          ...next,
          reasons: left.length ? left[left.length - 1].why : {},
          aiTags: [...new Set(left.flatMap((h) => h.tags))],
          // 남은 게 하나도 없으면 차수도 처음부터 센다.
          aiTurns: left.length || ai.length ? s.aiTurns : 0,
          delta: moved ? flashDelta(map) : s.delta,
          ai,
        },
        `${nm(by)}님이 ${josa(`AI 정렬 ${t.no ?? ''}차${kw}`, '을', '를')} 지웠어요 → ${moved}곳 순서 변경`,
        by,
      );
    });
  };

  const resetAi = (by: string) => {
    if (state.ai.some((t) => t.status === 'queued' || t.status === 'running'))
      return reject(by, '처리 중인 요청이 끝나면 초기화할 수 있어요.');
    aiEpoch += 1;
    applied.clear();
    prompts.clear();
    update((s) =>
      withSys(
        { ...s, order: [], reasons: {}, aiTags: [], aiTurns: 0, delta: null, ai: [] },
        `${nm(by)}님이 AI 정렬을 초기화했어요`,
        by,
      ),
    );
  };

  // ------------------------------------------------------------ 최종 확정

  const undoEaten = () => {
    const mark = eatenMark;
    eatenMark = null;
    if (!mark) return;
    useData.getState().apply((d) => ({
      ...d,
      history: d.history.filter((h) => !(h.restId === mark.restId && h.at >= mark.since)),
    }));
  };

  const finalize = (by: string, restId: string) => {
    const r = restOf(restId);
    if (!r) return;
    if (state.dislikes[restId]?.length) return reject(by, '가기 싫은 곳으로 빠진 식당이에요.');
    if (state.final?.restId === restId) return;
    undoEaten();
    const since = Date.now();
    useData.getState().recordEaten(restId);
    eatenMark = { restId, since };
    update((s) =>
      withSys(
        { ...s, final: { restId, by, at: since }, ladder: null },
        `${nm(by)}님이 ‘${r.name}’ 최종 확정했어요`,
        by,
      ),
    );
  };

  // ------------------------------------------------------------ 식당 정보 고치기

  const sanitizeMenus = (cur: Restaurant, raw: EditableRest['menus']) =>
    (Array.isArray(raw) ? raw : [])
      .slice(0, LIMITS.menus)
      .map((m) => {
        const name = String(m?.name ?? '')
          .trim()
          .slice(0, LIMITS.menuName);
        const p = Number(m?.price);
        const price = Number.isFinite(p) && p > 0 ? Math.min(Math.round(p), 9_999_999) : null;
        const old = cur.menus.find((x) => x.id === m?.id);
        return { id: old ? old.id : uid(), name, price, fav: old ? old.fav : !!m?.fav };
      })
      .filter((m) => m.name);

  const editRest = (by: string, e: EditableRest) => {
    const cur = restOf(String(e?.id ?? ''));
    if (!cur) return reject(by, '그 식당을 찾을 수 없어요.');
    const phone = fmtPhone(String(e.phone ?? ''));
    const memo = String(e.memo ?? '')
      .trim()
      .slice(0, LIMITS.memo);
    const menus = sanitizeMenus(cur, e.menus);
    const same = (a: Restaurant['menus'], b: Restaurant['menus']) =>
      JSON.stringify(a.map((m) => [m.name, m.price])) === JSON.stringify(b.map((m) => [m.name, m.price]));
    const changed: string[] = [];
    if (phone !== cur.phone) changed.push(FIELD_NAMES.phone);
    if (!same(menus, cur.menus)) changed.push(FIELD_NAMES.menus);
    if (memo !== cur.memo) changed.push(FIELD_NAMES.memo);
    if (!changed.length) return;
    // 데이터 구독이 방 상태의 식당 목록을 고쳐 방송한다.
    useData.getState().updateRest(cur.id, (r) => ({ ...r, phone, memo, menus }));
    update((s) =>
      withSys(
        { ...s, edited: { ...s.edited, [cur.id]: Date.now() } },
        `${nm(by)}님이 ‘${cur.name}’ ${changed.join('·')}를 고쳤어요`,
        by,
      ),
    );
  };

  // ------------------------------------------------------------ 식당 지우기

  const removeRest = (by: string, id: string) => {
    const r = restOf(id);
    if (!r) return;
    if (state.final?.restId === id) return reject(by, '확정된 식당이에요. 확정을 푼 뒤에 지울 수 있어요.');
    if (rolling()) return reject(by, '무작위로 뽑는 중이에요. 끝나면 다시 해 주세요.');
    if (state.ladder?.cands.includes(id))
      return reject(by, '사다리에 올라간 식당이에요. 사다리를 닫은 뒤에 지워 주세요.');
    // 데이터 구독이 방 상태(가기 싫은 곳·후보·순서 …)를 정리해 방송한다.
    useData.getState().apply((d) => ({ ...d, restaurants: d.restaurants.filter((x) => x.id !== id) }));
    // 참여자들은 이 기록을 보고 각자 목록에서도 지운다 (shareStore).
    const entry: Removed = { id, name: r.name, by, at: Date.now() };
    update((s) =>
      withSys(
        { ...s, removed: [...s.removed, entry].slice(-LIMITS.removedKeep) },
        `${nm(by)}님이 ‘${r.name}’ 식당을 지웠어요 · 모두의 목록에서 빠져요`,
        by,
      ),
    );
  };

  // ------------------------------------------------------------ 식당 정보 동기화

  /** 수락한 참여자들이 보낸 목록 — 호스트가 수락하면 호스트 목록(=방 목록)에 합친다 */
  const syncOffers = new Map<string, Restaurant[]>();
  let syncAdded = 0;

  const syncOpen = () => !!state.sync && !state.sync.end;
  const hostAccepted = () => state.sync?.answers[hostId] === true;
  const cleanList = (raw: unknown) => sanitizeRestaurants(raw, LIMITS.syncRests, LIMITS.menus);

  /** 쌓인 목록을 호스트 목록에 합친다. 방 목록은 데이터 구독이 고쳐 방송한다. */
  const mergeOffers = () => {
    if (!syncOffers.size) return;
    const lists = [...syncOffers.values()];
    syncOffers.clear();
    const before = useData.getState().restaurants.length;
    useData.getState().apply((d) => ({
      ...d,
      restaurants: lists.reduce((acc, l) => mergeRestaurants(acc, l, { fillBlanks: true }), d.restaurants),
    }));
    syncAdded += useData.getState().restaurants.length - before;
  };

  /** 끝낸다. 성공이면 수락한 참여자들이 end 를 보고 합쳐진 방 목록을 각자 받는다. */
  const endSync = (ok: boolean, reason?: string) => {
    const run = state.sync;
    if (!run || run.end) return;
    if (ok) mergeOffers();
    syncOffers.clear();
    const n = Object.values(run.answers).filter(Boolean).length;
    update((s) =>
      s.sync?.id === run.id
        ? withSys(
            { ...s, sync: { ...s.sync, end: { ok, added: ok ? syncAdded : 0, reason, at: Date.now() } } },
            ok
              ? `식당 동기화를 마쳤어요 · ${n}명 · 식당 ${syncAdded}곳 추가`
              : `식당 동기화를 취소했어요 · ${reason ?? ''}`,
          )
        : s,
    );
  };

  /** 접속 중인 사람이 모두 답했으면 마무리한다. */
  const checkSync = () => {
    const run = state.sync;
    if (!run || run.end) return;
    if (state.members.some((m) => m.online && run.answers[m.id] === undefined)) return;
    if (hostAccepted()) endSync(true);
    else endSync(false, '호스트가 수락하지 않았어요');
  };

  const startSync = (by: string, raw: unknown) => {
    if (syncOpen()) return reject(by, '이미 식당 정보를 동기화하는 중이에요.');
    if (!state.members.some((m) => m.online && m.id !== by))
      return reject(by, '같이 동기화할 사람이 아직 없어요.');
    syncOffers.clear();
    syncAdded = 0;
    if (by !== hostId) syncOffers.set(by, cleanList(raw));
    const at = Date.now();
    const run: SyncRun = { id: uid(), by, at, until: at + SYNC_WAIT_MS, answers: { [by]: true }, end: null };
    update((s) =>
      withSys(
        { ...s, sync: run },
        `${nm(by)}님이 식당 정보 동기화를 요청했어요 · 수락한 사람끼리 목록을 합쳐요`,
        by,
      ),
    );
    later(() => {
      if (state.sync?.id !== run.id || state.sync.end) return;
      // 마감 — 답하지 않은 사람은 거절로 친다.
      if (hostAccepted()) endSync(true);
      else endSync(false, '호스트가 응답하지 않았어요');
    }, SYNC_WAIT_MS);
  };

  const answerSync = (by: string, id: string, accept: boolean, raw: unknown) => {
    const run = state.sync;
    if (!run || run.end || run.id !== id || run.answers[by] !== undefined) return;
    if (accept && by !== hostId) syncOffers.set(by, cleanList(raw));
    update((s) =>
      s.sync?.id === run.id ? { ...s, sync: { ...s.sync, answers: { ...s.sync.answers, [by]: accept } } } : s,
    );
    // 방 목록은 호스트 목록이라, 호스트가 거절하면 아무것도 합칠 수 없다.
    if (by === hostId && !accept) return endSync(false, '호스트가 거절했어요');
    // 호스트가 수락한 뒤로는 들어오는 대로 바로 합친다 — 방 목록이 실시간으로 늘어난다.
    if (hostAccepted()) mergeOffers();
    checkSync();
  };

  // ------------------------------------------------------------ Action

  const act = (by: string, a: Action) => {
    if (disposed || !a || typeof a !== 'object' || !member(by)) return;
    switch (a.type) {
      case 'chat': {
        const text = String(a.text ?? '')
          .trim()
          .slice(0, LIMITS.chat);
        if (!text) return;
        clearTimeout(typingTimers.get(by));
        update((s) => ({
          ...patchMember(s, by, { typing: false }),
          chat: [...s.chat, { id: uid(), at: Date.now(), kind: 'chat' as const, from: by, text }].slice(
            -LIMITS.chatKeep,
          ),
        }));
        return;
      }
      case 'typing': {
        clearTimeout(typingTimers.get(by));
        typingTimers.set(
          by,
          later(() => update((s) => patchMember(s, by, { typing: false })), TYPING_MS),
        );
        if (!member(by)?.typing) update((s) => patchMember(s, by, { typing: true }));
        return;
      }
      case 'focus': {
        const id = a.restId === null ? null : String(a.restId);
        setFocus(by, id && restOf(id) ? id : null);
        return;
      }
      case 'dislike':
        toggleDislike(by, String(a.restId));
        return;
      case 'cand':
        toggleCand(by, String(a.restId));
        return;
      case 'roll':
        startRoll(by, Number(a.count));
        return;
      case 'ai':
        queueAi(by, a.prompt, a.ref);
        return;
      case 'aiReset':
        resetAi(by);
        return;
      case 'aiRemove':
        removeAi(by, String(a.id));
        return;
      case 'ladder':
        openLadder(by, Number(a.keep));
        return;
      case 'ladderRun':
        ladderRun(Number(a.i));
        return;
      case 'ladderAll':
        ladderAll();
        return;
      case 'ladderApply':
        ladderApply(by);
        return;
      case 'ladderClose':
        if (state.ladder) update((s) => ({ ...s, ladder: null }));
        return;
      case 'final':
        finalize(by, String(a.restId));
        return;
      case 'unfinal':
        if (!state.final) return;
        undoEaten();
        update((s) => withSys({ ...s, final: null }, `${nm(by)}님이 확정을 풀었어요 · 다시 골라요`, by));
        return;
      case 'editRest':
        editRest(by, a.rest);
        return;
      case 'removeRest':
        removeRest(by, String(a.restId));
        return;
      case 'syncStart':
        startSync(by, a.restaurants);
        return;
      case 'syncAnswer':
        answerSync(by, String(a.id), a.accept === true, a.restaurants);
        return;
      case 'profile': {
        const name = cleanName(a.name);
        if (!name) return;
        update((s) => patchMember(s, by, { name, hue: hashHue(name) }));
        return;
      }
    }
  };

  // ------------------------------------------------------------ 연결

  const dropConn = (peer: string) => {
    const c = conns.get(peer);
    if (!c) return;
    clearTimeout(c.helloTimer);
    conns.delete(peer);
    const id = c.memberId;
    if (!id) return;
    // 같은 사람의 다른 연결이 살아 있으면 그대로 둔다.
    if ([...conns.values()].some((x) => x.memberId === id)) return;
    clearTimeout(typingTimers.get(id));
    setFocus(id, null);
    update((s) => withSys(patchMember(s, id, { online: false, typing: false }), `${nm(id)}님이 나갔어요`));
    // 나간 사람만 답을 안 했다면 동기화를 마무리한다.
    checkSync();
  };

  const hello = (c: Conn, m: Extract<C2H, { t: 'hello' }>) => {
    if (c.memberId) return;
    if (m.v !== PROTOCOL || m.app !== 'lunchpick') {
      send([c.peer], {
        t: 'bye',
        reason: '점심픽 버전이 달라 같이 고르기에 들어갈 수 없어요. 같은 버전으로 맞춰 주세요.',
      });
      later(() => hostTransport.kick(c.peer), 200);
      return;
    }
    clearTimeout(c.helloTimer);
    let id = /^[a-z0-9-]{4,40}$/i.test(String(m.id)) ? String(m.id) : uid();
    const online = (mid: string) => [...conns.values()].some((x) => x.memberId === mid);
    if (id === hostId) id = `${id}-${uid().slice(0, 4)}`;
    else if (online(id)) {
      if (m.resume) {
        // 다시 붙는 중 — 끊긴 걸 아직 모르는 이전 연결을 정리한다.
        for (const x of conns.values()) {
          if (x.memberId === id && x.peer !== c.peer) {
            send([x.peer], { t: 'bye', reason: '다른 곳에서 같은 사람으로 다시 접속했어요.' });
            x.memberId = null;
            later(() => hostTransport.kick(x.peer), 200);
          }
        }
      } else {
        id = `${id}-${uid().slice(0, 4)}`;
      }
    }
    c.memberId = id;
    const name = cleanName(m.name) || '손님';
    const hue = hashHue(name);
    const existing = member(id);
    const first = !existing;
    update((s) => {
      const next: RoomState = existing
        ? patchMember(s, id, { online: true, name, hue })
        : {
            ...s,
            members: [
              ...s.members,
              { id, name, hue, host: false, online: true, typing: false, joinedAt: Date.now() },
            ],
          };
      return existing?.online
        ? next
        : withSys(next, `${shortName(name)}님이 ${first ? '들어왔어요' : '다시 들어왔어요'}`);
    });
    send([c.peer], { t: 'welcome', you: id, state, focus });
    if (first) cb.onGuestJoined(member(id)!);
  };

  const handle = (e: HostEvent) => {
    if (disposed) return;
    if (e.kind === 'open') {
      const c: Conn = {
        peer: e.peer,
        memberId: null,
        lastSeen: Date.now(),
        helloTimer: undefined,
        bucket: RATE_PER_SEC,
        bucketAt: Date.now(),
      };
      c.helloTimer = later(() => {
        if (!c.memberId) hostTransport.kick(c.peer);
      }, HELLO_TIMEOUT_MS);
      conns.set(e.peer, c);
      return;
    }
    if (e.kind === 'close') {
      dropConn(e.peer);
      return;
    }
    const c = conns.get(e.peer);
    if (!c) return;
    const t = Date.now();
    c.lastSeen = t;
    // 아주 단순한 토큰 버킷 — 실수로 반복 전송하는 클라이언트가 방을 흔들지 못하게.
    c.bucket = Math.min(RATE_PER_SEC, c.bucket + ((t - c.bucketAt) / 1000) * RATE_PER_SEC);
    c.bucketAt = t;
    if (c.bucket < 1) return;
    c.bucket -= 1;

    let m: C2H;
    try {
      m = JSON.parse(e.data) as C2H;
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ping') send([c.peer], { t: 'pong' });
    else if (m.t === 'hello') hello(c, m);
    else if (m.t === 'act' && c.memberId) act(c.memberId, m.a);
  };

  const sweep = setInterval(() => {
    const t = Date.now();
    for (const c of conns.values()) if (t - c.lastSeen > SILENT_KICK_MS) hostTransport.kick(c.peer);
  }, SWEEP_MS);

  const kick = (memberId: string) => {
    if (memberId === hostId) return;
    const peers = [...conns.values()].filter((c) => c.memberId === memberId).map((c) => c.peer);
    send(peers, { t: 'bye', reason: '호스트가 같이 고르기에서 내보냈어요.' });
    const name = nm(memberId);
    for (const p of peers) {
      const c = conns.get(p);
      if (c) c.memberId = null;
      later(() => hostTransport.kick(p), 200);
    }
    setFocus(memberId, null);
    update((s) => {
      const dislikes: RoomState['dislikes'] = {};
      for (const [k, v] of Object.entries(s.dislikes)) {
        const left = v.filter((x) => x !== memberId);
        if (left.length) dislikes[k] = left;
      }
      return withSys(
        {
          ...s,
          members: s.members.filter((m) => m.id !== memberId),
          dislikes,
          exclOrder: s.exclOrder.filter((id) => dislikes[id]),
        },
        `${name}님을 내보냈어요`,
      );
    });
    checkSync();
  };

  const dispose = (reason: string) => {
    if (disposed) return;
    send(readyPeers(), { t: 'bye', reason });
    disposed = true;
    clearTimeout(broadcastTimer);
    clearTimeout(focusTimer);
    clearInterval(sweep);
    timers.forEach(clearTimeout);
    typingTimers.forEach(clearTimeout);
    conns.forEach((c) => clearTimeout(c.helloTimer));
    unsubData();
    unsubSettings();
  };

  cb.onState(state);

  return { getState: () => state, getFocus: () => focus, act, handle, kick, dispose };
}
