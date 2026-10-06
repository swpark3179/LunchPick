/**
 * 최종 확정 — 누구든 한 곳을 확정하면 모두의 화면에 같이 뜬다.
 */
import { useMemo } from 'react';

import { copyText } from '../../lib/ipc';
import { topMenus, won } from '../../lib/util';
import type { RoomState } from '../../share/protocol';
import { useShowPrices } from '../../store/settingsStore';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AINK, HUES, INK, MUTED, PANEL_RING, catBg, catFg } from '../../theme';
import { Avatar, IconCopy, IconUndo, btn, memberOf } from './parts';

const PIECES = 46;

export default function FinalOverlay({ room, onClose }: { room: RoomState; onClose: () => void }) {
  const act = useShare((s) => s.act);
  const showPrices = useShowPrices();
  const f = room.final!;
  const r = room.restaurants.find((x) => x.id === f.restId);
  const by = memberOf(room, f.by);

  // 확정 순간마다 다른 모양의 색종이
  const confetti = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.6,
        dx: (Math.random() - 0.5) * 220,
        rot: 360 + Math.random() * 720,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        hue: HUES[i % HUES.length],
        round: Math.random() < 0.3,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.at],
  );

  if (!r) return null;

  const copy = () => {
    void copyText(r.phone);
    toast(`${r.phone} 복사됨`);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9,
        background: 'oklch(0.25 0.012 60 / .42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        animation: 'lp-fade-in .25s both',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {confetti.map((p, i) => (
          <span
            key={i}
            style={
              {
                position: 'absolute',
                top: -20,
                left: `${p.left}%`,
                width: p.w,
                height: p.round ? p.w : p.h,
                borderRadius: p.round ? '50%' : 2,
                background: `oklch(0.7 0.17 ${p.hue})`,
                '--dx': `${p.dx}px`,
                '--rot': `${p.rot}deg`,
                animation: `lp-confetti ${p.dur}s cubic-bezier(.25,.6,.45,1) ${p.delay}s both`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          width: 480,
          maxWidth: 'calc(100% - 48px)',
          background: 'white',
          borderRadius: 18,
          boxShadow: `${PANEL_RING}, 0 30px 80px oklch(0.2 0.03 60 / .35)`,
          padding: '28px 30px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'lp-zoom-in .6s cubic-bezier(.2,.9,.25,1.2) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 750, color: AINK }}>오늘 점심은</span>
          <span
            style={{
              height: 24,
              padding: '0 10px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 650,
              background: catBg(r.category),
              color: catFg(r.category),
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {r.category}
          </span>
        </div>
        <div style={{ fontSize: 40, fontWeight: 850, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {r.name}
        </div>
        {room.reasons[r.id] ? (
          <div style={{ fontSize: 13.5, color: 'oklch(0.42 0.13 40)', fontWeight: 600 }}>
            {room.reasons[r.id]}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: INK,
            color: 'white',
            borderRadius: 12,
            padding: '13px 14px 13px 16px',
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.75 }}>예약 전화</span>
          <span style={{ flex: 1, fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {r.phone || '번호 없음'}
          </span>
          {r.phone ? (
            <button type="button" onClick={copy} style={{ ...btn('soft', 32), border: 'none' }}>
              <IconCopy size={14} />
              번호 복사
            </button>
          ) : null}
        </div>

        {r.menus.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topMenus(r, 4).map((m) => (
              <span
                key={m.id}
                style={{
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 14,
                  background: 'oklch(0.965 0.006 75)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {m.name}
                {showPrices && m.price ? (
                  <span style={{ color: MUTED, fontWeight: 500 }}>{won(m.price)}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Avatar m={by} size={22} />
          <span style={{ fontSize: 12.5, color: MUTED, flex: 1 }}>{by?.name ?? '누군가'}님이 확정했어요</span>
          <button
            type="button"
            className="btn-soft"
            onClick={() => act({ type: 'unfinal' })}
            style={btn('soft', 34)}
            title="확정을 취소하고 다시 골라요 (모두에게 적용돼요)"
          >
            <IconUndo size={14} />
            다시 고르기
          </button>
          <button type="button" className="btn-accent" onClick={onClose} style={btn('accent', 34)}>
            좋아요
          </button>
        </div>
      </div>
    </div>
  );
}
