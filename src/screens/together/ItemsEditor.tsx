/**
 * 메뉴 줄 편집 — 메뉴마다 −/+ 수량, 빼기, 아직 안 담은 식당 메뉴 칩, 목록에 없는 메뉴 직접 적기.
 * 예약 화면(ReserveModal)과 도란식사의 선택지 만들기(ChoiceModal)가 같이 쓴다.
 * 이름이 식당 메뉴와 같으면 그 메뉴로 맞추고(가격도 따라온다), 같은 메뉴는 수량을 더한다.
 */
import { useState } from 'react';

import type { Restaurant } from '../../lib/types';
import { priceFmt, won } from '../../lib/util';
import { cleanItems, itemKey } from '../../share/order';
import { LIMITS, type OrderItem } from '../../share/protocol';
import { toast } from '../../store/uiStore';
import { INK, MUTED_3 } from '../../theme';
import { Stepper } from './Board';
import { IconX, INPUT_BORDER, btnSoft } from './parts';

export default function ItemsEditor({
  rows,
  setRows,
  rest,
  maxQty,
  customPrice = false,
  emptyText = '담은 메뉴가 없어요',
}: {
  rows: OrderItem[];
  setRows: (fn: (rs: OrderItem[]) => OrderItem[]) => void;
  rest: Restaurant;
  maxQty: number;
  /** 직접 적는 메뉴에 가격도 받는다 (비우면 가격 미정) */
  customPrice?: boolean;
  emptyText?: string;
}) {
  const [custom, setCustom] = useState('');
  const [customCost, setCustomCost] = useState('');
  const keys = new Set(rows.map(itemKey));
  const addable = rest.menus.filter((m) => !keys.has(m.id));

  const setQty = (k: string, q: number) =>
    setRows((rs) => rs.map((it) => (itemKey(it) === k ? { ...it, qty: q } : it)));
  const remove = (k: string) => setRows((rs) => rs.filter((it) => itemKey(it) !== k));
  const add = (it: OrderItem) =>
    setRows((rs) => {
      if (rs.length >= LIMITS.orderItems) {
        toast(`메뉴는 ${LIMITS.orderItems}가지까지 담을 수 있어요`);
        return rs;
      }
      // 이름이 식당 메뉴와 같으면 그 메뉴로 맞춘다 (가격도 따라온다).
      const [clean] = cleanItems([it], rest, maxQty);
      if (!clean) return rs;
      const k = itemKey(clean);
      return rs.some((x) => itemKey(x) === k)
        ? rs.map((x) => (itemKey(x) === k ? { ...x, qty: Math.min(maxQty, x.qty + 1) } : x))
        : [...rs, clean];
    });
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    const p = parseInt(customCost.replace(/[^\d]/g, ''), 10);
    add({ menuId: null, name, price: customPrice && p > 0 ? p : null, qty: 1 });
    setCustom('');
    setCustomCost('');
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((it) => {
          const k = itemKey(it);
          return (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                borderBottom: '1px solid oklch(0.95 0.005 75)',
                opacity: it.qty ? 1 : 0.45,
                transition: 'opacity .2s',
                animation: 'lp-in .25s ease-out',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  overflowWrap: 'anywhere',
                }}
              >
                {it.name}
                {it.menuId ? null : (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: MUTED_3, marginLeft: 6 }}>
                    직접 입력
                  </span>
                )}
              </span>
              <span
                style={{
                  width: 76,
                  textAlign: 'right',
                  fontSize: 12.5,
                  color: it.price ? 'oklch(0.42 0.012 60)' : MUTED_3,
                  fontVariantNumeric: 'tabular-nums',
                  flex: 'none',
                }}
              >
                {it.price ? won(it.price * Math.max(1, it.qty)) : '가격 미정'}
              </span>
              <Stepper value={it.qty} min={0} max={maxQty} onChange={(q) => setQty(k, q)} h={30} w={26} />
              <div
                role="button"
                tabIndex={0}
                title="빼기"
                className="tg-danger"
                onClick={() => remove(k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') remove(k);
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'oklch(0.5 0.17 25)',
                  flex: 'none',
                }}
              >
                <IconX size={12} />
              </div>
            </div>
          );
        })}
        {!rows.length ? (
          <div style={{ fontSize: 12.5, color: MUTED_3, padding: '8px 0' }}>{emptyText}</div>
        ) : null}
      </div>

      {addable.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {addable.map((m) => (
            <button
              key={m.id}
              type="button"
              className="tg-soft"
              onClick={() => add({ menuId: m.id, name: m.name, price: m.price, qty: 1 })}
              style={{ ...btnSoft(28, 10), fontSize: 12.5, fontWeight: 600 }}
            >
              + {m.name}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6 }}>
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
        {customPrice ? (
          <input
            className="tg-input"
            value={customCost}
            inputMode="numeric"
            onChange={(e) => setCustomCost(priceFmt(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="가격 (모르면 비움)"
            style={{
              width: 118,
              height: 34,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 8,
              padding: '0 10px',
              font: 'inherit',
              fontSize: 13,
              outline: 'none',
              color: INK,
              background: 'white',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        ) : null}
        <button
          type="button"
          className={custom.trim() ? 'tg-soft' : ''}
          onClick={addCustom}
          style={{ ...btnSoft(34, 12), opacity: custom.trim() ? 1 : 0.5 }}
        >
          추가
        </button>
      </div>
    </>
  );
}
