/**
 * 선택지 만들기·고치기 — 식당을 고르고(새로 만들 때), 메뉴마다 −/+ 로 수량을 담는다.
 * 메뉴를 하나도 담지 않으면 '식당만' 정한 선택지가 된다. 같은 식당으로 메뉴 구성을 달리해 여러 개 만들 수 있다.
 * 담는 동안 합계와 총사용금액 비교가 바로 보인다 (가격 미정 메뉴가 끼면 '+ α').
 */
import { useEffect, useState } from 'react';

import { budgetFit, choiceName, choiceOf, moneyText, priceRange, sameItems } from '../../share/doran';
import { cleanItems } from '../../share/order';
import { LIMITS, type OrderItem, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, CH, INK, MUTED, MUTED_3 } from '../../theme';
import ItemsEditor from '../together/ItemsEditor';
import { btnAccent, btnSoft, INPUT_BORDER } from '../together/parts';
import { FitBadge, fieldStyle, LABEL, Modal } from './ui';

export default function ChoiceModal({
  room,
  restId: firstRest,
  editId,
  onClose,
}: {
  room: RoomState;
  /** 새로 만들 때 처음 고른 식당 */
  restId?: string;
  /** 고칠 선택지 */
  editId?: string;
  onClose: () => void;
}) {
  const act = useShare((s) => s.act);
  const editing = editId ? choiceOf(room, editId) : undefined;
  const [restId, setRestId] = useState(editing?.restId ?? firstRest ?? room.restaurants[0]?.id ?? '');
  const [rows, setRows] = useState<OrderItem[]>(() => editing?.items ?? []);
  const [label, setLabel] = useState(editing?.label ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const r = room.restaurants.find((x) => x.id === restId);

  // 고치던 선택지나 방의 식당이 그사이 모두 지워졌으면 닫는다.
  const gone = (!!editId && !editing) || room.restaurants.length === 0;
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  if (gone) return null;

  const live = rows.filter((it) => it.qty > 0);
  const items = r ? cleanItems(live, r, LIMITS.reserveQty) : [];
  const fit = budgetFit(items, room.budget);
  const twin = r
    ? room.choices.find((c) => c.id !== editId && c.restId === r.id && sameItems(c.items, items))
    : undefined;

  const pickRest = (id: string) => {
    if (id === restId) return;
    setRestId(id);
    // 다른 식당 메뉴는 그 식당에 없으니 비운다.
    setRows([]);
  };

  const submit = () => {
    if (!r) return;
    if (twin) {
      toast(`${choiceName(twin)}과 같은 구성이에요`);
      return;
    }
    if (editing) act({ type: 'choiceEdit', id: editing.id, items, label: label.trim(), note: note.trim() });
    else act({ type: 'choiceAdd', restId: r.id, items, label: label.trim(), note: note.trim() });
    toast(editing ? '고친 선택지를 모두에게 알렸어요' : '선택지를 만들었어요');
    onClose();
  };

  return (
    <Modal
      kicker={editing ? `${choiceName(editing)} 고치기` : '선택지 만들기'}
      title={r ? r.name : '식당을 골라 주세요'}
      sub={
        editing
          ? '메뉴 구성·이름·메모를 고칠 수 있어요 (식당은 그대로예요).'
          : '메뉴를 담으면 그 구성으로, 하나도 안 담으면 식당만 정한 선택지가 돼요.'
      }
      width={540}
      onClose={onClose}
      foot={
        <>
          <div
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 760,
                fontVariantNumeric: 'tabular-nums',
                color: items.length ? INK : MUTED_3,
              }}
            >
              {items.length ? `합계 ${moneyText(items)}` : '메뉴 미정 · 식당만'}
            </span>
            <FitBadge fit={fit} />
          </div>
          <button type="button" className="tg-soft" onClick={onClose} style={btnSoft(40, 14)}>
            취소
          </button>
          <button
            type="button"
            className={r && !twin ? 'tg-accent' : ''}
            disabled={!r || !!twin}
            onClick={submit}
            title={twin ? `${choiceName(twin)}과 같은 구성이에요` : undefined}
            style={{ ...btnAccent(40, 16), opacity: r && !twin ? 1 : 0.45 }}
          >
            {editing ? '고친 내용 알리기' : items.length ? '선택지로 올리기' : '식당만으로 올리기'}
          </button>
        </>
      }
    >
      {!editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL}>식당</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {room.restaurants.map((x) => {
              const on = x.id === restId;
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickRest(x.id)}
                  style={{
                    height: 30,
                    padding: '0 11px',
                    borderRadius: 15,
                    border: 'none',
                    background: on ? 'oklch(0.965 0.025 50)' : 'white',
                    boxShadow: on ? `inset 0 0 0 1.5px ${AC}` : `inset 0 0 0 1px ${INPUT_BORDER}`,
                    color: on ? 'oklch(0.4 0.13 40)' : 'oklch(0.38 0.012 60)',
                    font: 'inherit',
                    fontSize: 12.5,
                    fontWeight: on ? 720 : 580,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: `oklch(0.62 0.15 ${CH[x.category] ?? 300})`,
                    }}
                  />
                  {x.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {r ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={LABEL}>메뉴 구성</span>
            <span style={{ fontSize: 12, color: MUTED }}>
              {r.menus.length
                ? `메뉴 ${r.menus.length}개 · ${priceRange(r) || '가격 미정'}`
                : '등록된 메뉴가 없어요 · 직접 적어도 돼요'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ItemsEditor
              rows={rows}
              setRows={setRows}
              rest={r}
              maxQty={LIMITS.reserveQty}
              customPrice
              emptyText="아직 담은 메뉴가 없어요 — 아래에서 메뉴를 눌러 담아요"
            />
          </div>
          {twin ? (
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 650,
                padding: '8px 11px',
                borderRadius: 8,
                background: 'oklch(0.97 0.04 85)',
                color: 'oklch(0.45 0.1 70)',
              }}
            >
              {choiceName(twin)}과 같은 구성이에요 · 메뉴나 수량을 바꿔 주세요
            </div>
          ) : null}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '64px minmax(0,1fr)',
              gap: '10px 12px',
              alignItems: 'center',
            }}
          >
            <span style={LABEL}>이름</span>
            <input
              className="tg-input"
              value={label}
              maxLength={LIMITS.choiceLabel}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="선택 · 예: 회 코스 / 고기 위주"
              style={fieldStyle('100%')}
            />
            <span style={LABEL}>메모</span>
            <input
              className="tg-input"
              value={note}
              maxLength={LIMITS.choiceNote}
              onChange={(e) => setNote(e.target.value)}
              placeholder="선택 · 예: 2차 없이 여기서 끝"
              style={fieldStyle('100%')}
            />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: MUTED }}>먼저 왼쪽에서 식당을 올려 주세요.</div>
      )}
    </Modal>
  );
}
