/**
 * 메뉴 고르기 · 예약 — 최종 확정되면 가운데 열의 보드 자리에 뜬다 (확정 뒤 보드는 잠겨 있다).
 *
 *   ┌ 확정된 식당 (전화 · 식당 정보 · 다시 고르기)
 *   │ 예약하는 중 / 예약 완료 카드
 *   │ 내 메뉴 — 메뉴마다 −/+ (다른 사람이 고른 것도 보인다), 직접 입력
 *   │ 모두의 메뉴 — 사람별 · 합계
 *   └ 주문 내용 복사 · 예약하기
 * 각자 고른 메뉴는 모두에게 같이 보이고, 예약은 한 사람이 식당에 한 뒤 '예약 완료'로 모두에게 알린다.
 */
import { useEffect, useRef, useState } from 'react';

import { copyText } from '../../lib/ipc';
import type { Restaurant } from '../../lib/types';
import { hhmm, won } from '../../lib/util';
import {
  cleanItems,
  diffItems,
  itemKey,
  itemsSig,
  itemsText,
  picksText,
  reservationText,
  sumItems,
  totalText,
} from '../../share/order';
import { LIMITS, type Member, type OrderItem, type Reservation, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, AINK, CH, INK, MUTED, MUTED_3, OK_BG, OK_FG, SOFT } from '../../theme';
import { Stepper } from './Board';
import {
  Avatar,
  AvatarStack,
  IconCheck,
  IconCopy,
  IconInfo,
  IconPhone,
  INPUT_BORDER,
  Spinner,
  btnAccent,
  btnSoft,
  whoShort,
} from './parts';

const NONE: OrderItem[] = [];
/** 보낸 내 메뉴가 이 안에 돌아오지 않으면 방 상태를 따른다 */
const PICK_SETTLE_MS = 1500;

const AMBER_BG = 'oklch(0.97 0.04 85)';
const AMBER_FG = 'oklch(0.45 0.1 70)';

