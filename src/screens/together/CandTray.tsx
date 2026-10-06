/**
 * 후보 트레이 — 모두가 같이 보는 후보 목록. 여기서 사다리로 줄이거나 한 곳을 골라 최종 확정한다.
 */
import { useEffect, useRef, useState } from 'react';

import { LIMITS, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, HAIRLINE, INK, MUTED, MUTED_2, catDot } from '../../theme';
import { Avatar, IconCheck, IconLadder, IconX, btn, btnClass, josaRo, memberOf } from './parts';

const CONFIRM_MS = 3000;

export default function CandTray({ room, busy }: { room: RoomState; busy: boolean }) {
  const act = useShare((s) => s.act);
  const list = Object.entries(room.cands)
    .sort((a, b) => a[1].at - b[1].at)
    .map(([id, c]) => ({ r: room.restaurants.find((x) => x.id === id), c }))
    .filter((x) => !!x.r);
  const n = list.length;

  const [focus, setFocus] = useState<string | null>(null);
  const [keep, setKeep] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 후보가 하나뿐이면 자동으로 고르고, 고른 곳이 빠지면 선택을 푼다.
  const focusId = n === 1 ? list[0].r!.id : focus && room.cands[focus] ? focus : null;
  const focused = focusId ? room.restaurants.find((r) => r.id === focusId) : undefined;
  const keepMax = Math.max(1, n - 1);
  const k = Math.min(keep, keepMax);
  const canLadder = n >= 2 && n <= LIMITS.ladderMax && !busy;
  const already = !!focusId && room.final?.restId === focusId;

  useEffect(() => {
    setConfirm(false);
    clearTimeout(confirmTimer.current);
  }, [focusId]);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const finalize = () => {
    if (!focusId || busy) return;
    if (!confirm) {
      setConfirm(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirm(false), CONFIRM_MS);
      return;
    }
    setConfirm(false);
    act({ type: 'final', restId: focusId });
  };

  return (
    <div
      style={{
        flex: 'none',
        borderTop: `1px solid ${HAIRLINE}`,
        background: 'oklch(0.99 0.003 75)',
        padding: '10px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 750 }}>후보</span>
        <span
          key={n}
          className="lp-pop"
          style={{
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 10,
            background: n ? AC : 'oklch(0.9 0.006 75)',
            color: n ? 'white' : MUTED,
            fontSize: 11.5,
            fontWeight: 750,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {n}
        </span>
        <span style={{ fontSize: 12, color: MUTED_2 }}>
          {n ? '눌러서 확정할 곳을 고르세요' : '카드를 누르면 모두의 화면에 후보로 함께 표시돼요'}
        </span>
        <span style={{ flex: 1 }} />
        {n ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => act({ type: 'clearCands' })}
            style={{ ...btn('ghost', 26), color: MUTED, fontSize: 12 }}
          >
            비우기
          </button>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div
          className="tg-tray-chips"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: 6,
            minHeight: 34,
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '1px 1px 3px',
          }}
        >
          {list.map(({ r, c }) => {
            const on = focusId === r!.id;
            const by = memberOf(room, c.by);
            return (
              <div
                key={r!.id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                className="tg-chip lp-pop"
                onClick={() => setFocus(on ? null : r!.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setFocus(on ? null : r!.id);
                }}
                title={by ? `${by.name}님이 올렸어요` : undefined}
                style={{
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '0 6px 0 5px',
                  borderRadius: 16,
                  background: on ? INK : 'white',
                  color: on ? 'white' : INK,
                  boxShadow: on ? 'none' : 'inset 0 0 0 1px oklch(0.88 0.006 75)',
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flex: 'none',
                  transition: 'background .18s, color .18s',
                }}
              >
                <Avatar m={by} size={22} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: catDot(r!.category) }} />
                {r!.name}
                {on ? <IconCheck size={14} stroke={2.6} /> : null}
                <span
                  role="button"
                  tabIndex={-1}
                  title="후보에서 빼기"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!busy) act({ type: 'cand', restId: r!.id });
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: on ? 'oklch(0.85 0.01 60)' : MUTED_2,
                  }}
                >
                  <IconX size={12} stroke={2.4} />
                </span>
              </div>
            );
          })}
        </div>

        {/* 사다리 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            height: 36,
            padding: '0 4px 0 2px',
            borderRadius: 9,
            boxShadow: 'inset 0 0 0 1px oklch(0.88 0.006 75)',
            background: 'white',
            opacity: canLadder ? 1 : 0.5,
          }}
          title={
            n > LIMITS.ladderMax
              ? `사다리는 ${LIMITS.ladderMax}곳 이하에서 탈 수 있어요`
              : n < 2
                ? '후보가 2곳 이상이면 사다리를 탈 수 있어요'
                : undefined
          }
        >
          <button
            type="button"
            disabled={!canLadder}
            onClick={() => act({ type: 'ladder', keep: k })}
            style={{
              ...btn('ghost', 30),
              cursor: canLadder ? 'pointer' : 'not-allowed',
              fontWeight: 700,
            }}
            className={canLadder ? 'btn-ghost' : ''}
          >
            <IconLadder size={15} />
            사다리로
          </button>
          <Stepper value={k} min={1} max={keepMax} onChange={setKeep} disabled={!canLadder} />
          <span style={{ fontSize: 12.5, fontWeight: 650, paddingRight: 6 }}>곳 남기기</span>
        </div>

        {/* 최종 확정 */}
        <button
          type="button"
          className={focused && !busy && !already ? btnClass('accent') : ''}
          disabled={!focused || busy || already}
          onClick={finalize}
          style={{
            ...btn('accent', 36),
            position: 'relative',
            overflow: 'hidden',
            minWidth: 150,
            opacity: already ? 1 : focused && !busy ? 1 : 0.4,
            cursor: focused && !busy && !already ? 'pointer' : 'not-allowed',
            background: already ? 'oklch(0.62 0.13 150)' : confirm ? 'oklch(0.48 0.16 40)' : AC,
          }}
        >
          {confirm ? (
            <span
              key={String(confirm)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'oklch(1 0 0 / .18)',
                transformOrigin: 'left',
                animation: `lp-confirm ${CONFIRM_MS}ms linear forwards`,
              }}
            />
          ) : null}
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={15} stroke={2.6} />
            {already
              ? '확정됨'
              : confirm
                ? '한 번 더 누르면 확정'
                : focused
                  ? `${short(focused.name)}${josaRo(short(focused.name))} 확정`
                  : '최종 확정'}
          </span>
        </button>
      </div>
    </div>
  );
}

const short = (t: string) => (t.length > 7 ? `${t.slice(0, 6)}…` : t);

export function Stepper({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const b = (on: boolean): React.CSSProperties => ({
    width: 24,
    height: 24,
    border: 'none',
    borderRadius: 6,
    background: 'oklch(0.95 0.005 75)',
    color: on ? INK : 'oklch(0.75 0.008 60)',
    font: 'inherit',
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1,
    cursor: on ? 'pointer' : 'default',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  const dec = !disabled && value > min;
  const inc = !disabled && value < max;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        aria-label="줄이기"
        disabled={!dec}
        onClick={() => onChange(value - 1)}
        style={b(dec)}
      >
        −
      </button>
      <span
        key={value}
        className="lp-pop"
        style={{
          minWidth: 16,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 780,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="늘리기"
        disabled={!inc}
        onClick={() => onChange(value + 1)}
        style={b(inc)}
      >
        +
      </button>
    </span>
  );
}
