/**
 * 같이 고르기의 AI 정렬.
 *
 * - 참여자들의 요청은 들어온 순서대로 한 대화(멀티턴)에 쌓인다. 그래서 두 번째 요청부터는
 *   앞선 요청까지 반영한 '누적' 순서가 나온다.
 * - 원문은 방송하지 않고, AI 가 뽑은(또는 여기서 뽑은) 키워드만 공개한다.
 * - 호스트에 AI 키가 없거나 호출이 실패하면 키워드 사전으로 간단히 정렬해 흐름이 막히지 않게 한다.
 */
import type { HistoryEntry, Restaurant } from '../lib/types';
import { agoText, daysAgo, lastAt, longDateText } from '../lib/util';

export const AI_SYSTEM = [
  '당신은 여러 명의 직장인이 함께 점심 식당을 고르는 걸 돕는 큐레이터입니다.',
  '참여자들의 요청이 한 대화 안에서 순서대로 들어옵니다. 새 요청이 와도 앞선 요청을 버리지 말고, 누적된 취향을 모두 반영해 판단하세요.',
  '요청한 JSON 형식만 출력하고 다른 설명은 덧붙이지 않습니다.',
].join(' ');

const KEYWORD_MAX = 3;
const KEYWORD_LEN = 10;
const WHY_LEN = 30;

// ---------------------------------------------------------------- 프롬프트

export function listText(rs: Restaurant[], history: readonly HistoryEntry[]) {
  return rs
    .map((r, i) => {
      const menus = r.menus.map((m) => m.name + (m.price ? `(${m.price}원)` : '')).join(', ');
      const d = daysAgo(lastAt(history, r.id));
      const ago = d === null ? '' : ` · 최근 방문 ${agoText(d)}`;
      return `${i + 1}. ${r.name} [${r.category}] 메뉴: ${menus || '정보 없음'}${ago}`;
    })
    .join('\n');
}

export function turnPrompt(list: string, request: string, turnNo: number) {
  return [
    turnNo === 1
      ? '아래는 지금 함께 고르는 중인 식당 목록이에요.'
      : '목록이 바뀌었을 수 있으니 아래 최신 목록의 번호로 다시 정렬하세요. 앞선 요청들도 계속 반영하세요.',
    `오늘: ${longDateText()}`,
    '',
    '목록:',
    list,
    '',
    `새 요청: ${request}`,
    '',
    '모든 식당을 지금까지의 요청에 가장 잘 맞는 순서로 정렬해 JSON 객체 하나만 출력하세요.',
    '형식: {"keywords":["이번 요청의 핵심 키워드 1~3개, 각 8자 이내"],"order":[번호, ... 모든 번호],"why":{"번호":"상위 3곳만, 이유 한 문장 20자 이내, 해요체"}}',
    'keywords 에는 요청 문장을 그대로 옮기지 말고 핵심 단어만 쓰세요 (예: "국물", "안 매운").',
  ].join('\n');
}

// ---------------------------------------------------------------- 응답 해석

export type Ranked = { keywords: string[]; order: number[]; why: Record<number, string> };

const cleanKeyword = (k: unknown) =>
  String(k ?? '')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, KEYWORD_LEN);

const toNo = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** AI 답변에서 순서를 꺼낸다. 객체가 아니라 번호 배열만 와도 받아준다. */
export function parseRanked(text: string, n: number): Ranked | null {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  let raw: unknown = null;
  if (s >= 0 && e > s) {
    try {
      raw = JSON.parse(text.slice(s, e + 1));
    } catch {
      raw = null;
    }
  }
  if (!raw) {
    const as = text.indexOf('[');
    const ae = text.lastIndexOf(']');
    if (as < 0 || ae <= as) return null;
    try {
      raw = { order: JSON.parse(text.slice(as, ae + 1)) };
    } catch {
      return null;
    }
  }
  const obj = raw as { keywords?: unknown; order?: unknown; why?: unknown };
  if (!Array.isArray(obj.order)) return null;

  const seen = new Set<number>();
  const order: number[] = [];
  for (const v of obj.order) {
    // [{no, reason}] 형태로 오는 모델도 있다.
    const no = toNo(typeof v === 'object' && v ? (v as { no?: unknown }).no : v);
    if (no === null || no > n || seen.has(no)) continue;
    seen.add(no);
    order.push(no);
  }
  if (!order.length) return null;

  const keywords = Array.isArray(obj.keywords)
    ? [...new Set(obj.keywords.map(cleanKeyword).filter(Boolean))].slice(0, KEYWORD_MAX)
    : [];

  const why: Record<number, string> = {};
  if (obj.why && typeof obj.why === 'object') {
    for (const [k, v] of Object.entries(obj.why as Record<string, unknown>)) {
      const no = toNo(k);
      const text = String(v ?? '')
        .trim()
        .slice(0, WHY_LEN);
      if (no !== null && no <= n && text) why[no] = text;
    }
  }
  return { keywords, order, why };
}

