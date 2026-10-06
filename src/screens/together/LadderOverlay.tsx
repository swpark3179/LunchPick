/**
 * 사다리 — 누가 출발시키든 모두의 화면에 같은 사다리가 같은 순서로 그려진다.
 * 사다리 모양·당첨 칸은 호스트가 정하고, 각 화면은 시간표대로 경로를 그릴 뿐이다.
 */
import { useEffect } from 'react';

import { short } from '../../lib/util';
import { ladderGeo, trace } from '../../pick/engine';
import type { RoomState } from '../../share/protocol';
import { AC, HUES, INK, MUTED, MUTED_3 } from '../../theme';
import { IconLadder, btn, btnClass, memberOf } from './parts';
import type { LadderView } from './useRoomAnim';

const RUNG = 'oklch(0.86 0.008 75)';
const AUTO_CLOSE_MS = 7000;

export default function LadderOverlay({
  view,
  room,
  onClose,
}: {
  view: LadderView;
  room: RoomState;
  onClose: () => void;
}) {
  const { run, drawn, revealed, finished } = view;
  const n = run.cands.length;
  const geo = ladderGeo(n);
  const g = { kind: 'ladder' as const, rungs: run.rungs, slots: run.slots, drawn, revealed };
  const traces = run.cands.map((_, i) => trace(g, i, geo));
  const col = (i: number) => `oklch(0.6 0.16 ${HUES[i % 12]})`;
  const gapPct = n > 1 ? ((geo.W - 2 * geo.pad) / (n - 1) / geo.W) * 100 : 60;
  const nameOf = (id: string) => room.restaurants.find((r) => r.id === id)?.name ?? '?';
  const by = memberOf(room, run.by);
  const dur = 1500 * run.speed;

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [finished, onClose]);

  return (
    <div
      className="lp-fade-in keep-motion"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 8,
        background: 'oklch(0.25 0.012 60 / .38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'lp-fade-in .25s both',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && finished) onClose();
      }}
    >
      <div
        style={{
          width: 860,
          maxWidth: 'calc(100% - 48px)',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 30px 80px oklch(0.2 0.02 60 / .35)',
          padding: '20px 24px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          animation: 'lp-zoom-in .45s cubic-bezier(.2,.9,.3,1.1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'oklch(0.96 0.03 50)',
              color: AC,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconLadder size={18} stroke={2} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 780 }}>
              사다리 타기 — 후보 {n}곳 중 {run.keep}곳
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
              {by?.name ?? '누군가'}님이 출발시켰어요 · 모두의 화면에서 같은 사다리가 그려져요
            </div>
          </div>
          {finished ? (
            <button type="button" className={btnClass('soft')} onClick={onClose} style={btn('soft')}>
              닫기
            </button>
          ) : null}
        </div>

        <div style={{ position: 'relative', height: 40 }}>
          {run.cands.map((id, i) => (
            <span
              key={id}
              style={{
                position: 'absolute',
                left: `${(geo.x(i) / geo.W) * 100}%`,
                top: 0,
                transform: 'translateX(-50%)',
                maxWidth: `${Math.max(gapPct - 1.5, 12)}%`,
                height: 36,
                padding: '0 12px',
                borderRadius: 18,
                border: `2px solid ${col(i)}`,
                background: drawn[i] ? col(i) : 'white',
                color: drawn[i] ? 'white' : INK,
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                transition: 'background .3s, color .3s',
              }}
            >
              {short(nameOf(id), 7)}
            </span>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${geo.W} ${geo.H}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          {run.cands.map((_, c) => (
            <line
              key={`v${c}`}
              x1={geo.x(c)}
              y1={0}
              x2={geo.x(c)}
              y2={geo.H}
              stroke={RUNG}
              strokeWidth={4}
              strokeLinecap="round"
            />
          ))}
          {run.rungs.flatMap((row, r) =>
            row.map((on, c) =>
              on ? (
                <line
                  key={`h${r}-${c}`}
                  x1={geo.x(c)}
                  y1={geo.y(r)}
                  x2={geo.x(c + 1)}
                  y2={geo.y(r)}
                  stroke={RUNG}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              ) : null,
            ),
          )}
          {traces.map((t, i) => (
            <polyline
              key={`p${i}`}
              points={t.pts.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={col(i)}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 2"
              strokeDashoffset={drawn[i] ? 0 : 1}
              style={{ transition: `stroke-dashoffset ${dur}ms ease-in-out`, opacity: drawn[i] ? 1 : 0 }}
            />
          ))}
        </svg>

        <div style={{ position: 'relative', height: 44 }}>
          {run.cands.map((_, slot) => {
            const from = traces.findIndex((t) => t.end === slot);
            const shown = from >= 0 && !!revealed[from];
            const win = run.slots[slot];
            return (
              <span
                key={`b${slot}`}
                style={{
                  position: 'absolute',
                  left: `${(geo.x(slot) / geo.W) * 100}%`,
                  top: 0,
                  transform: `translateX(-50%) scale(${shown && win ? 1.1 : 1})`,
                  minWidth: 56,
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 9,
                  background: shown ? (win ? AC : 'oklch(0.9 0.005 75)') : 'oklch(0.95 0.004 75)',
                  color: shown ? (win ? 'white' : MUTED) : MUTED_3,
                  fontSize: 13,
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  transition: 'transform .35s cubic-bezier(.2,.9,.3,1.4), background .3s',
                }}
              >
                {shown ? (win ? `통과 · ${short(nameOf(run.cands[from]), 5)}` : '꽝') : '?'}
              </span>
            );
          })}
        </div>

        <div
          style={{
            minHeight: 26,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: INK,
            opacity: finished ? 1 : 0,
            transform: finished ? 'none' : 'translateY(6px)',
            transition: 'opacity .35s, transform .35s',
          }}
        >
          {finished ? `통과한 곳 — ${run.winners.map(nameOf).join(', ')} · 후보에 남겼어요` : ''}
        </div>
      </div>
    </div>
  );
}
