import { useEffect, useRef } from 'react';

import { fmtPhone, phoneOk, uid } from '../lib/util';
import type { Restaurant } from '../lib/types';
import { useData } from '../store/dataStore';
import { useList } from '../store/listStore';
import { toast, useUi } from '../store/uiStore';
import { AC, CATS, DANGER, INK, LINE, catBg, catDot, catFg } from '../theme';
import Chip from './Chip';

const INPUT_BORDER = 'oklch(0.88 0.006 75)';

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 650,
  color: 'oklch(0.4 0.012 60)',
};

const inputStyle: React.CSSProperties = {
  height: 38,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 8,
  padding: '0 12px',
  font: 'inherit',
  fontSize: 14,
  fontWeight: 400,
  outline: 'none',
  color: INK,
};

export default function RestaurantModal() {
  const modal = useList((s) => s.modal);
  const setForm = useList((s) => s.setForm);
  const setModalErr = useList((s) => s.setModalErr);
  const closeModal = useList((s) => s.closeModal);
  const openDetail = useList((s) => s.openDetail);
  const setView = useUi((s) => s.setView);

  const f = modal?.form ?? { name: '', category: '한식', phone: '', memo: '' };

  // Tab 순서: 식당 이름 → 전화번호 → 메모 → 저장 (분류 칩과 취소는 건너뛴다).
  const nameRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const open = modal !== null;
  // 모달은 늘 마운트돼 있어 autoFocus 가 열 때마다 걸리지 않는다 — 열릴 때 직접 맞춘다.
  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  const save = () => {
    if (!modal) return;
    const name = f.name.trim();
    const { restaurants, apply, updateRest } = useData.getState();
    const err = !name
      ? '식당 이름을 입력하세요.'
      : !phoneOk(f.phone)
        ? '전화번호를 정확히 입력하세요.'
        : restaurants.some((r) => r.name === name && r.id !== modal.id)
          ? '같은 이름의 식당이 이미 있어요.'
          : '';
    if (err) {
      setModalErr(err);
      return;
    }
    if (modal.mode === 'new') {
      const r: Restaurant = {
        id: uid(),
        name,
        category: f.category,
        phone: fmtPhone(f.phone),
        memo: f.memo.trim(),
        fav: false,
        menus: [],
      };
      apply((d) => ({ ...d, restaurants: [...d.restaurants, r] }));
      closeModal();
      setView('list');
      openDetail(r.id);
      toast('등록했어요 — 자주 시키는 메뉴를 추가해 보세요');
      return;
    }
    updateRest(modal.id!, (r) => ({
      ...r,
      name,
      category: f.category,
      phone: fmtPhone(f.phone),
      memo: f.memo.trim(),
    }));
    closeModal();
    toast('수정했어요');
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: modal ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'oklch(0.25 0.012 60 / .32)',
        zIndex: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        style={{
          width: 440,
          maxWidth: 'calc(100% - 40px)',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 780 }}>
          {modal?.mode === 'edit' ? '식당 정보 수정' : '새 식당 등록'}
        </div>

        <label style={labelStyle}>
          식당 이름 *
          <input
            ref={nameRef}
            className="inp"
            value={f.name}
            onChange={(e) => setForm({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              // 맨 앞에서 Shift+Tab 은 저장 버튼으로 되돌아간다 (한글 조합 중이면 브라우저에 맡긴다).
              if (e.key === 'Tab' && e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                saveRef.current?.focus();
              }
            }}
            placeholder="예: 진주집"
            style={inputStyle}
          />
        </label>

        <div style={labelStyle}>
          분류
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {CATS.map((c) => {
              const on = f.category === c;
              return (
                <Chip
                  key={c}
                  label={c}
                  tabIndex={-1}
                  dot={catDot(c)}
                  dotSize={7}
                  gap={6}
                  onClick={() => setForm({ category: c })}
                  bg={on ? catBg(c) : 'white'}
                  color={on ? catFg(c) : 'oklch(0.35 0.012 60)'}
                  border={on ? catDot(c) : LINE}
                />
              );
            })}
          </div>
        </div>

        <label style={labelStyle}>
          <span>
            전화번호{' '}
            <span style={{ fontWeight: 400, color: 'oklch(0.6 0.01 60)' }}>· 비워둬도 돼요</span>
          </span>
          <input
            className="inp"
            value={f.phone}
            onChange={(e) => setForm({ phone: fmtPhone(e.target.value) })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
            placeholder="02-123-4567, 0507-1234-5678"
            style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
          />
        </label>

        <label style={labelStyle}>
          메모
          <input
            className="inp"
            value={f.memo}
            onChange={(e) => setForm({ memo: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
            placeholder="예: 11시 반 전에 전화해야 함, 단체석 있음"
            style={inputStyle}
          />
        </label>

        <div style={{ fontSize: 12.5, color: DANGER, minHeight: 16 }}>{modal?.err ?? ''}</div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            className="btn-soft"
            tabIndex={-1}
            onClick={closeModal}
            style={{
              height: 38,
              padding: '0 16px',
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 8,
              background: 'white',
              font: 'inherit',
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            ref={saveRef}
            className="btn-accent"
            onClick={save}
            onKeyDown={(e) => {
              // 저장에서 Tab 을 누르면 다시 식당 이름으로 (모달 밖으로 포커스가 새지 않게).
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                nameRef.current?.focus();
              }
            }}
            style={{
              height: 38,
              padding: '0 18px',
              border: 'none',
              borderRadius: 8,
              background: AC,
              color: 'white',
              font: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
