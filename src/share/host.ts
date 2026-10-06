/**
 * 같이 고르기 — 호스트 쪽 방 엔진.
 *
 * 호스트 PC 의 프론트엔드가 방 상태의 유일한 주인이다. 참여자의 Action 과 호스트 자신의
 * Action 이 모두 `act()` 를 지나가고, 바뀐 상태는 곧바로 호스트 화면에, 잠시 모아서
 * 참여자들에게 방송된다. 무작위 뽑기·사다리는 연출 시간표(anim.ts)가 끝나면 확정한다.
 */
import { ERR_NO_CREDS, fabrixChat, type ChatTurn } from '../lib/ipc';
import type { Restaurant } from '../lib/types';
import { fmtPhone, pick, shuffle, uid } from '../lib/util';
import { ladderGen, ladderGeo, trace } from '../pick/engine';
import { useData } from '../store/dataStore';
import { speedMul, useSettings } from '../store/settingsStore';
import { CATS } from '../theme';
import { AI_SYSTEM, conceptsOf, fallbackRank, listText, localKeywords, parseRanked, turnPrompt } from './ai';
import { ladderTimeline, rollTimeline, ROLL_FIRST_STEPS, ROLL_NEXT_STEPS } from './anim';
import {
  type Action,
  type AiTurn,
  type C2H,
  type ChatMsg,
  type EditableRest,
  type H2C,
  LIMITS,
  type Member,
  PROTOCOL,
  type RoomState,
  type SysTone,
  cleanName,
} from './protocol';
import { type HostEvent, hostTransport } from './transport';

const BROADCAST_DELAY_MS = 30;
const HELLO_TIMEOUT_MS = 5000;
const SILENT_KICK_MS = 35000;
const SWEEP_MS = 10000;
const TYPING_MS = 3500;
const AI_MIN_SPIN_MS = 1200;
const AI_HISTORY_TURNS = 6;
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
  /** 참여자가 처음 들어왔을 때 (호스트 화면에 패널을 띄우는 데 쓴다) */
  onGuestJoined: (m: Member) => void;
  /** 호스트 자신의 요청이 거절됐을 때 */
  onError: (msg: string) => void;
};

