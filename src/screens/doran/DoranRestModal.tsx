/**
 * 도란식사 식당 추가·정보 수정 — 이름 · 분류 · 전화 · 메모 · 메뉴(이름 · 가격, 가격을 비우면 '가격 미정').
 * 저장하면 방의 모두에게 바로 보이고, 각자 PC 의 식당 보관함에도 저장된다.
 * 지우면 그 식당으로 만든 선택지도 함께 지워진다.
 */
import { useState } from 'react';

import type { Restaurant } from '../../lib/types';
import { fmtPhone, priceFmt, uid } from '../../lib/util';
import { nameTaken } from '../../share/doran';
import { LIMITS, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, CATS, MUTED, MUTED_3, catBg, catDot, catFg } from '../../theme';
import { btnAccent, btnSoft, IconX, INPUT_BORDER } from '../together/parts';
import { fieldStyle, LABEL, Modal } from './ui';

type MenuDraft = { key: string; id?: string; name: string; price: string };

const toDraft = (r?: Restaurant) => ({
  name: r?.name ?? '',
  category: r?.category ?? '기타',
  phone: r?.phone ?? '',
  memo: r?.memo ?? '',
  menus: (r?.menus ?? []).map(
    (m): MenuDraft => ({
      key: m.id,
      id: m.id,
      name: m.name,
      price: m.price == null ? '' : priceFmt(String(m.price)),
    }),
  ),
});