// ---------------------------------------------------------------- 키워드 사전 (대체 정렬)

type Concept = {
  key: string;
  /** 요청 문장에서 이 개념을 알아보는 패턴 */
  ask: RegExp;
  /** 식당(이름·분류·메뉴·메모)에서 맞는지 보는 패턴 */
  hit?: RegExp;
  cat?: string;
  weight?: number;
  /** 최근에 안 간 곳을 올린다 */
  fresh?: boolean;
  /** 메뉴 평균 가격이 낮은 곳을 올린다 */
  cheap?: boolean;
};

const SPICY = /마라|짬뽕|떡볶이|라볶이|김치|제육|닭갈비|육개장|똠얌|쫄면|매운|불닭|커리|카레/;
const SOUP = /탕|찌개|국밥|순대국|국수|칼국수|라멘|쌀국수|우동|짬뽕|똠얌|마라탕|육개장|만두국|수제비/;

// 앞쪽이 먼저 검사된다. '안 매운' 이 '매운' 보다 앞에 있어야 한다.
const CONCEPTS: Concept[] = [
  {
    key: '안 매운',
    ask: /안\s?매운|맵지\s?않|안\s?맵|순한|덜\s?매운|매운\s?(건|거|것|음식)?\s?(빼|말고|싫|제외|별로|못)/,
    hit: SPICY,
    weight: -3,
  },
  { key: '매운', ask: /매운|매콤|얼큰|맵게|칼칼|매워/, hit: SPICY },
  { key: '국물', ask: /국물|뜨끈|따뜻|따끈|탕|찌개|국밥/, hit: SOUP },
  { key: '해장', ask: /해장|숙취|술\s?먹/, hit: /국밥|순대국|짬뽕|쌀국수|칼국수|라멘|육개장|갈비탕|해장/ },
  { key: '추운 날', ask: /추워|추운|쌀쌀|춥/, hit: SOUP },
  { key: '더운 날', ask: /더워|더운|덥|시원/, hit: /냉면|막국수|샐러드|포케|초밥|쫄면|소바|모밀/ },
  { key: '비 오는 날', ask: /비\s?와|비가|비\s?오|장마/, hit: /칼국수|짬뽕|수제비|라멘|국밥|탕|찌개|만두/ },
  {
    key: '가볍게',
    ask: /가볍|가벼운|간단|라이트|다이어트|적게|소식/,
    hit: /샐러드|포케|김밥|쌀국수|초밥|우동|반미|샌드|죽/,
  },
  {
    key: '든든하게',
    ask: /든든|배고|배가\s?고|푸짐|많이|헤비/,
    hit: /갈비|고기|제육|카츠|돈까스|버거|닭갈비|덮밥|국밥|수육|탕수육|텐동|정식/,
  },
  {
    key: '빨리',
    ask: /빨리|빠르|빠른|급해|급한|시간\s?없|금방|후딱/,
    hit: /김밥|덮밥|버거|국밥|분식|우동|떡볶이|반미|포케/,
  },
  {
    key: '면',
    ask: /면\s?요리|면\s?땡|면이|국수|라멘|파스타|누들/,
    hit: /면|국수|라멘|파스타|짜장|짬뽕|쌀국수|우동|막국수|칼국수|쫄면|팟타이/,
  },
  { key: '밥', ask: /밥\s?먹|밥이|덮밥|비빔|백반|밥심/, hit: /밥|덮밥|비빔|리조또|카레|커리|텐동|정식/ },
  {
    key: '고기',
    ask: /고기|육식|갈비|돈까스|돈카츠|치킨/,
    hit: /고기|갈비|제육|카츠|돈까스|닭|수육|버거|비리아/,
  },
  { key: '한식', ask: /한식|한국/, cat: '한식' },
  { key: '중식', ask: /중식|중국|중화/, cat: '중식' },
  { key: '일식', ask: /일식|일본/, cat: '일식' },
  { key: '양식', ask: /양식|서양/, cat: '양식' },
  { key: '분식', ask: /분식/, cat: '분식' },
  { key: '아시안', ask: /아시안|동남아|베트남|태국|인도/, cat: '아시안' },
  { key: '안 가본 곳', ask: /안\s?가\s?본|새로운|새로\s?생긴|색다른|안\s?먹어\s?본/, fresh: true },
  { key: '가성비', ask: /싼|저렴|가성비|싸게|만\s?원\s?이하/, cheap: true },
];

