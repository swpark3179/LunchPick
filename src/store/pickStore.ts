import { create } from 'zustand';

import { ERR_NO_CREDS, fabrixRecommend } from '../lib/ipc';
import type { ModeId, PickItem, Restaurant, Step } from '../lib/types';
import { agoText, daysAgo, lastAt, longDateText, pick, shuffle, topMenus } from '../lib/util';
import { cupNorm, initG, type Game } from '../pick/engine';
import { MODES, PRESETS, validatePlan } from '../pick/modes';
import { useData } from './dataStore';
import { speedMul, useSettings } from './settingsStore';

// ---------------------------------------------------------------- 타이머
// 목업의 _timers / clearTimers 와 같은 역할. 렌더와 무관하므로 스토어 밖에 둔다.

let timers: ReturnType<typeof setTimeout>[] = [];
let scanIv: ReturnType<typeof setInterval> | undefined;
// clearTimers 때마다 증가한다. await 중에 그만두기/재시작되면 늦게 온 응답을 버리는 데 쓴다.
let epoch = 0;

function later(fn: () => void, ms: number) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}

export function clearTimers() {
  epoch++;
  timers.forEach(clearTimeout);
  timers = [];
  if (scanIv !== undefined) {
    clearInterval(scanIv);
    scanIv = undefined;
  }
}

const sp = () => speedMul(useSettings.getState().animSpeed);

const toItem = (r: Restaurant): PickItem => ({
  key: r.id,
  restId: r.id,
  title: r.name,
  cat: r.category,
  sub: topMenus(r, 2).map((m) => m.name).join(' · ') || '메뉴 미등록',
});

// ---------------------------------------------------------------- 스토어

export type Stage = 'setup' | 'play' | 'result';
export type Intermission = { head: string; main: string; next: string };

