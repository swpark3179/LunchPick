import type { ModeId, Step } from '../lib/types';

export const MODES: Record<ModeId, { name: string; tag: string; desc: string }> = {
  elim: {
    name: '소거법',
    tag: '소거',
    desc: '먹기 싫은 곳을 하나씩 지워요. 무작위로 지우기도 돼요.',
  },
  cup: { name: '이상형 월드컵', tag: 'VS', desc: '둘 중 하나만 고르는 토너먼트.' },
  ladder: { name: '사다리 타기', tag: '사다리', desc: '운에 맡기는 사다리. 8곳 이하에서.' },
  roulette: { name: '룰렛', tag: '룰렛', desc: '돌려서 뽑아요. 12곳 이하에서.' },
  slot: { name: '슬롯머신', tag: '슬롯', desc: '레버 한 번에 최대 4곳을 동시에 뽑아요.' },
  ai: {
    name: 'AI 추천',
    tag: 'AI',
    desc: '기분·날씨 같은 오늘 조건을 고려해 AI가 골라줘요.',
  },
};

export const MIDS = Object.keys(MODES) as ModeId[];

export type Preset = { id: string; name: string; desc: string; steps: Step[] | null };

export const PRESETS: Preset[] = [
  {
    id: 'p1',
    name: 'AI 큐레이션 → 월드컵',
    desc: 'AI가 오늘 조건에 맞는 8곳을 고르고, 토너먼트로 우승을 가려요.',
    steps: [
      { mode: 'ai', keep: 8 },
      { mode: 'cup', keep: 1 },
    ],
  },
  {
    id: 'p2',
    name: '소거 → 룰렛',
    desc: '싫은 곳만 직접 지우고, 남은 6곳은 운에 맡겨요.',
    steps: [
      { mode: 'elim', keep: 6 },
      { mode: 'roulette', keep: 1 },
    ],
  },
  {
    id: 'p3',
    name: 'AI 4곳 → 사다리',
    desc: 'AI가 좁혀준 4곳을 사다리로 깔끔하게 결정.',
    steps: [
      { mode: 'ai', keep: 4 },
      { mode: 'ladder', keep: 1 },
    ],
  },
  {
    id: 'p4',
    name: '슬롯 → 같이 고르기',
    desc: '슬롯으로 4곳을 뽑고, 마지막은 함께 직접 골라요.',
    steps: [{ mode: 'slot', keep: 4 }],
  },
  {
    id: 'p5',
    name: '3단 서바이벌',
    desc: 'AI 12곳 → 소거법 6곳 → 월드컵 우승.',
    steps: [
      { mode: 'ai', keep: 12 },
      { mode: 'elim', keep: 6 },
      { mode: 'cup', keep: 1 },
    ],
  },
  { id: 'custom', name: '직접 만들기', desc: '방식과 남길 개수를 단계별로 정해요.', steps: null },
];

export const MOODS = [
  '가볍게',
  '든든하게',
  '매운 거',
  '국물',
  '빨리 먹기',
  '해장',
  '비 와요',
  '더워요',
  '추워요',
  '안 가본 곳',
];

/** 각 모드가 한 번에 다룰 수 있는 후보 수 한계. 넘으면 월드컵으로 폴백한다. */
export const MODE_LIMIT: Partial<Record<ModeId, number>> = { ladder: 8, roulette: 12 };

/** 단계 하나의 설정이 유효한지 검사한다. 문구는 목업과 동일. */
export function stepErr(st: Step, incoming: number): string {
  if (st.keep < 1) return '1곳 이상 남겨야 해요';
  if (incoming < 2) return '후보를 2곳 이상 선택하세요';
  if (st.keep >= incoming) return `${incoming}곳보다 적게 남겨야 해요`;
  if (st.mode === 'ladder' && incoming > 8) return `사다리는 8곳 이하에서 (지금 ${incoming}곳)`;
  if (st.mode === 'roulette' && incoming > 12) return `룰렛은 12곳 이하에서 (지금 ${incoming}곳)`;
  if (st.mode === 'slot' && st.keep > 4) return '슬롯은 4곳까지만 뽑아요';
  return '';
}

/** 계획 전체를 앞에서부터 검사한다. 각 단계의 들어오는 후보 수는 앞 단계의 keep 으로 줄어든다. */
export function validatePlan(plan: Step[], n: number): string[] {
  let inc = n;
  return plan.map((st) => {
    const e = stepErr(st, inc);
    inc = Math.min(inc, st.keep);
    return e;
  });
}

export const playHint = (mode: ModeId | null, keep: number): string => {
  switch (mode) {
    case 'elim':
      return `먹기 싫은 곳을 눌러 지우세요. 다시 누르면 되살아나요. ${keep}곳이 남으면 끝.`;
    case 'cup':
      return '더 끌리는 쪽을 누르세요.';
    case 'ladder':
      return '사다리를 타고 내려가 당첨 칸에 닿은 곳이 살아남아요.';
    case 'roulette':
      return `가운데를 눌러 돌리세요. ${keep}곳을 뽑아요.`;
    case 'slot':
      return `레버를 당기면 ${keep}곳이 한 번에 나와요. 마음에 안 들면 다시!`;
    case 'ai':
      return '오늘 상황을 골라주면 AI가 후보를 추려줘요.';
    default:
      return '';
  }
};
