/**
 * 식당 상세 (시안: 식당 상세 (나만 보기)) — 내 화면에서만 열린다.
 * 틀린 정보는 여기서 고치고, 저장하면 호스트의 식당 목록에 반영돼 모두에게 알려진다.
 */
import { useEffect, useRef, useState } from 'react';

import { copyText } from '../../lib/ipc';
import type { Restaurant } from '../../lib/types';
import { fmtPhone, uid } from '../../lib/util';
import { LIMITS, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, AINK, CH, INK } from '../../theme';
import { IconEyeOff, IconPhone, IconX, INPUT_BORDER } from './parts';

type MenuDraft = { id: string; name: string; price: string; fav: boolean };
type Draft = { phone: string; memo: string; menus: MenuDraft[] };

const won = (p: number | null) => (p == null ? '가격 미정' : `${p.toLocaleString('ko-KR')}원`);

const field: React.CSSProperties = {
  height: 34,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 7,
  padding: '0 9px',
  font: 'inherit',
  fontSize: 13.5,
  outline: 'none',
  color: INK,
  background: 'white',
  minWidth: 0,
};
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'oklch(0.38 0.012 60)' };

export default function InfoDrawer({
  room,
  id,
  host,
  hostShort,
  onClose,
}: {
  room: RoomState;
  id: string | null;
  host: boolean;
  hostShort: string;
  onClose: () => void;
}) {
  const act = useShare((s) => s.act);
  const [draft, setDraft] = useState<Draft | null>(null);

  // 닫히는 동안 내용이 사라지지 않도록 마지막 식당을 붙잡아 둔다 (시안의 dLast).
  const lastRef = useRef<Restaurant | null>(null);
  const live = id ? (room.restaurants.find((r) => r.id === id) ?? null) : null;
  if (live) lastRef.current = live;
  const r = live ?? lastRef.current;
  const open = !!live;

  useEffect(() => setDraft(null), [id]);

  if (!r) return null;
  const hue = CH[r.category] ?? 300;
  const status =
    room.final?.restId === r.id
      ? ['확정됨', 'oklch(0.95 0.04 150)', 'oklch(0.4 0.1 150)']
      : room.dislikes[r.id]?.length
        ? ['가기 싫은 곳', 'oklch(0.95 0.03 25)', 'oklch(0.48 0.15 25)']
        : room.cands[r.id]
          ? ['후보', 'oklch(0.965 0.025 50)', AINK]
          : null;
  const excluded = !!room.dislikes[r.id]?.length;

  const startEdit = () =>
    setDraft({
      phone: r.phone,
      memo: r.memo,
      menus: r.menus.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price == null ? '' : String(m.price),
        fav: m.fav,
      })),
    });

  const save = () => {
    if (!draft) return;
    const menus = draft.menus
      .filter((m) => m.name.trim())
      .map((m) => {
        const n = parseInt(m.price.replace(/[^\d]/g, ''), 10);
        return { id: m.id, name: m.name.trim(), price: Number.isNaN(n) ? null : n, fav: m.fav };
      });
    const changed =
      fmtPhone(draft.phone) !== r.phone ||
      draft.memo.trim() !== r.memo ||
      JSON.stringify(menus.map((m) => [m.name, m.price])) !==
        JSON.stringify(r.menus.map((m) => [m.name, m.price]));
    setDraft(null);
    if (!changed) return;
    act({
      type: 'editRest',
      rest: { id: r.id, phone: fmtPhone(draft.phone), memo: draft.memo.trim(), menus },
    });
    toast(host ? '내 식당 목록에 저장하고 모두에게 알렸어요' : '호스트의 식당 목록에 반영했어요');
  };

  const setMenu = (i: number, p: Partial<MenuDraft>) =>
    setDraft((d) => (d ? { ...d, menus: d.menus.map((m, j) => (j === i ? { ...m, ...p } : m)) } : d));

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'oklch(0.25 0.012 60 / .2)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s',
          zIndex: 20,
        }}
      />
      <div
        role="dialog"
        aria-label={`${r.name} 정보`}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          maxWidth: '100%',
          background: 'white',
          boxShadow: '-20px 0 50px oklch(0.2 0.02 60 / .18)',
          transform: open ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform .42s cubic-bezier(.2,.8,.2,1)',
          zIndex: 21,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px 12px 18px',
            borderBottom: '1px solid oklch(0.93 0.005 75)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 10px',
              borderRadius: 13,
              background: 'oklch(0.955 0.005 75)',
              color: 'oklch(0.42 0.012 60)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <IconEyeOff size={13} />
            나만 보는 중
          </div>
          <span style={{ fontSize: 11.5, color: 'oklch(0.55 0.012 60)', flex: 1 }}>
            다른 사람 화면엔 열리지 않아요
          </span>
          <div
            role="button"
            tabIndex={0}
            className="tg-act"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onClose();
            }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'oklch(0.42 0.012 60)',
            }}
          >
            <IconX size={15} stroke={2.2} />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 780, letterSpacing: '-0.02em' }}>{r.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Chip bg={`oklch(0.95 0.035 ${hue})`} fg={`oklch(0.42 0.11 ${hue})`}>
                {r.category}
              </Chip>
              {status ? (
                <Chip bg={status[1]} fg={status[2]}>
                  {status[0]}
                </Chip>
              ) : null}
              {room.edited[r.id] ? (
                <Chip key={room.edited[r.id]} bg="oklch(0.95 0.04 150)" fg="oklch(0.4 0.1 150)" pop>
                  방금 수정됨
                </Chip>
              ) : null}
            </div>
          </div>

          {!draft ? (
            <div
              key="view"
              style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'lp-in .25s ease-out' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: 'oklch(0.975 0.004 75)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 0 0 1px oklch(0.91 0.006 75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: AC,
                    flex: 'none',
                  }}
                >
                  <IconPhone size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: 'oklch(0.55 0.012 60)' }}>전화번호</div>
                  <div
                    key={r.phone}
                    style={{
                      fontSize: 19,
                      fontWeight: 750,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.01em',
                      animation: 'lp-in .3s ease-out',
                    }}
                  >
                    {r.phone || '번호 없음'}
                  </div>
                </div>
                <button
                  type="button"
                  className="tg-soft"
                  onClick={() => {
                    void copyText(r.phone);
                    toast('전화번호를 복사했어요');
                  }}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    border: `1px solid ${INPUT_BORDER}`,
                    borderRadius: 7,
                    background: 'white',
                    font: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  복사
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ ...label, marginBottom: 6 }}>메뉴 {r.menus.length}개</div>
                {r.menus.length ? (
                  r.menus.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 0',
                        borderBottom: '1px solid oklch(0.94 0.005 75)',
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13.5 }}>{m.name}</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: 'oklch(0.42 0.012 60)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {won(m.price)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.012 60)', padding: '12px 0' }}>
                    등록된 메뉴가 없어요. ‘정보 수정’에서 추가해 주세요.
                  </div>
                )}
              </div>
              {r.memo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={label}>메모</div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'oklch(0.965 0.025 50)',
                      color: 'oklch(0.38 0.06 50)',
                    }}
                  >
                    {r.memo}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              key="edit"
              style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'lp-in .25s ease-out' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={label}>전화번호</span>
                <input
                  className="tg-input"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: fmtPhone(e.target.value) })}
                  style={{
                    ...field,
                    height: 38,
                    padding: '0 10px',
                    fontSize: 14,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={label}>메뉴</span>
                {draft.menus.map((m, i) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      animation: 'lp-in .25s ease-out',
                    }}
                  >
                    <input
                      className="tg-input"
                      value={m.name}
                      maxLength={LIMITS.menuName}
                      onChange={(e) => setMenu(i, { name: e.target.value })}
                      placeholder="메뉴 이름"
                      style={{ ...field, flex: 1 }}
                    />
                    <input
                      className="tg-input"
                      value={m.price}
                      inputMode="numeric"
                      onChange={(e) =>
                        setMenu(i, { price: e.target.value.replace(/[^\d]/g, '').slice(0, 7) })
                      }
                      placeholder="가격"
                      style={{ ...field, width: 84, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      title="삭제"
                      className="tg-danger"
                      onClick={() => setDraft({ ...draft, menus: draft.menus.filter((_, j) => j !== i) })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          setDraft({ ...draft, menus: draft.menus.filter((_, j) => j !== i) });
                      }}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 7,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'oklch(0.5 0.17 25)',
                        flex: 'none',
                      }}
                    >
                      <IconX size={13} />
                    </div>
                  </div>
                ))}
                {draft.menus.length < LIMITS.menus ? (
                  <div
                    role="button"
                    tabIndex={0}
                    className="tg-dashed"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        menus: [...draft.menus, { id: uid(), name: '', price: '', fav: false }],
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        setDraft({
                          ...draft,
                          menus: [...draft.menus, { id: uid(), name: '', price: '', fav: false }],
                        });
                    }}
                    style={{
                      height: 34,
                      border: '1.5px dashed oklch(0.86 0.01 60)',
                      borderRadius: 7,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'oklch(0.45 0.012 60)',
                      cursor: 'pointer',
                    }}
                  >
                    + 메뉴 추가
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={label}>메모</span>
                <textarea
                  className="tg-input"
                  value={draft.memo}
                  maxLength={LIMITS.memo}
                  onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
                  rows={3}
                  style={{
                    border: `1px solid ${INPUT_BORDER}`,
                    borderRadius: 7,
                    padding: '9px 10px',
                    font: 'inherit',
                    fontSize: 13.5,
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: 1.5,
                    color: INK,
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'oklch(0.5 0.012 60)',
                  lineHeight: 1.5,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'oklch(0.975 0.004 75)',
                }}
              >
                {host
                  ? '저장하면 내 식당 목록이 바뀌고, 방에 있는 모두에게 알려요.'
                  : `저장하면 ${hostShort}님(호스트)의 식당 목록에 반영되고, 모두에게 알려요.`}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            flex: 'none',
            display: 'flex',
            gap: 8,
            padding: '12px 18px 16px',
            borderTop: '1px solid oklch(0.93 0.005 75)',
          }}
        >
          {!draft ? (
            <>
              <button type="button" className="tg-soft" onClick={startEdit} style={footBtn(false)}>
                정보 수정
              </button>
              <button
                type="button"
                className={excluded ? '' : 'tg-accent'}
                onClick={() => {
                  if (excluded) {
                    toast('가기 싫은 곳으로 빠진 식당이에요');
                    return;
                  }
                  act({ type: 'final', restId: r.id });
                  onClose();
                }}
                style={{ ...footBtn(true), opacity: excluded ? 0.4 : 1 }}
              >
                이 식당으로 최종 확정
              </button>
            </>
          ) : (
            <>
              <button type="button" className="tg-soft" onClick={() => setDraft(null)} style={footBtn(false)}>
                취소
              </button>
              <button type="button" className="tg-accent" onClick={save} style={footBtn(true)}>
                저장하고 모두에게 반영
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const footBtn = (accent: boolean): React.CSSProperties =>
  accent
    ? {
        flex: 1,
        height: 40,
        border: 'none',
        borderRadius: 8,
        background: AC,
        color: 'white',
        font: 'inherit',
        fontSize: 13.5,
        fontWeight: 700,
        cursor: 'pointer',
      }
    : {
        height: 40,
        padding: '0 16px',
        border: `1px solid ${INPUT_BORDER}`,
        borderRadius: 8,
        background: 'white',
        font: 'inherit',
        fontSize: 13.5,
        fontWeight: 650,
        cursor: 'pointer',
      };

function Chip({
  bg,
  fg,
  pop,
  children,
}: {
  bg: string;
  fg: string;
  pop?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        height: 24,
        padding: '0 9px',
        borderRadius: 12,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        animation: pop ? 'lp-pop .4s ease-out both' : undefined,
      }}
    >
      {children}
    </span>
  );
}