const STOP = new Set([
  '오늘',
  '점심',
  '오늘은',
  '좀',
  '조금',
  '그냥',
  '정말',
  '진짜',
  '너무',
  '아무',
  '거',
  '것',
  '먹고',
  '싶어',
  '싶어요',
  '싶다',
  '먹자',
  '먹을',
  '먹고싶어',
  '어때',
  '어때요',
  '추천',
  '해줘',
  '해주세요',
  '있는',
  '없는',
  '곳',
  '데',
  '집',
  '메뉴',
  '우리',
  '저는',
  '나는',
  '제가',
  '같이',
  '다들',
  '하고',
]);
const JOSA = /(으로|에서|이랑|하고|은|는|이|가|을|를|에|도|로|요|랑|만)$/;

export function conceptsOf(prompt: string): string[] {
  const out: string[] = [];
  for (const c of CONCEPTS) {
    if (!c.ask.test(prompt)) continue;
    // '안 매운' 을 찾았으면 '매운' 은 건너뛴다.
    if (c.key === '매운' && out.includes('안 매운')) continue;
    out.push(c.key);
  }
  return out;
}

/** 공개용 키워드. 사전에 있는 개념을 먼저, 없으면 문장에서 명사 같은 낱말을 고른다. */
export function localKeywords(prompt: string): string[] {
  const cs = conceptsOf(prompt);
  if (cs.length) return cs.slice(0, KEYWORD_MAX);
  const words = prompt
    .split(/[\s,.!?~·/()"'“”‘’]+/)
    .map((w) => w.replace(JOSA, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return [...new Set(words)].slice(0, KEYWORD_MAX).map(cleanKeyword);
}

const restText = (r: Restaurant) =>
  `${r.name} ${r.category} ${r.menus.map((m) => m.name).join(' ')} ${r.memo}`;

const avgPrice = (r: Restaurant) => {
  const ps = r.menus.map((m) => m.price).filter((p): p is number => typeof p === 'number' && p > 0);
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
};

/**
 * 누적된 개념들로 점수를 매겨 정렬한다. 같은 점수는 이전 순서를 유지한다 (안정 정렬).
 * 돌려주는 why 는 점수가 오른 앞쪽 3곳에만 붙인다.
 */
export function fallbackRank(
  rs: Restaurant[],
  history: readonly HistoryEntry[],
  concepts: string[],
): { ids: string[]; why: Record<string, string> } {
  const defs = concepts.map((k) => CONCEPTS.find((c) => c.key === k)).filter((c): c is Concept => !!c);
  const scored = rs.map((r, i) => {
    const text = restText(r);
    let score = 0;
    const hits: string[] = [];
    for (const c of defs) {
      let s = 0;
      if (c.hit && c.hit.test(text)) s += 2 * (c.weight ?? 1);
      if (c.cat && r.category === c.cat) s += 3;
      if (c.fresh) {
        const d = daysAgo(lastAt(history, r.id));
        s += d === null ? 2 : d <= 3 ? -2 : 0;
      }
      if (c.cheap) {
        const p = avgPrice(r);
        if (p !== null) s += p <= 9000 ? 2 : p >= 14000 ? -1 : 0;
      }
      if (s > 0) hits.push(c.key);
      score += s;
    }
    return { r, i, score, hits };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const why: Record<string, string> = {};
  scored.slice(0, 3).forEach((x) => {
    if (x.score > 0 && x.hits.length) why[x.r.id] = `${x.hits.slice(0, 2).join(' · ')}에 잘 맞아요`;
  });
  return { ids: scored.map((x) => x.r.id), why };
}