export type HostRoom = {
  getState: () => RoomState;
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

export function createHostRoom(cb: HostCallbacks): HostRoom {
  const settings = useSettings.getState();
  const hostId = settings.shareId || uid();
  const now = Date.now();

  let state: RoomState = {
    v: PROTOCOL,
    rev: 1,
    hostId,
    aiReady: aiReadyNow(),
    members: [
      {
        id: hostId,
        name: cleanName(settings.name) || '호스트',
        hue: settings.hue,
        host: true,
        online: true,
        typing: false,
        joinedAt: now,
      },
    ],
    restaurants: useData.getState().restaurants,
    dislikes: {},
    cands: {},
    order: [],
    reasons: {},
    ai: [],
    roll: null,
    ladder: null,
    final: null,
    chat: [],
  };

  const conns = new Map<string, Conn>();
  const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /** AI 에 보낸 원문. 방송하지 않는다. */
  const prompts = new Map<string, string>();
  /** AI 와의 누적 대화 (user/assistant 쌍) */
  let convo: ChatTurn[] = [];
  /** 키워드 정렬로 대신 처리할 때 쓰는 누적 개념 */
  let concepts: string[] = [];
  let aiEpoch = 0;
  let aiBusy = false;
  /** 최종 확정 때 남긴 먹은 기록 — 확정을 취소하면 지운다 */
  let eatenMark: { restId: string; since: number } | null = null;
  let broadcastTimer: ReturnType<typeof setTimeout> | undefined;
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

  const withSys = (s: RoomState, text: string, tone: SysTone, by?: string): RoomState => ({
    ...s,
    chat: [...s.chat, { id: uid(), at: Date.now(), kind: 'sys', text, tone, by } as ChatMsg].slice(
      -LIMITS.chatKeep,
    ),
  });

  const member = (id: string) => state.members.find((m) => m.id === id);
  const nameOf = (id: string) => member(id)?.name ?? '누군가';
  const restOf = (id: string) => state.restaurants.find((r) => r.id === id);
  const busy = () => (state.roll && !state.roll.done) || (state.ladder && !state.ladder.done);

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
      cands: keep(s.cands),
      reasons: keep(s.reasons),
      order: s.order.filter((id) => ids.has(id)),
      final: s.final && ids.has(s.final.restId) ? s.final : null,
    }));
  });

  const unsubSettings = useSettings.subscribe((st, prev) => {
    const ready = aiReadyNow();
    const nameChanged = st.name !== prev.name || st.hue !== prev.hue;
    if (ready === state.aiReady && !nameChanged) return;
    update((s) => {
      let n = { ...s, aiReady: ready };
      if (nameChanged) n = patchMember(n, hostId, { name: cleanName(st.name) || '호스트', hue: st.hue });
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

  // ------------------------------------------------------------ 무작위 뽑기

  const startRoll = (by: string, count: number) => {
    if (busy()) return reject(by, '지금 뽑는 중이에요. 끝나면 다시 해 주세요.');
    const pool = visible(state).filter((r) => !state.cands[r.id]);
    if (!pool.length) return reject(by, '더 뽑을 식당이 없어요.');
    const n = Math.max(1, Math.min(Math.floor(count) || 1, LIMITS.rollMax, pool.length));
    const picks = shuffle(pool)
      .slice(0, n)
      .map((r) => r.id);
    const ids = pool.map((r) => r.id);
    const seq = picks.map((p, k) => {
      const steps: string[] = [];
      const len = k === 0 ? ROLL_FIRST_STEPS : ROLL_NEXT_STEPS;
      for (let i = 0; i < len - 1; i++) {
        let id = pick(ids);
        if (ids.length > 1) while (id === steps[steps.length - 1]) id = pick(ids);
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
    later(
      () => {
        if (state.roll?.id !== roll.id) return;
        update((s) => {
          const cands = { ...s.cands };
          const at = Date.now();
          // 연출 중에 누가 싫다고 했으면 그 식당은 빼고 올린다.
          roll.picks.forEach((id) => {
            if (!s.dislikes[id]?.length && s.restaurants.some((r) => r.id === id)) cands[id] = { by, at };
          });
          const names = roll.picks.map((id) => s.restaurants.find((r) => r.id === id)?.name).filter(Boolean);
          return withSys(
            { ...s, cands, roll: { ...roll, done: true } },
            `무작위 ${names.length}곳 — ${names.join(', ')}`,
            'pick',
            by,
          );
        });
      },
      rollTimeline(roll).total + 120,
    );
  };

  // ------------------------------------------------------------ 사다리

  const startLadder = (by: string, keepRaw: number) => {
    if (busy()) return reject(by, '지금 진행 중인 연출이 끝나면 다시 해 주세요.');
    const candIds = Object.entries(state.cands)
      .sort((a, b) => a[1].at - b[1].at)
      .map(([id]) => id)
      .filter((id) => restOf(id));
    const n = candIds.length;
    if (n < 2) return reject(by, '후보가 2곳 이상 있어야 사다리를 탈 수 있어요.');
    if (n > LIMITS.ladderMax) return reject(by, `사다리는 ${LIMITS.ladderMax}곳 이하에서 탈 수 있어요.`);
    const keep = Math.max(1, Math.min(Math.floor(keepRaw) || 1, n - 1));
    const cands = shuffle(candIds);
    const g = ladderGen(n, keep);
    const geo = ladderGeo(n);
    const winners = cands.filter((_, i) => g.slots[trace(g, i, geo).end]);
    const run = {
      id: uid(),
      by,
      cands,
      keep,
      rungs: g.rungs,
      slots: g.slots,
      winners,
      speed: speedMul(useSettings.getState().animSpeed),
      done: false,
    };
    update((s) => ({ ...s, ladder: run }));
    later(() => {
      if (state.ladder?.id !== run.id) return;
      update((s) => {
        const next: RoomState['cands'] = {};
        run.winners.forEach((id) => {
          if (s.cands[id]) next[id] = s.cands[id];
        });
        const names = run.winners.map((id) => s.restaurants.find((r) => r.id === id)?.name);
        return withSys(
          { ...s, cands: next, ladder: { ...run, done: true } },
          `사다리 통과 — ${names.join(', ')}`,
          'ladder',
          by,
        );
      });
    }, ladderTimeline(run).total);
  };

  // ------------------------------------------------------------ AI 정렬 (대기열)

  const queueAi = (by: string, raw: string) => {
    const prompt = String(raw ?? '')
      .trim()
      .slice(0, LIMITS.prompt);
    if (!prompt) return;
    const pending = state.ai.filter((t) => t.status === 'queued' || t.status === 'running').length;
    if (pending >= LIMITS.aiPending) return reject(by, 'AI 요청이 밀려 있어요. 잠시 후 다시 보내 주세요.');
    const turn: AiTurn = { id: uid(), by, keywords: [], status: 'queued', at: Date.now() };
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
    let ids: string[] = [];
    let why: Record<string, string> = {};
    let keywords: string[] = [];
    let note = '';
    let failed = false;
    // 대화·개념 누적은 결과를 실제로 반영할 때만 한다 (그사이 초기화됐을 수 있다).
    let learned: { turns: ChatTurn[]; concepts: string[] } = { turns: [], concepts: [] };

    if (!list.length) {
      failed = true;
      note = '남은 식당이 없어 정렬하지 못했어요.';
    } else {
      const turnNo = convo.filter((m) => m.role === 'user').length + 1;
      const userMsg = turnPrompt(listText(list, history), prompt, turnNo);
      try {
        if (!state.aiReady) throw new Error(ERR_NO_CREDS);
        const text = await fabrixChat(useSettings.getState().fabrix, [
          { role: 'system', content: AI_SYSTEM },
          ...convo.slice(-AI_HISTORY_TURNS * 2),
          { role: 'user', content: userMsg },
        ]);
        const parsed = parseRanked(text, list.length);
        if (!parsed) throw new Error('AI 응답 형식이 올바르지 않아요');
        ids = parsed.order.map((no) => list[no - 1].id);
        why = Object.fromEntries(Object.entries(parsed.why).map(([no, w]) => [list[Number(no) - 1].id, w]));
        keywords = parsed.keywords.length ? parsed.keywords : localKeywords(prompt);
        learned = {
          concepts: conceptsOf(prompt),
          turns: [
            { role: 'user', content: userMsg },
            { role: 'assistant', content: JSON.stringify({ keywords, order: parsed.order }) },
          ],
        };
      } catch (e) {
        // AI 가 없거나 실패해도 흐름은 이어간다 — 누적 키워드로 정렬한다.
        const fb = fallbackRank(list, history, [...concepts, ...conceptsOf(prompt)]);
        ids = fb.ids;
        why = fb.why;
        keywords = localKeywords(prompt);
        const msg = errText(e);
        note = msg.includes(ERR_NO_CREDS)
          ? '호스트 PC에 AI 키가 없어 키워드로 정렬했어요.'
          : `AI 응답을 받지 못해 키워드로 정렬했어요. (${msg})`;
        // 다음 AI 요청도 이 요청을 알 수 있게 대화에 남긴다.
        learned = {
          concepts: conceptsOf(prompt),
          turns: [
            { role: 'user', content: userMsg },
            {
              role: 'assistant',
              content: JSON.stringify({
                keywords,
                order: ids.map((id) => list.findIndex((r) => r.id === id) + 1),
              }),
            },
          ],
        };
      }
    }

    const wait = Math.max(0, AI_MIN_SPIN_MS - (Date.now() - t0));
    if (wait) await new Promise((r) => later(() => r(null), wait));
    aiBusy = false;
    prompts.delete(turn.id);
    if (disposed) return;
    // 그사이 정렬을 초기화했다면 이 결과는 버린다.
    if (myEpoch !== aiEpoch) {
      void pumpAi();
      return;
    }
    convo.push(...learned.turns);
    concepts = [...concepts, ...learned.concepts];

    update((s) => {
      const ai = s.ai.map((t) =>
        t.id === turn.id
          ? {
              ...t,
              status: failed ? ('failed' as const) : ('done' as const),
              keywords,
              note: note || undefined,
            }
          : t,
      );
      if (failed) return { ...s, ai };
      const seen = new Set(ids);
      const order = [
        ...ids,
        ...(s.order.length ? s.order : s.restaurants.map((r) => r.id)).filter((id) => !seen.has(id)),
      ];
      const tags = keywords.map((k) => `#${k}`).join(' ');
      return withSys(
        { ...s, ai, order, reasons: why },
        `AI 정렬${tags ? ` · ${tags}` : ''} — ${nameOf(turn.by)}님 요청`,
        'ai',
        turn.by,
      );
    });
    void pumpAi();
  };

  const resetAi = (by: string) => {
    aiEpoch += 1;
    convo = [];
    concepts = [];
    prompts.clear();
    update((s) =>
      withSys(
        {
          ...s,
          order: [],
          reasons: {},
          ai: s.ai
            .filter((t) => t.status === 'running')
            .map((t) => ({ ...t, status: 'failed' as const, note: '정렬을 초기화했어요.' })),
        },
        'AI 정렬을 처음 순서로 되돌렸어요',
        'ai',
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
    if (state.dislikes[restId]?.length) return reject(by, '가기 싫은 곳으로 빠진 식당은 확정할 수 없어요.');
    if (state.final?.restId === restId) return;
    undoEaten();
    const since = Date.now();
    useData.getState().recordEaten(restId);
    eatenMark = { restId, since };
    update((s) =>
      withSys(
        { ...s, final: { restId, by, at: since } },
        `오늘 점심은 ${r.name}! — ${nameOf(by)}님이 확정`,
        'final',
        by,
      ),
    );
  };

  // ------------------------------------------------------------ 식당 정보 고치기

  const sanitizeRest = (cur: Restaurant, e: EditableRest): Restaurant => {
    const menus = (Array.isArray(e.menus) ? e.menus : [])
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
    return {
      ...cur,
      category: (CATS as readonly string[]).includes(e.category) ? e.category : cur.category,
      phone: fmtPhone(String(e.phone ?? '')),
      memo: String(e.memo ?? '')
        .trim()
        .slice(0, LIMITS.memo),
      menus,
    };
  };

  const editRest = (by: string, e: EditableRest) => {
    const cur = restOf(String(e?.id ?? ''));
    if (!cur) return reject(by, '그 식당을 찾을 수 없어요.');
    const next = sanitizeRest(cur, e);
    // 데이터 구독이 방 상태를 고쳐 방송한다.
    useData.getState().updateRest(cur.id, () => next);
    update((s) => withSys(s, `${nameOf(by)}님이 ${cur.name} 정보를 고쳤어요`, 'edit', by));
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
      case 'dislike': {
        const id = String(a.restId);
        if (!restOf(id)) return;
        update((s) => {
          const cur = s.dislikes[id] ?? [];
          const mine = cur.includes(by);
          const list = mine ? cur.filter((x) => x !== by) : [...cur, by];
          const dislikes = { ...s.dislikes };
          if (list.length) dislikes[id] = list;
          else delete dislikes[id];
          const cands = { ...s.cands };
          if (!mine) delete cands[id];
          return { ...s, dislikes, cands };
        });
        return;
      }
      case 'cand': {
        const id = String(a.restId);
        if (!restOf(id)) return;
        if (busy()) return reject(by, '연출이 끝나면 다시 눌러 주세요.');
        if (state.dislikes[id]?.length) return reject(by, '가기 싫은 곳으로 빠진 식당이에요.');
        update((s) => {
          const cands = { ...s.cands };
          if (cands[id]) delete cands[id];
          else cands[id] = { by, at: Date.now() };
          return { ...s, cands };
        });
        return;
      }
      case 'clearCands':
        if (busy()) return reject(by, '연출이 끝나면 다시 해 주세요.');
        update((s) => ({ ...s, cands: {} }));
        return;
      case 'roll':
        startRoll(by, Number(a.count));
        return;
      case 'ai':
        queueAi(by, a.prompt);
        return;
      case 'aiReset':
        resetAi(by);
        return;
      case 'ladder':
        startLadder(by, Number(a.keep));
        return;
      case 'final':
        finalize(by, String(a.restId));
        return;
      case 'unfinal':
        if (!state.final) return;
        undoEaten();
        update((s) => withSys({ ...s, final: null }, `${nameOf(by)}님이 확정을 취소했어요`, 'final', by));
        return;
      case 'editRest':
        editRest(by, a.rest);
        return;
      case 'profile': {
        const name = cleanName(a.name);
        const hue = Number(a.hue);
        if (!name) return;
        update((s) => patchMember(s, by, { name, hue: Number.isFinite(hue) ? hue : member(by)!.hue }));
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
    update((s) =>
      withSys(patchMember(s, id, { online: false, typing: false }), `${nameOf(id)}님이 나갔어요`, 'info'),
    );
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
    const hue = Number.isFinite(Number(m.hue)) ? Number(m.hue) : 200;
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
        : withSys(next, `${name}님이 ${first ? '들어왔어요' : '다시 들어왔어요'}`, 'info');
    });
    send([c.peer], { t: 'welcome', you: id, state });
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
    const name = nameOf(memberId);
    for (const p of peers) {
      const c = conns.get(p);
      if (c) c.memberId = null;
      later(() => hostTransport.kick(p), 200);
    }
    update((s) => {
      const dislikes: RoomState['dislikes'] = {};
      for (const [k, v] of Object.entries(s.dislikes)) {
        const left = v.filter((x) => x !== memberId);
        if (left.length) dislikes[k] = left;
      }
      return withSys(
        { ...s, members: s.members.filter((m) => m.id !== memberId), dislikes },
        `${name}님을 내보냈어요`,
        'info',
      );
    });
  };

  const dispose = (reason: string) => {
    if (disposed) return;
    send(readyPeers(), { t: 'bye', reason });
    disposed = true;
    clearTimeout(broadcastTimer);
    clearInterval(sweep);
    timers.forEach(clearTimeout);
    typingTimers.forEach(clearTimeout);
    conns.forEach((c) => clearTimeout(c.helloTimer));
    unsubData();
    unsubSettings();
  };

  cb.onState(state);

  return { getState: () => state, act, handle, kick, dispose };
}
