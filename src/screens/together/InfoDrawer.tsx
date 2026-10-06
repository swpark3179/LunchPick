/**
 * 식당 세부정보 — 내 화면에서만 열린다 (공유하지 않음).
 * 잘못된 정보는 여기서 고칠 수 있고, 저장하면 호스트의 식당 목록에 반영돼 모두에게 보인다.
 */
import { useEffect, useRef, useState } from 'react';

import { copyText } from '../../lib/ipc';
import type { Menu, Restaurant } from '../../lib/types';
import { fmtPhone, priceFmt, uid, won } from '../../lib/util';
import { LIMITS } from '../../share/protocol';
import { useShowPrices } from '../../store/settingsStore';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AINK, CATS, DANGER, HAIRLINE, INK, MUTED, MUTED_2, STAR, catBg, catDot, catFg } from '../../theme';
import { IconCopy, IconEdit, IconPhone, IconTrash, IconX, INPUT_BORDER, btn } from './parts';

type MenuDraft = { id: string; name: string; price: string; fav: boolean };
type Draft = { category: string; phone: string; memo: string; menus: MenuDraft[] };

const toDraft = (r: Restaurant): Draft => ({
  category: r.category,
  phone: r.phone,
  memo: r.memo,
  menus: r.menus.map((m) => ({
    id: m.id,
    name: m.name,
    price: m.price ? priceFmt(String(m.price)) : '',
    fav: m.fav,
  })),
});

const field: React.CSSProperties = {
  height: 34,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 7,
  padding: '0 10px',
  font: 'inherit',
  fontSize: 13.5,
  outline: 'none',
  color: INK,
  background: 'white',
  minWidth: 0,
};