export default function OrderPanel({
  room,
  me,
  host,
  onInfo,
  onReserve,
}: {
  room: RoomState;
  me: string;
  host: boolean;
  onInfo: (id: string) => void;
  /** 예약 화면 열기 */
  onReserve: () => void;
}) {
  const act = useShare((s) => s.act);
  const f = room.final!;
  const r = room.restaurants.find((x) => x.id === f.restId);
  const v = room.reservation;

  // ---------------------------------------------------------------- 내 메뉴 (로컬 초안)
  // 스테퍼를 빠르게 눌러도 숫자가 꼬이지 않게 내 메뉴는 여기서 들고 있다가 통째로 보낸다.
  // 보낸 값이 방 상태로 돌아오면 다시 방 상태를 따른다 (재확정으로 비워지는 경우 등).
  const roomMine = room.picks[me]?.items ?? NONE;
  const roomSig = itemsSig(roomMine);
  const [mine, setMine] = useState<OrderItem[]>(roomMine);
  const sent = useRef<string | null>(null);
  const latest = useRef(roomMine);
  latest.current = roomMine;
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (sent.current === null || sent.current === roomSig) {
      sent.current = null;
      setMine(latest.current);
    }
  }, [roomSig]);
  useEffect(() => () => clearTimeout(settle.current), []);

  const [custom, setCustom] = useState('');
  /** '다른 사람이 예약하는 중인데 그래도 할까요?' 를 묻고 있는 예약 중 표시 (그 사람이 연 시각) */
  const [confirmFor, setConfirmFor] = useState<number | null>(null);

  if (!r) return null;

  const commit = (next: OrderItem[]) => {
    const clean = cleanItems(next, r, LIMITS.pickQty);
    setMine(clean);
    sent.current = itemsSig(clean);
    act({ type: 'pickMenu', items: clean });
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (sent.current === null) return;
      sent.current = null;
      setMine(latest.current);
    }, PICK_SETTLE_MS);
  };

  const qtyOf = (k: string) => mine.find((i) => itemKey(i) === k)?.qty ?? 0;
  const setQty = (base: OrderItem, q: number) => {
    const k = itemKey(base);
    commit(
      mine.some((i) => itemKey(i) === k)
        ? mine.map((i) => (itemKey(i) === k ? { ...i, qty: q } : i))
        : [...mine, { ...base, qty: q }],
    );
  };
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    if (mine.length >= LIMITS.orderItems && !mine.some((i) => i.name === name)) {
      toast(`메뉴는 ${LIMITS.orderItems}가지까지 고를 수 있어요`);
      return;
    }
    commit([...mine, { menuId: null, name, price: null, qty: 1 }]);
    setCustom('');
  };

  // ---------------------------------------------------------------- 모두의 메뉴
  // 지금 있는 사람 + 나갔어도 메뉴를 골라 둔 사람. 호스트, 나, 들어온 순서.
  const people = room.members
    .filter((m) => m.online || m.id === me || room.picks[m.id]?.items.length)
    .sort(
      (a, b) =>
        Number(b.host) - Number(a.host) ||
        Number(b.id === me) - Number(a.id === me) ||
        a.joinedAt - b.joinedAt,
    );
  const itemsOf = (id: string) => (id === me ? mine : (room.picks[id]?.items ?? NONE));
  const all = sumItems(
    people.map((m) => itemsOf(m.id)),
    r,
  );
  const picked = people.filter((m) => itemsOf(m.id).length).length;
  /** 메뉴별로 누가 몇 개 골랐는지 (나는 빼고) */
  const others = new Map<string, { m: Member; qty: number }[]>();
  for (const m of people) {
    if (m.id === me) continue;
    for (const it of itemsOf(m.id)) {
      const k = itemKey(it);
      others.set(k, [...(others.get(k) ?? []), { m, qty: it.qty }]);
    }
  }
  // 식당 메뉴에 없는 줄 (누군가 직접 적었거나, 고른 뒤에 식당 정보에서 지워진 메뉴) — 모두에게 보인다.
  const menuIds = new Set(r.menus.map((m) => m.id));
  const extras = all.filter((it) => !it.menuId || !menuIds.has(it.menuId));

  const busy = room.reserving && room.reserving.by !== me ? room.reserving : null;
  const confirmBusy = !!busy && confirmFor === busy.at;
  const canEdit = !!v && (v.by === me || host);

  const openReserve = () => {
    if (busy && !confirmBusy) {
      setConfirmFor(busy.at);
      return;
    }
    setConfirmFor(null);
    onReserve();
  };

  const hue = CH[r.category] ?? 300;
  const byText = `${f.by === me ? '내가' : `${whoShort(room, me, f.by)}님이`} ${hhmm(f.at)}에 확정`;

  return (
    <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 18px 18px' }}>
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            animation: 'lp-rise .5s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {/* ------------------------------------------------ 확정된 식당 */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pill bg={`oklch(0.95 0.035 ${hue})`} fg={`oklch(0.42 0.11 ${hue})`}>
                    {r.category}
                  </Pill>
                  <Pill bg={OK_BG} fg={OK_FG}>
                    <IconCheck size={11} stroke={3} />
                    오늘 점심
                  </Pill>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 12.5, color: MUTED }}>{byText} · 이제 각자 메뉴를 골라요</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                <button
                  type="button"
                  className="tg-soft"
                  onClick={() => onInfo(r.id)}
                  style={btnSoft(32, 11)}
                >
                  <IconInfo size={14} />
                  식당 정보
                </button>
                <button
                  type="button"
                  className={v ? '' : 'tg-soft'}
                  title={v ? '예약을 취소한 뒤에 다시 고를 수 있어요' : '확정을 풀고 모두 다시 골라요'}
                  onClick={() =>
                    v ? toast('예약을 취소한 뒤에 다시 고를 수 있어요') : act({ type: 'unfinal' })
                  }
                  style={{ ...btnSoft(32, 11), opacity: v ? 0.5 : 1, cursor: v ? 'default' : 'pointer' }}
                >
                  다시 고르기
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 9,
                background: 'oklch(0.975 0.004 75)',
              }}
            >
              <IconPhone size={15} color={AC} />
              <span
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: 750,
                  fontVariantNumeric: 'tabular-nums',
                  color: r.phone ? INK : MUTED_3,
                }}
              >
                {r.phone || '번호 없음'}
              </span>
              {r.phone ? (
                <button
                  type="button"
                  className="tg-soft"
                  onClick={() => {
                    void copyText(r.phone);
                    toast('전화번호를 복사했어요');
                  }}
                  style={btnSoft(28, 10)}
                >
                  번호 복사
                </button>
              ) : null}
            </div>
          </Card>

          {/* ------------------------------------------------ 예약하는 중 · 예약 완료 */}
          {busy ? (
            <div
              key={busy.by}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '10px 14px',
                borderRadius: 10,
                background: AMBER_BG,
                color: AMBER_FG,
                fontSize: 13,
                fontWeight: 650,
                animation: 'lp-in .3s ease-out',
              }}
            >
              <Spinner size={13} />
              {whoShort(room, me, busy.by)}님이 {v ? '예약 내용을 고치는' : '예약하는'} 중이에요
              <span style={{ fontWeight: 500, opacity: 0.85 }}>· 전화 중일 수 있어요</span>
            </div>
          ) : null}
          {v ? (
            <ReservationCard
              room={room}
              me={me}
              v={v}
              r={r}
              all={all}
              canEdit={canEdit}
              onEdit={openReserve}
            />
          ) : null}

          {/* ------------------------------------------------ 내 메뉴 */}
          <Card>
            <SectionHead
              title="내 메뉴"
              sub={mine.length ? itemsText(mine) : '먹을 메뉴를 골라 주세요 · 여러 개 골라도 돼요'}
            />
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
              {r.menus.map((m) => {
                const base: OrderItem = { menuId: m.id, name: m.name, price: m.price, qty: 0 };
                return (
                  <MenuRow
                    key={m.id}
                    item={base}
                    qty={qtyOf(m.id)}
                    who={others.get(m.id) ?? []}
                    onQty={(q) => setQty(base, q)}
                  />
                );
              })}
              {extras.map((it) => {
                const k = itemKey(it);
                return (
                  <MenuRow
                    key={k}
                    item={it}
                    custom
                    qty={qtyOf(k)}
                    who={others.get(k) ?? []}
                    onQty={(q) => setQty({ ...it, qty: 0 }, q)}
                  />
                );
              })}
              {!r.menus.length && !extras.length ? (
                <div style={{ fontSize: 12.5, color: MUTED, padding: '10px 0' }}>
                  등록된 메뉴가 없어요 · 아래에 직접 적거나 ‘식당 정보’에서 메뉴를 추가해 주세요
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input
                className="tg-input"
                value={custom}
                maxLength={LIMITS.menuName}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="목록에 없는 메뉴 직접 적기"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 34,
                  border: `1px solid ${INPUT_BORDER}`,
                  borderRadius: 8,
                  padding: '0 10px',
                  font: 'inherit',
                  fontSize: 13,
                  outline: 'none',
                  color: INK,
                  background: 'white',
                }}
              />
              <button
                type="button"
                className={custom.trim() ? 'tg-soft' : ''}
                onClick={addCustom}
                style={{ ...btnSoft(34, 12), opacity: custom.trim() ? 1 : 0.5 }}
              >
                추가
              </button>
            </div>
          </Card>

          {/* ------------------------------------------------ 모두의 메뉴 */}
          <Card>
            <SectionHead
              title="모두의 메뉴"
              sub={`${picked}/${people.length}명 골랐어요`}
              right={
                <button
                  type="button"
                  className="tg-soft"
                  onClick={() => {
                    void copyText(
                      picksText({ ...room, picks: { ...room.picks, [me]: { items: mine, at: 0 } } }),
                    );
                    toast('각자 고른 메뉴를 복사했어요');
                  }}
                  style={btnSoft(28, 10)}
                >
                  <IconCopy size={13} />
                  복사
                </button>
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
              {people.map((m) => {
                const items = itemsOf(m.id);
                const after = !!v && itemsSig(items) !== itemsSig(v.basis[m.id] ?? NONE);
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7px 0',
                      borderBottom: '1px solid oklch(0.95 0.005 75)',
                      opacity: m.online ? 1 : 0.6,
                    }}
                  >
                    <Avatar m={m} size={24} />
                    <span style={{ width: 72, flex: 'none', fontSize: 13, fontWeight: 650 }}>
                      {m.id === me ? '나' : whoShort(room, me, m.id)}
                      {m.online ? '' : <span style={{ fontWeight: 500, color: MUTED_3 }}> · 나감</span>}
                    </span>
                    <span
                      key={itemsSig(items)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        color: items.length ? INK : MUTED_3,
                        overflowWrap: 'anywhere',
                        animation: 'lp-in .25s ease-out',
                      }}
                    >
                      {items.length ? itemsText(items) : '고르는 중…'}
                    </span>
                    {after ? (
                      <Pill bg={AMBER_BG} fg={AMBER_FG}>
                        예약 뒤 바꿈
                      </Pill>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 9,
                background: SOFT,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 750, color: AINK, flex: 'none' }}>합계</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                {all.length ? itemsText(all) : '아직 고른 메뉴가 없어요'}
              </span>
              {all.length ? (
                <span
                  style={{
                    flex: 'none',
                    fontSize: 13,
                    fontWeight: 750,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {totalText(all)}
                </span>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------ 아래: 예약하기 */}
      <div
        style={{
          flex: 'none',
          borderTop: '1px solid oklch(0.91 0.006 75)',
          background: 'white',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {confirmBusy && busy ? (
          <>
            <span style={{ flex: 1, minWidth: 200, fontSize: 13, fontWeight: 650, color: AMBER_FG }}>
              {whoShort(room, me, busy.by)}님이 예약하는 중이에요. 그래도 할까요?
            </span>
            <button type="button" className="tg-soft" onClick={() => setConfirmFor(null)} style={btnSoft(38)}>
              취소
            </button>
            <button type="button" className="tg-accent" onClick={openReserve} style={btnAccent(38)}>
              그래도 예약하기
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>
              {v
                ? canEdit
                  ? '예약을 다시 했다면 ‘예약 수정’으로 모두에게 알려 주세요'
                  : `예약은 ${whoShort(room, me, v.by)}님이 했어요 · 고치는 건 예약한 사람과 호스트만 할 수 있어요`
                : '식당에 예약한 사람이 ‘예약하기’에서 예약한 메뉴를 적고 모두에게 알려요'}
            </span>
            {!v ? (
              <button type="button" className="tg-accent" onClick={openReserve} style={btnAccent(38)}>
                <IconPhone size={15} />
                예약하기
              </button>
            ) : canEdit ? (
              <button type="button" className="tg-soft" onClick={openReserve} style={btnSoft(38)}>
                예약 수정
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 예약 완료 카드

function ReservationCard({
  room,
  me,
  v,
  r,
  all,
  canEdit,
  onEdit,
}: {
  room: RoomState;
  me: string;
  v: Reservation;
  r: Restaurant;
  /** 지금 모두가 고른 메뉴의 합 */
  all: OrderItem[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const act = useShare((s) => s.act);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const diff = diffItems(all, sumItems(Object.values(v.basis), r));
  return (
    <div
      key={v.at}
      style={{
        borderRadius: 12,
        background: 'white',
        boxShadow: `0 0 0 1.5px oklch(0.8 0.08 150), 0 8px 24px oklch(0.55 0.13 150 / .12)`,
        overflow: 'hidden',
        animation: 'lp-pop .45s cubic-bezier(.2,.9,.3,1.3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: OK_BG,
          color: OK_FG,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'oklch(0.55 0.13 150)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <IconCheck size={14} stroke={3} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 780 }}>
            예약 완료
            {v.editedBy ? (
              <span style={{ fontWeight: 600, opacity: 0.8 }}>
                {' '}
                · {v.editedBy === v.by ? '수정됨' : `${whoShort(room, me, v.editedBy)}님이 고침`}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {v.by === me ? '내가' : `${whoShort(room, me, v.by)}님이`} {hhmm(v.at)}에 {r.name}에 예약했어요
          </div>
        </div>
        <button
          type="button"
          className="tg-soft"
          onClick={() => {
            void copyText(reservationText(room));
            toast('예약 내용을 복사했어요');
          }}
          style={btnSoft(28, 10)}
        >
          <IconCopy size={13} />
          내용 복사
        </button>
      </div>
      <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ItemTable items={v.items} />
        {v.note ? <NoteBox note={v.note} /> : null}
        {diff ? (
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              padding: '8px 11px',
              borderRadius: 8,
              background: AMBER_BG,
              color: AMBER_FG,
              fontWeight: 600,
            }}
          >
            예약 뒤에 바뀐 메뉴가 있어요 · {diff}
            {canEdit ? (
              <span style={{ fontWeight: 500 }}> — 다시 예약했다면 ‘예약 수정’으로 알려 주세요</span>
            ) : null}
          </div>
        ) : null}
        {canEdit ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
            {confirmCancel ? (
              <>
                <span
                  style={{ fontSize: 12.5, color: 'oklch(0.5 0.17 25)', fontWeight: 600, marginRight: 4 }}
                >
                  모두에게서 예약이 지워져요
                </span>
                <button
                  type="button"
                  className="tg-soft"
                  onClick={() => setConfirmCancel(false)}
                  style={btnSoft(30, 11)}
                >
                  아니요
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmCancel(false);
                    act({ type: 'unreserve' });
                  }}
                  style={{
                    ...btnSoft(30, 11),
                    border: 'none',
                    background: 'oklch(0.55 0.19 25)',
                    color: 'white',
                  }}
                >
                  예약 취소
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="tg-soft"
                  onClick={() => setConfirmCancel(true)}
                  style={{ ...btnSoft(30, 11), color: 'oklch(0.5 0.17 25)' }}
                >
                  예약 취소
                </button>
                <button type="button" className="tg-soft" onClick={onEdit} style={btnSoft(30, 11)}>
                  예약 수정
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 조각

/** 메뉴 × 수량 · 금액 표와 합계 (예약 카드 · 예약 알림에서 같이 쓴다) */
export function ItemTable({ items }: { items: OrderItem[] }) {
  if (!items.length)
    return <div style={{ fontSize: 12.5, color: MUTED, padding: '4px 0' }}>메뉴는 따로 정하지 않았어요</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((it) => (
        <div
          key={itemKey(it)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 0',
            borderBottom: '1px solid oklch(0.95 0.005 75)',
            fontSize: 13.5,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{it.name}</span>
          <span
            style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'right' }}
          >
            × {it.qty}
          </span>
          <span
            style={{
              width: 84,
              textAlign: 'right',
              color: it.price ? 'oklch(0.42 0.012 60)' : MUTED_3,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 12.5,
            }}
          >
            {it.price ? won(it.price * it.qty) : '가격 미정'}
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 8,
          fontSize: 13,
          fontWeight: 750,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>합계</span>
        <span>{totalText(items)}</span>
      </div>
    </div>
  );
}

export function NoteBox({ note }: { note: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.55,
        padding: '9px 12px',
        borderRadius: 8,
        background: SOFT,
        color: 'oklch(0.38 0.06 50)',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      }}
    >
      <span style={{ fontWeight: 750, marginRight: 6 }}>특이사항</span>
      {note}
    </div>
  );
}

function MenuRow({
  item,
  qty,
  who,
  custom,
  onQty,
}: {
  item: OrderItem;
  qty: number;
  who: { m: Member; qty: number }[];
  custom?: boolean;
  onQty: (q: number) => void;
}) {
  const n = who.reduce((a, w) => a + w.qty, 0);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 8px',
        margin: '0 -8px',
        borderRadius: 8,
        background: qty ? SOFT : 'transparent',
        transition: 'background .25s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: qty ? 700 : 500, overflowWrap: 'anywhere' }}>
          {item.name}
        </span>
        {custom ? (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: MUTED_3, flex: 'none' }}>직접 입력</span>
        ) : null}
      </div>
      {who.length ? (
        <span
          title={who.map((w) => `${w.m.name} ${w.qty}`).join(' · ')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}
        >
          <AvatarStack members={who.map((w) => w.m)} size={20} max={4} />
          <span style={{ fontSize: 11.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        </span>
      ) : null}
      <span
        style={{
          width: 72,
          textAlign: 'right',
          fontSize: 12.5,
          color: item.price ? 'oklch(0.42 0.012 60)' : MUTED_3,
          fontVariantNumeric: 'tabular-nums',
          flex: 'none',
        }}
      >
        {item.price ? won(item.price) : '가격 미정'}
      </span>
      <Stepper value={qty} min={0} max={LIMITS.pickQty} onChange={onQty} h={30} w={26} />
    </div>
  );
}

function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 760 }}>{title}</div>
        {sub ? (
          <div
            style={{
              fontSize: 12,
              color: MUTED,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 0 0 1px oklch(0.91 0.006 75), 0 1px 3px oklch(0.5 0.02 60 / .05)',
      }}
    >
      {children}
    </div>
  );
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        height: 22,
        padding: '0 8px',
        borderRadius: 11,
        background: bg,
        color: fg,
        fontSize: 11.5,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
