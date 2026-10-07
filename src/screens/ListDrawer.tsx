import { useRef } from 'react';

import { copyText } from '../lib/ipc';
import type { Restaurant } from '../lib/types';
import { agoText, daysAgo, lastAt, priceFmt, uid, won } from '../lib/util';
import { useData } from '../store/dataStore';
import { useList } from '../store/listStore';
import { toast } from '../store/uiStore';
import { AC, AINK, DANGER, DANGER_STRONG, HAIRLINE, INK, MUTED, MUTED_2, STAR, catBg, catDot, catFg } from '../theme';

const EMPTY: Restaurant = {
  id: '',
  name: '',
  category: '기타',
  phone: '',
  memo: '',
  fav: false,
  menus: [],
};

const INPUT_BORDER = 'oklch(0.88 0.006 75)';
const ROW_LINE = '1px solid oklch(0.95 0.004 75)';

export default function ListDrawer() {
  const restaurants = useData((s) => s.restaurants);
  const history = useData((s) => s.history);
  const updateRest = useData((s) => s.updateRest);
  const apply = useData((s) => s.apply);

  const selId = useList((s) => s.selId);
  const closeDetail = useList((s) => s.closeDetail);
  const confirmDel = useList((s) => s.confirmDel);
  const setConfirmDel = useList((s) => s.setConfirmDel);
  const editMenu = useList((s) => s.editMenu);
  const setEditMenu = useList((s) => s.setEditMenu);
  const menuForm = useList((s) => s.menuForm);
  const setMenuForm = useList((s) => s.setMenuForm);
  const resetMenuForm = useList((s) => s.resetMenuForm);
  const openEdit = useList((s) => s.openEdit);

  const sel = restaurants.find((r) => r.id === selId) ?? null;
  // 닫히는 애니메이션 동안 내용이 사라지지 않도록 마지막 선택을 붙잡아 둔다.
  const lastRef = useRef<Restaurant | null>(null);
  if (sel) lastRef.current = sel;
  // 메뉴 추가: 메뉴 → (Tab) 가격 → (Enter) 추가 후 다시 메뉴 입력칸으로.
  const menuNameRef = useRef<HTMLInputElement>(null);
  const L = sel ?? lastRef.current ?? restaurants[0] ?? EMPTY;

  const d = daysAgo(lastAt(history, L.id));
  const eaten = agoText(d);
  const recent = d !== null && d <= 3;

  const copy = (text: string) => {
    void copyText(text);
    toast(`${text} 복사됨`);
  };

  const addMenu = () => {
    const name = menuForm.name.trim();
    if (!name) {
      toast('메뉴 이름을 입력하세요');
      return;
    }
    const p = menuForm.price.replace(/\D/g, '');
    updateRest(L.id, (r) => ({
      ...r,
      menus: [
        ...r.menus,
        {
          id: uid(),
          name,
          price: p ? Number(p) : null,
          // 처음 두 개는 자동으로 대표 메뉴로 표시한다 (목업과 동일).
          fav: r.menus.filter((m) => m.fav).length < 2,
        },
      ],
    }));
    resetMenuForm();
  };

  const saveMenu = () => {
    if (!editMenu || !editMenu.name.trim()) return;
    const p = editMenu.price.replace(/\D/g, '');
    updateRest(L.id, (r) => ({
      ...r,
      menus: r.menus.map((m) =>
        m.id === editMenu.id
          ? { ...m, name: editMenu.name.trim(), price: p ? Number(p) : null }
          : m,
      ),
    }));
    setEditMenu(null);
  };

  const deleteRestaurant = () => {
    const name = L.name;
    apply((data) => ({ ...data, restaurants: data.restaurants.filter((r) => r.id !== L.id) }));
    closeDetail();
    toast(`${name} 삭제됨`);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        maxWidth: '100%',
        background: 'white',
        borderLeft: `1px solid ${HAIRLINE}`,
        boxShadow: '-12px 0 32px oklch(0.4 0.02 60 / .08)',
        transform: sel ? 'translateX(0)' : 'translateX(105%)',
        transition: 'transform .32s cubic-bezier(.2,.8,.2,1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '18px 22px 16px',
          borderBottom: '1px solid oklch(0.92 0.006 75)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              background: catBg(L.category),
              color: catFg(L.category),
            }}
          >
            <span
              style={{ width: 7, height: 7, borderRadius: '50%', background: catDot(L.category) }}
            />
            {L.category}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="btn-soft"
              onClick={() => updateRest(L.id, (x) => ({ ...x, fav: !x.fav }))}
              style={{
                height: 28,
                padding: '0 10px',
                border: '1px solid oklch(0.9 0.006 75)',
                borderRadius: 6,
                background: 'white',
                font: 'inherit',
                fontSize: 12.5,
                color: L.fav ? 'oklch(0.55 0.13 75)' : 'oklch(0.45 0.012 60)',
                cursor: 'pointer',
              }}
            >
              {L.fav ? '★ 자주 가는 곳' : '☆ 자주 가는 곳'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={closeDetail}
              title="닫기"
              style={{
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                fontSize: 14,
                cursor: 'pointer',
                color: 'oklch(0.4 0.012 60)',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ fontSize: 24, fontWeight: 780, letterSpacing: '-0.02em' }}>{L.name}</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'oklch(0.975 0.004 75)',
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          <span style={{ fontSize: 12, color: MUTED }}>예약 전화</span>
          <span
            style={{
              flex: 1,
              fontSize: 17,
              fontWeight: 650,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {L.phone}
          </span>
          <button
            type="button"
            onClick={() => copy(L.phone)}
            style={{
              height: 28,
              padding: '0 10px',
              border: 'none',
              borderRadius: 6,
              background: INK,
              color: 'white',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            복사
          </button>
        </div>

        {eaten ? (
          <div style={{ fontSize: 12.5, color: recent ? AINK : MUTED, fontWeight: recent ? 650 : 400 }}>
            마지막 방문 · {eaten}
          </div>
        ) : null}

        {L.memo ? (
          <div style={{ fontSize: 13, color: 'oklch(0.42 0.012 60)', lineHeight: 1.5 }}>
            {L.memo}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-soft"
            onClick={() => openEdit(L)}
            style={{
              height: 30,
              padding: '0 12px',
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 6,
              background: 'white',
              font: 'inherit',
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            정보 수정
          </button>
          {!confirmDel ? (
            <button
              type="button"
              className="btn-soft"
              onClick={() => setConfirmDel(true)}
              style={{
                height: 30,
                padding: '0 12px',
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                background: 'white',
                font: 'inherit',
                fontSize: 12.5,
                color: DANGER,
                cursor: 'pointer',
              }}
            >
              삭제
            </button>
          ) : (
            <>
              <span style={{ fontSize: 12.5, color: DANGER, marginLeft: 4 }}>정말 삭제할까요?</span>
              <button
                type="button"
                onClick={deleteRestaurant}
                style={{
                  height: 30,
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: 6,
                  background: DANGER_STRONG,
                  color: 'white',
                  font: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                삭제
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmDel(false)}
                style={{
                  height: 30,
                  padding: '0 10px',
                  border: 'none',
                  borderRadius: 6,
                  background: 'transparent',
                  font: 'inherit',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 22px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            메뉴 <span style={{ color: MUTED_2, fontWeight: 500 }}>{L.menus.length}</span>
          </span>
          <span style={{ fontSize: 11.5, color: MUTED_2 }}>
            ★ 표시한 메뉴가 목록에 먼저 보여요
          </span>
        </div>

        {L.menus.map((m) =>
          editMenu && editMenu.id === m.id ? (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 0',
                borderBottom: ROW_LINE,
              }}
            >
              <input
                autoFocus
                value={editMenu.name}
                onChange={(e) => setEditMenu({ ...editMenu, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveMenu();
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditMenu(null);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 30,
                  border: `1px solid ${AC}`,
                  borderRadius: 6,
                  padding: '0 8px',
                  font: 'inherit',
                  fontSize: 13.5,
                  outline: 'none',
                }}
              />
              <input
                value={editMenu.price}
                onChange={(e) => setEditMenu({ ...editMenu, price: priceFmt(e.target.value) })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveMenu();
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditMenu(null);
                  }
                }}
                placeholder="가격"
                style={{
                  width: 84,
                  height: 30,
                  border: `1px solid ${INPUT_BORDER}`,
                  borderRadius: 6,
                  padding: '0 8px',
                  font: 'inherit',
                  fontSize: 13.5,
                  outline: 'none',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <button
                type="button"
                onClick={saveMenu}
                style={{
                  height: 30,
                  padding: '0 10px',
                  border: 'none',
                  borderRadius: 6,
                  background: AC,
                  color: 'white',
                  font: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setEditMenu(null)}
                style={{
                  height: 30,
                  padding: '0 8px',
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          ) : (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                borderBottom: ROW_LINE,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  updateRest(L.id, (x) => ({
                    ...x,
                    menus: x.menus.map((y) => (y.id === m.id ? { ...y, fav: !y.fav } : y)),
                  }))
                }
                style={{
                  width: 26,
                  height: 26,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 16,
                  color: m.fav ? STAR : 'oklch(0.8 0.01 60)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {m.fav ? '★' : '☆'}
              </button>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{m.name}</span>
              <span
                style={{
                  fontSize: 13.5,
                  fontVariantNumeric: 'tabular-nums',
                  color: m.price != null ? 'oklch(0.35 0.012 60)' : 'oklch(0.65 0.01 60)',
                }}
              >
                {won(m.price) || '가격 미입력'}
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  setEditMenu({
                    id: m.id,
                    name: m.name,
                    price: m.price != null ? Number(m.price).toLocaleString('ko-KR') : '',
                  })
                }
                style={{
                  height: 24,
                  padding: '0 7px',
                  border: 'none',
                  borderRadius: 5,
                  background: 'transparent',
                  font: 'inherit',
                  fontSize: 12,
                  color: MUTED,
                  cursor: 'pointer',
                }}
              >
                수정
              </button>
              <button
                type="button"
                className="btn-ghost-danger"
                onClick={() =>
                  updateRest(L.id, (x) => ({ ...x, menus: x.menus.filter((y) => y.id !== m.id) }))
                }
                style={{
                  height: 24,
                  padding: '0 7px',
                  border: 'none',
                  borderRadius: 5,
                  background: 'transparent',
                  font: 'inherit',
                  fontSize: 12,
                  color: DANGER,
                  cursor: 'pointer',
                }}
              >
                삭제
              </button>
            </div>
          ),
        )}

        {!L.menus.length ? (
          <div style={{ padding: '22px 0', fontSize: 13, color: MUTED_2, lineHeight: 1.6 }}>
            아직 등록된 메뉴가 없어요.
            <br />
            자주 시키는 메뉴만 아래에서 추가하세요.
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: '14px 22px 18px',
          borderTop: '1px solid oklch(0.92 0.006 75)',
          background: 'oklch(0.985 0.003 75)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 650,
            color: 'oklch(0.45 0.012 60)',
            marginBottom: 8,
          }}
        >
          메뉴 추가{' '}
          <span style={{ fontWeight: 400, color: 'oklch(0.6 0.01 60)' }}>
            · 가격은 비워둬도 돼요
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={menuNameRef}
            className="inp"
            value={menuForm.name}
            onChange={(e) => setMenuForm({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMenu();
            }}
            placeholder="메뉴 이름"
            style={{
              flex: 1,
              minWidth: 0,
              height: 34,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 7,
              padding: '0 10px',
              font: 'inherit',
              fontSize: 13.5,
              outline: 'none',
              background: 'white',
            }}
          />
          <input
            className="inp"
            value={menuForm.price}
            onChange={(e) => setMenuForm({ price: priceFmt(e.target.value) })}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              addMenu();
              menuNameRef.current?.focus();
            }}
            placeholder="가격(원)"
            style={{
              width: 96,
              height: 34,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 7,
              padding: '0 10px',
              font: 'inherit',
              fontSize: 13.5,
              outline: 'none',
              background: 'white',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          <button
            type="button"
            onClick={addMenu}
            style={{
              height: 34,
              padding: '0 14px',
              border: 'none',
              borderRadius: 7,
              background: INK,
              color: 'white',
              font: 'inherit',
              fontSize: 13,
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