export default function InfoDrawer({
  rest: live,
  disliked,
  onClose,
}: {
  rest: Restaurant | null;
  disliked: boolean;
  onClose: () => void;
}) {
  // 닫히는 동안 내용이 사라지지 않도록 마지막 식당을 붙잡아 둔다.
  const lastRef = useRef<Restaurant | null>(null);
  if (live) lastRef.current = live;
  const rest = live ?? lastRef.current;
  const act = useShare((s) => s.act);
  const role = useShare((s) => s.role);
  const showPrices = useShowPrices();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [err, setErr] = useState('');

  // 다른 식당을 열면 편집을 닫는다.
  useEffect(() => {
    setEdit(null);
    setErr('');
  }, [live?.id]);

  const open = !!live;

  const save = () => {
    if (!rest || !edit) return;
    const digits = edit.phone.replace(/\D/g, '');
    if (digits && digits.length < 9) {
      setErr('전화번호를 정확히 입력해 주세요.');
      return;
    }
    const menus: Menu[] = edit.menus
      .map((m) => ({
        id: m.id,
        name: m.name.trim(),
        price: m.price.replace(/\D/g, '') ? Number(m.price.replace(/\D/g, '')) : null,
        fav: m.fav,
      }))
      .filter((m) => m.name);
    act({
      type: 'editRest',
      rest: {
        id: rest.id,
        category: edit.category,
        phone: fmtPhone(edit.phone),
        memo: edit.memo.trim(),
        menus,
      },
    });
    setEdit(null);
    setErr('');
    toast(role === 'host' ? '식당 정보를 고쳤어요' : '고친 내용을 호스트에게 보냈어요');
  };

  const setMenu = (i: number, p: Partial<MenuDraft>) =>
    setEdit((d) => (d ? { ...d, menus: d.menus.map((m, j) => (j === i ? { ...m, ...p } : m)) } : d));

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 6,
          background: 'oklch(0.25 0.012 60 / .16)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />
      <div
        role="dialog"
        aria-label="식당 정보"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          maxWidth: '100%',
          zIndex: 7,
          background: 'white',
          borderLeft: `1px solid ${HAIRLINE}`,
          boxShadow: '-14px 0 36px oklch(0.4 0.02 60 / .12)',
          transform: open ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform .32s cubic-bezier(.2,.8,.2,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {rest ? (
          <>
            <div
              style={{
                padding: '16px 18px 14px',
                borderBottom: `1px solid ${HAIRLINE}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 24,
                    padding: '0 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 650,
                    background: catBg(rest.category),
                    color: catFg(rest.category),
                  }}
                >
                  <span
                    style={{ width: 7, height: 7, borderRadius: '50%', background: catDot(rest.category) }}
                  />
                  {rest.category}
                </span>
                {disliked ? (
                  <span style={{ fontSize: 12, color: DANGER, fontWeight: 650 }}>가기 싫은 곳으로 빠짐</span>
                ) : null}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: MUTED_2 }}>나만 보는 화면</span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={onClose}
                  title="닫기"
                  style={{ ...btn('ghost', 28), width: 28, padding: 0 }}
                >
                  <IconX size={15} />
                </button>
              </div>
              <div style={{ fontSize: 22, fontWeight: 780, letterSpacing: '-0.02em' }}>{rest.name}</div>
            </div>

            {!edit ? (
              <div
                key="view"
                className="lp-fade-up"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  padding: '14px 18px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'oklch(0.975 0.004 75)',
                    borderRadius: 9,
                    padding: '10px 12px',
                  }}
                >
                  <IconPhone size={16} color={MUTED} />
                  <span
                    style={{ flex: 1, fontSize: 17, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {rest.phone || (
                      <span style={{ color: MUTED_2, fontSize: 13.5, fontWeight: 500 }}>번호 없음</span>
                    )}
                  </span>
                  {rest.phone ? (
                    <button
                      type="button"
                      onClick={() => {
                        void copyText(rest.phone);
                        toast(`${rest.phone} 복사됨`);
                      }}
                      style={btn('ink', 28)}
                    >
                      <IconCopy size={13} />
                      복사
                    </button>
                  ) : null}
                </div>
                {rest.memo ? (
                  <div style={{ fontSize: 13, color: 'oklch(0.42 0.012 60)', lineHeight: 1.55 }}>
                    {rest.memo}
                  </div>
                ) : null}

                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 6 }}>
                    메뉴 {rest.menus.length}개
                  </div>
                  {rest.menus.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {rest.menus.map((m, i) => (
                        <div
                          key={m.id}
                          className="lp-fade-up"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            height: 38,
                            borderBottom: '1px solid oklch(0.95 0.004 75)',
                            animationDelay: `${i * 30}ms`,
                          }}
                        >
                          <span style={{ color: m.fav ? STAR : 'transparent', fontSize: 12 }}>★</span>
                          <span style={{ flex: 1, fontSize: 14 }}>{m.name}</span>
                          {showPrices ? (
                            <span style={{ fontSize: 13, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                              {won(m.price) || '—'}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: MUTED_2 }}>등록된 메뉴가 없어요.</div>
                  )}
                </div>

                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 12, color: MUTED_2, lineHeight: 1.5 }}>
                  정보가 틀렸나요? 고치면 호스트의 식당 목록에 저장되고 모두의 화면에 바로 반영돼요.
                </div>
                <button
                  type="button"
                  className="btn-soft"
                  onClick={() => setEdit(toDraft(rest))}
                  style={{ ...btn('soft'), alignSelf: 'flex-start' }}
                >
                  <IconEdit size={14} />
                  정보 고치기
                </button>
              </div>
            ) : (
              <div
                key="edit"
                className="lp-fade-up"
                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    분류
                    <select
                      value={edit.category}
                      onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                      style={{ ...field, cursor: 'pointer' }}
                    >
                      {CATS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={labelStyle}>
                    전화번호
                    <input
                      className="inp"
                      value={edit.phone}
                      onChange={(e) => {
                        setErr('');
                        setEdit({ ...edit, phone: fmtPhone(e.target.value) });
                      }}
                      placeholder="02-555-1234"
                      style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </label>
                  <label style={labelStyle}>
                    메모
                    <input
                      className="inp"
                      value={edit.memo}
                      maxLength={LIMITS.memo}
                      onChange={(e) => setEdit({ ...edit, memo: e.target.value })}
                      placeholder="예: 11시 20분 전에 전화하면 자리 맡아줌"
                      style={field}
                    />
                  </label>
                  <div style={labelStyle}>
                    메뉴
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {edit.menus.map((m, i) => (
                        <div
                          key={m.id}
                          className="lp-fade-up"
                          style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                        >
                          <input
                            className="inp"
                            value={m.name}
                            maxLength={LIMITS.menuName}
                            onChange={(e) => setMenu(i, { name: e.target.value })}
                            placeholder="메뉴 이름"
                            style={{ ...field, flex: 1 }}
                          />
                          <input
                            className="inp"
                            value={m.price}
                            inputMode="numeric"
                            onChange={(e) => setMenu(i, { price: priceFmt(e.target.value) })}
                            placeholder="가격"
                            style={{
                              ...field,
                              width: 92,
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                          <button
                            type="button"
                            className="btn-ghost-danger"
                            title="메뉴 삭제"
                            onClick={() => setEdit({ ...edit, menus: edit.menus.filter((_, j) => j !== i) })}
                            style={{ ...btn('ghost', 30), width: 30, padding: 0, color: DANGER }}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      ))}
                      {edit.menus.length < LIMITS.menus ? (
                        <button
                          type="button"
                          className="btn-soft"
                          onClick={() =>
                            setEdit({
                              ...edit,
                              menus: [...edit.menus, { id: uid(), name: '', price: '', fav: false }],
                            })
                          }
                          style={{ ...btn('soft', 30), alignSelf: 'flex-start', color: AINK }}
                        >
                          + 메뉴 추가
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {err ? (
                    <div className="lp-shake" style={{ fontSize: 12.5, color: DANGER }}>
                      {err}
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    padding: '12px 18px 16px',
                    borderTop: `1px solid ${HAIRLINE}`,
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={() => setEdit(null)}
                    style={btn('soft')}
                  >
                    취소
                  </button>
                  <button type="button" className="btn-accent" onClick={save} style={btn('accent')}>
                    저장하고 모두에게 반영
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 650,
  color: 'oklch(0.4 0.012 60)',
};
