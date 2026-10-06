/**
 * 후보 트레이 (시안: 후보 트레이) — 모두가 같이 보는 후보. 누구든 '확정'을 누르면 끝나고,
 * 2곳 이상이면 사다리로 n곳까지 추릴 수 있다.
 */
import { useState } from 'react';

import { LIMITS, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, MUTED } from '../../theme';
import { Stepper } from './Board';
import { Avatar, IconLadder, IconX, INPUT_BORDER, memberOf } from './parts';

export default function CandTray({
  room,
  lock,
  onInfo,
}: {
  room: RoomState;
  me: string;
  lock: boolean;
  onInfo: (id: string) => void;
}) {
  const act = useShare((s) => s.act);
  const [keep, setKeep] = useState(2);
  const ids = Object.entries(room.cands)
    .sort((a, b) => a[1].at - b[1].at)
    .map(([id]) => id)
    .filter((id) => room.restaurants.some((r) => r.id === id));
  const n = ids.length;
  const keepMax = Math.max(1, n - 1);
  const k = Math.min(keep, keepMax);
  const canLadder = n >= 2 && n <= LIMITS.ladderMax && !lock;

  return (
    <div
      style={{
        flex: 'none',
        borderTop: '1px solid oklch(0.91 0.006 75)',
        background: 'white',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
        <span style={{ fontSize: 13.5, fontWeight: 750 }}>
          후보{' '}
          <span
            key={n}
            style={{
              color: AC,
              fontVariantNumeric: 'tabular-nums',
              display: 'inline-block',
              animation: 'lp-pop .35s ease-out',
            }}
          >
            {n}
          </span>
          곳
        </span>
        <span style={{ fontSize: 11.5, color: 'oklch(0.55 0.012 60)' }}>누구든 ‘확정’을 누르면 끝나요</span>
      </div>
      <div
        style={{ flex: 1, minWidth: 200, display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}
      >
        {n ? (
          ids.map((id) => {
            const r = room.restaurants.find((x) => x.id === id)!;
            const by = memberOf(room, room.cands[id].by);
            const fin = room.final?.restId === id;
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 34,
                  padding: '0 4px',
                  borderRadius: 17,
                  background: fin ? 'oklch(0.95 0.04 150)' : 'oklch(0.965 0.025 50)',
                  boxShadow: `inset 0 0 0 1px ${fin ? 'oklch(0.82 0.06 150)' : 'oklch(0.88 0.05 50)'}`,
                  animation: 'lp-pop .4s cubic-bezier(.2,.9,.3,1.4) both',
                }}
              >
                <Avatar m={by} size={24} />
                <span
                  role="button"
                  tabIndex={0}
                  title="식당 정보 (나만 보기)"
                  onClick={() => onInfo(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onInfo(id);
                  }}
                  style={{ fontSize: 13, fontWeight: 680, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {r.name}
                </span>
                <button
                  type="button"
                  className={fin ? '' : 'tg-accent'}
                  disabled={fin}
                  onClick={() => act({ type: 'final', restId: id })}
                  style={{
                    height: 26,
                    padding: '0 10px',
                    border: 'none',
                    borderRadius: 13,
                    background: fin ? 'oklch(0.55 0.13 150)' : AC,
                    color: 'white',
                    font: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: fin ? 'default' : 'pointer',
                  }}
                >
                  {fin ? '확정됨' : '확정'}
                </button>
                <div
                  role="button"
                  tabIndex={0}
                  title="후보에서 내리기"
                  className="tg-chip-x"
                  onClick={() => !lock && act({ type: 'cand', restId: id })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !lock) act({ type: 'cand', restId: id });
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'oklch(0.55 0.012 60)',
                    cursor: lock ? 'default' : 'pointer',
                  }}
                >
                  <IconX size={11} stroke={2.6} />
                </div>
              </div>
            );
          })
        ) : (
          <span style={{ fontSize: 12.5, color: 'oklch(0.55 0.012 60)' }}>
            카드를 눌러 후보로 올려 보세요.
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 'none',
          opacity: n >= 2 ? 1 : 0.45,
          transition: 'opacity .3s',
        }}
        title={n > LIMITS.ladderMax ? `사다리는 후보 ${LIMITS.ladderMax}곳 이하에서 탈 수 있어요` : undefined}
      >
        <Stepper value={k} min={1} max={keepMax} onChange={setKeep} />
        <button
          type="button"
          className="tg-soft"
          onClick={() => act({ type: 'ladder', keep: k })}
          style={{
            height: 36,
            padding: '0 14px',
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 8,
            background: 'white',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 650,
            cursor: canLadder ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            color: canLadder ? 'oklch(0.24 0.012 60)' : MUTED,
          }}
        >
          <IconLadder size={15} />
          사다리로 {k}곳 추리기
        </button>
      </div>
    </div>
  );
}
