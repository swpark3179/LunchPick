/**
 * 같이 고르기 화면 조각(사다리·하트 걸기·확정 …)이 후보 하나를 그릴 때 쓰는 해석기.
 * 후보 id 는 점심 방에서는 식당 id, 도란식사 방에서는 선택지 id 다.
 * restId 는 '정보 보기'로 열 식당이다.
 */
import { choiceName, choiceOf, itemsLine, moneyText } from '../../share/doran';
import type { Action, RoomState } from '../../share/protocol';
import { CH, HUES } from '../../theme';

export type ItemView = {
  id: string;
  /** 'A안 회 코스' / '진주집' */
  title: string;
  /** 좁은 자리용 — 'A안' / '진주집' */
  short: string;
  /** 한 줄 설명 — 메뉴 구성·합계 / 분류·대표 메뉴 */
  sub: string;
  hue: number;
  restId: string;
};

export function itemOf(room: RoomState, id: string): ItemView | undefined {
  if (room.kind === 'doran') {
    const c = choiceOf(room, id);
    if (!c) return undefined;
    const r = room.restaurants.find((x) => x.id === c.restId);
    const what = c.label || r?.name || '';
    return {
      id,
      title: what ? `${choiceName(c)} ${what}` : choiceName(c),
      short: choiceName(c),
      sub: [
        c.label && r ? r.name : '',
        c.items.length ? itemsLine(c.items) : '식당만 정함',
        moneyText(c.items),
      ]
        .filter(Boolean)
        .join(' · '),
      // 같은 식당으로 만든 선택지끼리도 구별되게 번호로 색을 돌린다.
      hue: HUES[(c.no - 1) % HUES.length],
      restId: c.restId,
    };
  }
  const r = room.restaurants.find((x) => x.id === id);
  if (!r) return undefined;
  const menus = (r.menus.some((m) => m.fav) ? r.menus.filter((m) => m.fav) : r.menus)
    .slice(0, 2)
    .map((m) => m.name)
    .join(' · ');
  return {
    id,
    title: r.name,
    short: r.name,
    sub: menus ? `${r.category} · ${menus}` : r.category,
    hue: CH[r.category] ?? 300,
    restId: r.id,
  };
}

/** 이 후보로 최종 확정하는 요청 */
export const finalAct = (room: RoomState, id: string): Action =>
  room.kind === 'doran' ? { type: 'choiceFinal', id } : { type: 'final', restId: id };