type PickState = {
  // --- setup
  stage: Stage;
  /** 후보에서 제외한 식당 id */
  excl: Record<string, boolean>;
  /** 이전 결과로 범위를 좁힌 경우의 식당 id 목록 */
  scope: string[] | null;
  setupSearch: string;
  methodTab: 'single' | 'course';
  mode: ModeId;
  target: number;
  preset: string;
  custom: Step[];

  // --- play
  plan: Step[];
  stepIdx: number;
  curMode: ModeId | null;
  cands: PickItem[];
  g: Game | null;
  inter: Intermission | null;
  interShow: boolean;

  // --- result
  results: PickItem[];
  resEnter: boolean;

  // --- 파생
  basePool: () => Restaurant[];
  pickedItems: () => PickItem[];
  currentPlan: () => Step[];
  keep: () => number;

  // --- setup 조작
  toggleExcl: (id: string) => void;
  toggleCatGroup: (cat: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  setSetupSearch: (v: string) => void;
  clearScope: () => void;
  setMethodTab: (v: 'single' | 'course') => void;
  setMode: (v: ModeId) => void;
  setTarget: (v: number) => void;
  setPreset: (v: string) => void;
  setCustomStep: (i: number, p: Partial<Step>) => void;
  addCustomStep: () => void;
  removeCustomStep: (i: number) => void;

  // --- 흐름
  start: () => void;
  beginStep: (i: number, cands: PickItem[]) => void;
  endStep: (items: PickItem[]) => void;
  finish: (items: PickItem[]) => void;
  quit: () => void;
  restart: () => void;
  narrow: () => void;
  decide: (it: PickItem) => void;

  // --- 엔진
  elimToggle: (key: string) => void;
  elimRandom: () => void;
  cupEnter: () => void;
  cupPick: (side: 'L' | 'R') => void;
  ladderRun: (i: number) => void;
  ladderAll: () => void;
  spin: () => void;
  pull: () => void;
  setAiMood: (m: string) => void;
  setAiText: (v: string) => void;
  askAI: () => Promise<void>;
};

export const usePick = create<PickState>((set, get) => ({
  stage: 'setup',
  excl: {},
  scope: null,
  setupSearch: '',
  methodTab: 'single',
  mode: 'cup',
  target: 1,
  preset: 'p1',
  custom: [
    { mode: 'ai', keep: 8 },
    { mode: 'cup', keep: 1 },
  ],

  plan: [],
  stepIdx: 0,
  curMode: null,
  cands: [],
  g: null,
  inter: null,
  interShow: false,

  results: [],
  resEnter: false,

  // ---------------------------------------------------------------- 파생

  basePool: () => {
    const rs = useData.getState().restaurants;
    const { scope } = get();
    return scope ? rs.filter((r) => scope.includes(r.id)) : rs;
  },

  pickedItems: () => {
    const { excl } = get();
    return get()
      .basePool()
      .filter((r) => !excl[r.id])
      .map(toItem);
  },

  currentPlan: () => {
    const s = get();
    if (s.methodTab === 'single') return [{ mode: s.mode, keep: s.target }];
    if (s.preset === 'custom') return s.custom;
    return PRESETS.find((p) => p.id === s.preset)?.steps ?? s.custom;
  },

  keep: () => {
    const p = get().plan[get().stepIdx];
    return p ? p.keep : 1;
  },

  // ---------------------------------------------------------------- setup 조작

  toggleExcl: (id) => set((s) => ({ excl: { ...s.excl, [id]: !s.excl[id] } })),

  toggleCatGroup: (cat) => {
    const inCat = get().basePool().filter((r) => r.category === cat);
    const { excl } = get();
    const anyOn = inCat.some((r) => !excl[r.id]);
    const next = { ...excl };
    // 하나라도 켜져 있으면 전부 끄고, 전부 꺼져 있으면 전부 켠다.
    inCat.forEach((r) => {
      next[r.id] = anyOn;
    });
    set({ excl: next });
  },

  selectAll: () => set({ excl: {} }),

  selectNone: () => {
    const next: Record<string, boolean> = {};
    get().basePool().forEach((r) => {
      next[r.id] = true;
    });
    set({ excl: next });
  },

  setSetupSearch: (setupSearch) => set({ setupSearch }),
  clearScope: () => set({ scope: null, excl: {} }),
  setMethodTab: (methodTab) => set({ methodTab }),
  setMode: (mode) => set({ mode }),
  setTarget: (target) => set({ target }),
  setPreset: (preset) => set({ preset }),

  setCustomStep: (i, p) =>
    set((s) => ({ custom: s.custom.map((c, j) => (j === i ? { ...c, ...p } : c)) })),
  addCustomStep: () =>
    set((s) => (s.custom.length < 3 ? { custom: [...s.custom, { mode: 'cup', keep: 1 }] } : s)),
  removeCustomStep: (i) => set((s) => ({ custom: s.custom.filter((_, j) => j !== i) })),

  // ---------------------------------------------------------------- 흐름

  start: () => {
    const plan = get().currentPlan();
    const items = get().pickedItems();
    if (validatePlan(plan, items.length).some(Boolean)) return;
    clearTimers();
    set({ stage: 'play', plan, stepIdx: 0, results: [], inter: null, interShow: false });
    get().beginStep(0, shuffle(items));
  },

  beginStep: (i, cands) => {
    const st = get().plan[i];
    if (!st) return;
    if (cands.length <= st.keep) {
      set({ stepIdx: i, cands });
      get().endStep(cands);
      return;
    }
    // 후보 수가 모드 한계를 넘으면 월드컵으로 폴백한다 (목업과 동일).
    let mode = st.mode;
    if (
      (mode === 'ladder' && cands.length > 8) ||
      (mode === 'roulette' && cands.length > 12) ||
      (mode === 'slot' && st.keep > 4)
    ) {
      mode = 'cup';
    }
    set({
      stepIdx: i,
      cands,
      curMode: mode,
      g: initG(mode, cands, st.keep),
      inter: null,
      interShow: false,
    });
    if (mode === 'cup') get().cupEnter();
  },

  endStep: (items) => {
    const speed = sp();
    const { stepIdx: i, plan } = get();
    clearTimers();
    if (i < plan.length - 1) {
      const nx = plan[i + 1];
      set({
        inter: {
          head: `${i + 1}단계 완료`,
          main: `${items.length}곳 남았어요`,
          next: `다음: ${MODES[nx.mode].name} · ${nx.keep}곳까지`,
        },
        interShow: false,
      });
      later(() => set({ interShow: true }), 30);
      later(() => get().beginStep(i + 1, shuffle(items)), 1700 * speed);
      return;
    }
    get().finish(items);
  },

  finish: (items) => {
    clearTimers();
    set({ stage: 'result', results: items, resEnter: true, inter: null, interShow: false });
    later(() => set({ resEnter: false }), 60);
    // 최종 1곳이면 그게 오늘의 결정이다 — 먹은 기록을 남긴다.
    if (items.length === 1) useData.getState().recordEaten(items[0].restId);
  },

  quit: () => {
    clearTimers();
    set({ stage: 'setup', g: null, curMode: null, inter: null, interShow: false });
  },

  restart: () => {
    clearTimers();
    set({
      stage: 'setup',
      scope: null,
      excl: {},
      g: null,
      curMode: null,
      results: [],
      inter: null,
      interShow: false,
    });
  },

  narrow: () => {
    const r = get().results;
    clearTimers();
    set({
      stage: 'setup',
      scope: r.map((x) => x.restId),
      excl: {},
      target: 1,
      methodTab: 'single',
      mode: r.length <= 4 ? 'roulette' : 'cup',
      g: null,
      curMode: null,
    });
  },

  decide: (it) => {
    clearTimers();
    set({ results: [it], resEnter: true });
    later(() => set({ resEnter: false }), 60);
    useData.getState().recordEaten(it.restId);
  },

  // ---------------------------------------------------------------- 소거법

  elimToggle: (key) => {
    const g = get().g;
    if (g?.kind !== 'elim' || g.busy) return;
    if (g.out[key]) {
      set({ g: { ...g, out: { ...g.out, [key]: false } } });
      return;
    }
    if (get().cands.filter((c) => !g.out[c.key]).length <= get().keep()) return;
    set({ g: { ...g, out: { ...g.out, [key]: true } } });
  },

  elimRandom: () => {
    const g = get().g;
    if (g?.kind !== 'elim' || g.busy) return;
    const keep = get().keep();
    const speed = sp();
    if (get().cands.filter((c) => !g.out[c.key]).length <= keep) return;
    set({ g: { ...g, busy: true } });

    // 12틱 동안 점점 느려지는 플래시 후 한 곳을 확정 탈락시킨다.
    let t = 0;
    const total = 12;
    const tick = () => {
      const cur = get().g;
      if (cur?.kind !== 'elim') return;
      const alive = get().cands.filter((c) => !cur.out[c.key]);
      if (!alive.length) return;
      let k = pick(alive).key;
      if (alive.length > 1) while (k === cur.flash) k = pick(alive).key;
      t += 1;
      if (t >= total) {
        set({ g: { ...cur, flash: k } });
        later(() => {
          const g3 = get().g;
          if (g3?.kind !== 'elim') return;
          set({ g: { ...g3, out: { ...g3.out, [k]: true }, flash: null, busy: false } });
        }, 380 * speed);
        return;
      }
      set({ g: { ...cur, flash: k } });
      later(tick, (45 + t * t * 3.2) * speed);
    };
    tick();
  },

  // ---------------------------------------------------------------- 월드컵

  cupEnter: () => {
    later(() => {
      const g = get().g;
      if (g?.kind === 'cup') set({ g: { ...g, enter: false } });
    }, 40);
  },

  cupPick: (side) => {
    const g = get().g;
    if (g?.kind !== 'cup' || g.chosen || g.enter) return;
    const item = side === 'L' ? g.round[g.i] : g.round[g.i + 1];
    if (!item) return;
    const keep = get().keep();
    const speed = sp();
    set({ g: { ...g, chosen: item.key } });
    later(() => {
      const cg = get().g;
      if (cg?.kind !== 'cup') return;
      const ng = cupNorm(
        { ...cg, next: [...cg.next, item], i: cg.i + 2, chosen: null, enter: true },
        keep,
      );
      if (ng.done) {
        get().endStep(ng.next);
        return;
      }
      set({ g: ng });
      get().cupEnter();
    }, 650 * speed);
  },

  // ---------------------------------------------------------------- 사다리

  ladderRun: (i) => {
    const g = get().g;
    if (g?.kind !== 'ladder' || g.drawn[i]) return;
    const dur = 1500 * sp();
    set({ g: { ...g, drawn: { ...g.drawn, [i]: true } } });
    later(() => {
      const g2 = get().g;
      if (g2?.kind === 'ladder') set({ g: { ...g2, revealed: { ...g2.revealed, [i]: true } } });
    }, dur);
  },

  ladderAll: () => {
    const g = get().g;
    if (g?.kind !== 'ladder') return;
    const speed = sp();
    let k = 0;
    get().cands.forEach((_, i) => {
      if (g.drawn[i]) return;
      later(() => get().ladderRun(i), k * 320 * speed);
      k += 1;
    });
  },

  // ---------------------------------------------------------------- 룰렛

  spin: () => {
    const g = get().g;
    if (g?.kind !== 'roulette' || g.spinning) return;
    const keep = get().keep();
    if (g.winners.length >= keep) return;
    const speed = sp();
    const n = g.wheel.length;
    if (!n) return;
    const seg = 360 / n;
    const idx = Math.floor(Math.random() * n);
    const center = (idx + 0.5) * seg;
    const jit = (Math.random() - 0.5) * seg * 0.6;
    // 현재 각도를 360 단위로 올림한 뒤 6회전 + 목표 세그먼트로 맞춘다.
    const rot = Math.ceil(g.rot / 360) * 360 + 360 * 6 + (360 - center) + jit;
    const dur = 4200 * speed;
    set({ g: { ...g, spinning: true, rot, last: null, noAnim: false } });
    later(() => {
      const cur = get().g;
      if (cur?.kind !== 'roulette') return;
      const w = cur.wheel[idx];
      const winners = [...cur.winners, w];
      set({ g: { ...cur, spinning: false, winners, last: w } });
      if (winners.length >= keep) return;
      later(() => {
        const g2 = get().g;
        if (g2?.kind !== 'roulette') return;
        // 뽑힌 조각을 빼고 애니메이션 없이 0도로 되돌린다.
        set({ g: { ...g2, wheel: g2.wheel.filter((c) => c.key !== w.key), rot: 0, noAnim: true } });
        later(() => {
          const g3 = get().g;
          if (g3?.kind === 'roulette') set({ g: { ...g3, noAnim: false } });
        }, 50);
      }, 1300 * speed);
    }, dur + 80);
  },

  // ---------------------------------------------------------------- 슬롯

  pull: () => {
    const g = get().g;
    if (g?.kind !== 'slot' || g.pulling) return;
    const c = get().cands;
    if (!c.length) return;
    const speed = sp();
    const K = g.reels.length;
    const winners = shuffle(c).slice(0, K);
    const reels = g.reels.map((r, ri) => {
      const prev = r.strip[r.pos];
      const mid = Array.from({ length: 24 + ri * 6 }, () => pick(c));
      return {
        strip: [r.strip[r.pos - 1] ?? pick(c), prev, ...mid, winners[ri], pick(c)],
        pos: 1,
        anim: false,
        dur: (1600 + ri * 520) * speed,
      };
    });
    set({ g: { ...g, reels, pulling: true, pulled: false, winners } });
    later(() => {
      const g2 = get().g;
      if (g2?.kind !== 'slot') return;
      set({
        g: { ...g2, reels: g2.reels.map((r) => ({ ...r, pos: r.strip.length - 2, anim: true })) },
      });
    }, 40);
    later(
      () => {
        const g3 = get().g;
        if (g3?.kind !== 'slot') return;
        set({ g: { ...g3, pulling: false, pulled: true } });
      },
      (1600 + (K - 1) * 520) * speed + 120,
    );
  },

  // ---------------------------------------------------------------- AI

  setAiMood: (m) => {
    const g = get().g;
    if (g?.kind !== 'ai') return;
    set({ g: { ...g, mood: { ...g.mood, [m]: !g.mood[m] } } });
  },

  setAiText: (v) => {
    const g = get().g;
    if (g?.kind !== 'ai') return;
    set({ g: { ...g, text: v } });
  },

  askAI: async () => {
    const g0 = get().g;
    if (g0?.kind !== 'ai' || g0.loading) return;
    const keep = get().keep();
    const cands = get().cands;
    const { restaurants, history } = useData.getState();
    const conf = useSettings.getState().fabrix;

    const moods = Object.keys(g0.mood).filter((k) => g0.mood[k]);
    const conds = [...moods, g0.text.trim()].filter(Boolean).join(', ');

    set({ g: { ...g0, loading: true, picks: null, error: '' } });

    // 후보 카드를 훑는 스캔 애니메이션
    const keys = cands.map((c) => c.key);
    if (scanIv !== undefined) clearInterval(scanIv);
    scanIv = setInterval(() => {
      const cur = get().g;
      if (cur?.kind === 'ai') set({ g: { ...cur, scan: pick(keys) } });
    }, 130);

    const t0 = Date.now();
    const myEpoch = epoch;
    let picks: Record<string, string> = {};
    let err = '';

    try {
      const list = cands
        .map((c, i) => {
          const r = restaurants.find((x) => x.id === c.restId);
          const menus =
            r?.menus.map((m) => m.name + (m.price ? `(${m.price}원)` : '')).join(', ') ?? '';
          const d = r ? daysAgo(lastAt(history, r.id)) : null;
          const ago = d === null ? '' : ` · 최근 방문 ${agoText(d)}`;
          return `${i + 1}. ${c.title} [${c.cat}] 메뉴: ${menus || '정보 없음'}${ago}`;
        })
        .join('\n');

      const prompt = [
        `당신은 한국 직장인 점심 식당 큐레이터입니다. 아래 후보 중 오늘 조건에 가장 잘 맞는 식당 ${keep}곳을 고르세요.`,
        `오늘: ${longDateText()}`,
        `조건: ${conds || '특별한 조건 없음 — 다양성과 균형을 고려'}`,
        '',
        '후보:',
        list,
        '',
        '반드시 JSON 배열만 출력하세요. 형식: [{"no":후보번호,"reason":"고른 이유 한 문장, 30자 이내, 해요체"}]',
      ].join('\n');

      const arr = await fabrixRecommend(conf, prompt);
      for (const o of arr) {
        const c = cands[Number(o.no) - 1];
        if (!c || picks[c.key] !== undefined) continue;
        if (Object.keys(picks).length >= keep) break;
        picks[c.key] = String(o.reason ?? '');
      }
      if (!Object.keys(picks).length) throw new Error('추천 결과가 비어 있어요.');
    } catch (e) {
      const raw = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
      const firstLine = raw.split('\n')[0];
      err = raw.includes(ERR_NO_CREDS)
        ? '설정에서 FabriX 키를 입력해 주세요. 지금은 무작위로 골랐어요.'
        : `AI 응답을 받지 못해 무작위로 골랐어요. (${firstLine})`;
      // 목업과 동일하게 — AI 가 실패해도 흐름이 막히지 않는다.
      picks = {};
      shuffle(keys)
        .slice(0, keep)
        .forEach((k) => {
          picks[k] = '무작위 선택';
        });
    }

    if (epoch !== myEpoch) return;

    // 너무 빨리 끝나면 스캔 연출이 깜빡여 보이므로 최소 1.8초는 유지한다.
    later(
      () => {
        if (scanIv !== undefined) {
          clearInterval(scanIv);
          scanIv = undefined;
        }
        const st = get();
        if (st.stage !== 'play' || st.curMode !== 'ai') return;
        const cur = st.g;
        if (cur?.kind !== 'ai') return;
        set({ g: { ...cur, loading: false, scan: null, picks, error: err } });
      },
      Math.max(0, 1800 - (Date.now() - t0)),
    );
  },
}));