export default function DoranRestModal({
  room,
  rest,
  onClose,
  onChoice,
}: {
  room: RoomState;
  /** 고칠 식당 (없으면 새 식당) */
  rest?: Restaurant;
  onClose: () => void;
  /** 이 식당으로 선택지 만들기 */
  onChoice?: (restId: string) => void;
}) {
  const act = useShare((s) => s.act);
  const [d, setD] = useState(() => {
    const x = toDraft(rest);
    return rest || x.menus.length ? x : { ...x, menus: [{ key: uid(), name: '', price: '' }] };
  });
  const [confirmDel, setConfirmDel] = useState(false);
  const choices = rest ? room.choices.filter((c) => c.restId === rest.id).length : 0;

  const setMenu = (i: number, p: Partial<MenuDraft>) =>
    setD((x) => ({ ...x, menus: x.menus.map((m, j) => (j === i ? { ...m, ...p } : m)) }));

  const save = () => {
    const name = d.name.trim();
    if (!name) {
      toast('식당 이름을 적어 주세요');
      return;
    }
    if (nameTaken(room.restaurants, name, rest?.id)) {
      toast(`‘${name}’ 식당은 이미 있어요`);
      return;
    }
    const menus = d.menus
      .filter((m) => m.name.trim())
      .map((m) => {
        const n = parseInt(m.price.replace(/[^\d]/g, ''), 10);
        return { id: m.id, name: m.name.trim(), price: Number.isNaN(n) || n <= 0 ? null : n };
      });
    act({
      type: 'dRestSave',
      rest: {
        id: rest?.id,
        name,
        category: d.category,
        phone: fmtPhone(d.phone),
        memo: d.memo.trim(),
        menus,
      },
    });
    toast(rest ? '고친 내용을 모두에게 알렸어요' : `‘${name}’ 식당을 올렸어요`);
    onClose();
  };

  const remove = () => {
    if (!rest) return;
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    act({ type: 'dRestRemove', restId: rest.id });
    onClose();
  };

  return (
    <Modal
      kicker={rest ? '식당 정보' : '식당 추가'}
      title={rest ? rest.name : '도란식사 식당 올리기'}
      sub="모두에게 같이 보이고, 각자 PC의 식당 보관함에도 저장돼요. 가격을 모르는 메뉴는 비워 두면 ‘가격 미정’이에요."
      width={540}
      onClose={onClose}
      foot={
        <>
          {rest ? (
            <button
              type="button"
              className="tg-danger"
              onClick={remove}
              onBlur={() => setConfirmDel(false)}
              title={choices ? `이 식당으로 만든 선택지 ${choices}개도 함께 지워져요` : undefined}
              style={{
                ...btnSoft(38, 13),
                color: 'oklch(0.5 0.17 25)',
                ...(confirmDel ? { background: 'oklch(0.55 0.19 25)', color: 'white', border: 'none' } : {}),
              }}
            >
              {confirmDel
                ? choices
                  ? `선택지 ${choices}개도 지워져요 · 지우기`
                  : '한 번 더 누르면 지워요'
                : '지우기'}
            </button>
          ) : null}
          {rest && onChoice ? (
            <button
              type="button"
              className="tg-soft"
              onClick={() => onChoice(rest.id)}
              style={btnSoft(38, 13)}
            >
              + 선택지 만들기
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          <button type="button" className="tg-soft" onClick={onClose} style={btnSoft(38, 14)}>
            취소
          </button>
          <button type="button" className="tg-accent" onClick={save} style={btnAccent(38, 16)}>
            {rest ? '저장' : '식당 올리기'}
          </button>
        </>
      }
    >
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
          autoFocus={!rest}
          value={d.name}
          maxLength={30}
          onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))}
          placeholder="예: 바다횟집 역삼점"
          style={fieldStyle('100%')}
        />
        <span style={LABEL}>분류</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATS.map((c) => {
            const on = d.category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setD((x) => ({ ...x, category: c }))}
                aria-pressed={on}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 14,
                  border: 'none',
                  background: on ? catBg(c) : 'oklch(0.965 0.004 75)',
                  boxShadow: on ? `inset 0 0 0 1.5px ${catDot(c)}` : `inset 0 0 0 1px ${INPUT_BORDER}`,
                  color: on ? catFg(c) : 'oklch(0.42 0.012 60)',
                  font: 'inherit',
                  fontSize: 12.5,
                  fontWeight: on ? 720 : 560,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: catDot(c) }} />
                {c}
              </button>
            );
          })}
        </div>
        <span style={LABEL}>전화</span>
        <input
          className="tg-input"
          value={d.phone}
          inputMode="tel"
          onChange={(e) => setD((x) => ({ ...x, phone: fmtPhone(e.target.value) }))}
          placeholder="02-555-1234"
          style={{ ...fieldStyle(180), fontVariantNumeric: 'tabular-nums' }}
        />
        <span style={LABEL}>메모</span>
        <input
          className="tg-input"
          value={d.memo}
          maxLength={LIMITS.memo}
          onChange={(e) => setD((x) => ({ ...x, memo: e.target.value }))}
          placeholder="예: 룸 있음 · 8명까지 · 콜키지 무료"
          style={fieldStyle('100%')}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={LABEL}>메뉴</span>
        <span style={{ fontSize: 12, color: MUTED }}>
          {d.menus.filter((m) => m.name.trim()).length}개 · 가격을 비우면 가격 미정
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {d.menus.map((m, i) => (
          <div
            key={m.key}
            style={{ display: 'flex', alignItems: 'center', gap: 6, animation: 'lp-in .2s ease-out' }}
          >
            <input
              className="tg-input"
              value={m.name}
              maxLength={LIMITS.menuName}
              onChange={(e) => setMenu(i, { name: e.target.value })}
              placeholder="메뉴 이름 (예: 모둠회 대)"
              style={{ ...fieldStyle(), flex: 1, height: 34 }}
            />
            <div style={{ position: 'relative', flex: 'none' }}>
              <input
                className="tg-input"
                value={m.price}
                inputMode="numeric"
                onChange={(e) => setMenu(i, { price: priceFmt(e.target.value) })}
                placeholder="가격 미정"
                style={{
                  ...fieldStyle(124),
                  height: 34,
                  paddingRight: 26,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 9,
                  top: 9,
                  fontSize: 12,
                  color: m.price ? 'oklch(0.42 0.012 60)' : MUTED_3,
                  pointerEvents: 'none',
                }}
              >
                원
              </span>
            </div>
            <div
              role="button"
              tabIndex={0}
              title="이 메뉴 빼기"
              className="tg-danger"
              onClick={() => setD((x) => ({ ...x, menus: x.menus.filter((_, j) => j !== i) }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setD((x) => ({ ...x, menus: x.menus.filter((_, j) => j !== i) }));
              }}
              style={{
                width: 28,
                height: 28,
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
        ))}
        {d.menus.length < LIMITS.menus ? (
          <button
            type="button"
            className="tg-dashed"
            onClick={() => setD((x) => ({ ...x, menus: [...x.menus, { key: uid(), name: '', price: '' }] }))}
            style={{
              height: 34,
              border: '1.5px dashed oklch(0.84 0.01 60)',
              borderRadius: 8,
              background: 'transparent',
              color: AC,
              font: 'inherit',
              fontSize: 13,
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            + 메뉴 추가
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
