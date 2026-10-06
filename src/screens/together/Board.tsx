/**
 * 가운데 보드 — 가기 싫은 곳으로 빠지지 않은 식당들. 모두가 같은 순서·같은 후보를 본다.
 */
import { useMemo, useRef, useState } from 'react';

import { copyText } from '../../lib/ipc';
import type { Restaurant } from '../../lib/types';
import { LIMITS, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, CATS, INK, MUTED, MUTED_2, OK_BG, OK_FG } from '../../theme';
import AiBar from './AiBar';
import CandTray, { Stepper } from './CandTray';
import { IconCheck, IconDice, IconSpark, IconUndo, btn, memberOf, useExiting, useFlip } from './parts';
import RestCard from './RestCard';
import type { RollView } from './useRoomAnim';

const BOARD_BG = 'oklch(0.975 0.004 75)';

const catIdx = (c: string) => {
  const i = (CATS as readonly string[]).indexOf(c);
  return i < 0 ? CATS.length : i;
};

/** 호스트의 visible() 과 같은 순서 — AI 순서가 있으면 그 순서, 없으면 분류·이름 순. */
export function boardOrder(room: RoomState): Restaurant[] {
  const live = room.restaurants.filter((r) => !room.dislikes[r.id]?.length);
  if (room.order.length) {
    const idx = new Map(room.order.map((id, i) => [id, i]));
    return [...live].sort((a, b) => (idx.get(a.id) ?? 1e9) - (idx.get(b.id) ?? 1e9));
  }
  return [...live].sort(
    (a, b) => catIdx(a.category) - catIdx(b.category) || a.name.localeCompare(b.name, 'ko'),
  );
}

export default function Board({
  room,
  me,
  roll,
  onInfo,
  finalHidden,
  onShowFinal,
}: {
  room: RoomState;
  me: string;
  roll: RollView | null;
  onInfo: (id: string) => void;
  finalHidden: boolean;
  onShowFinal: () => void;
}) {
  const act = useShare((s) => s.act);
  const gridRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(3);

  const list = useMemo(() => boardOrder(room), [room]);
  const shown = useExiting(list, (r) => r.id, 260);
  useFlip(gridRef);

  const busy = (!!room.roll && !room.roll.done) || (!!room.ladder && !room.ladder.done) || !!roll?.active;
  const pool = list.filter((r) => !room.cands[r.id]).length;
  const n = Math.max(1, Math.min(count, LIMITS.rollMax, Math.max(1, pool)));
  const rollBy = roll ? memberOf(room, roll.by) : undefined;
  const final = room.final ? room.restaurants.find((r) => r.id === room.final!.restId) : undefined;

  return (
    <div
      style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: BOARD_BG }}
    >
      {/* AI 바·툴바·카드가 함께 스크롤된다 — 창이 낮아도 카드 칸이 남도록. 툴바는 위에 붙는다. */}
      <div
        ref={gridRef}
        className={roll?.active ? 'keep-motion' : undefined}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto', padding: '0 16px 18px' }}
      >
        <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {final && finalHidden ? (
            <div
              className="lp-fade-up"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: OK_BG,
                color: OK_FG,
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 13.5,
                fontWeight: 650,
              }}
            >
              <IconCheck size={16} stroke={2.6} />
              <span style={{ flex: 1, minWidth: 0 }}>
                오늘 점심은 <b style={{ color: INK }}>{final.name}</b>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}> · {final.phone}</span>
              </span>
              <button
                type="button"
                className="btn-soft"
                onClick={() => {
                  void copyText(final.phone);
                  toast(`${final.phone} 복사됨`);
                }}
                style={btn('soft', 28)}
              >
                번호 복사
              </button>
              <button type="button" className="btn-soft" onClick={onShowFinal} style={btn('soft', 28)}>
                크게 보기
              </button>
            </div>
          ) : null}

          <AiBar room={room} me={me} />
        </div>

        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 4,
            background: BOARD_BG,
            padding: '10px 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 750 }}>남은 식당</span>
          <span style={{ fontSize: 13, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
            {list.length}곳
          </span>
          {room.order.length ? (
            <span
              key={room.order.join()}
              className="lp-pop"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 22,
                padding: '0 8px',
                borderRadius: 11,
                background: 'oklch(0.96 0.03 320)',
                color: 'oklch(0.45 0.13 320)',
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              <IconSpark size={12} />
              AI가 다시 늘어놓은 순서
            </span>
          ) : null}
          {/* 무작위 뽑기 진행 표시 */}
          {roll ? (
            <span
              key={roll.id}
              className="lp-pop keep-motion"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 28,
                padding: '0 12px',
                borderRadius: 14,
                background: INK,
                color: 'white',
                fontSize: 12.5,
                fontWeight: 650,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  animation: roll.active ? 'lp-spin .7s linear infinite' : 'none',
                }}
              >
                <IconDice size={14} />
              </span>
              {roll.active
                ? `${rollBy?.name ?? '누군가'}님이 ${roll.count}곳 뽑는 중`
                : `${roll.count}곳을 후보에 올렸어요`}
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {Array.from({ length: roll.count }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: i < roll.landed.length ? AC : 'oklch(1 0 0 / .3)',
                      transition: 'background .2s',
                    }}
                  />
                ))}
              </span>
            </span>
          ) : null}
          <span style={{ flex: 1 }} />

          {/* 무작위 n곳 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 34,
              padding: '0 3px 0 10px',
              borderRadius: 9,
              background: 'white',
              boxShadow: 'inset 0 0 0 1px oklch(0.88 0.006 75)',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 650, color: 'oklch(0.4 0.012 60)', marginRight: 2 }}>
              무작위
            </span>
            <Stepper
              value={n}
              min={1}
              max={Math.max(1, Math.min(LIMITS.rollMax, pool))}
              onChange={setCount}
              disabled={busy}
            />
            <button
              type="button"
              className={busy || !pool ? '' : 'btn-accent'}
              disabled={busy || !pool}
              onClick={() => act({ type: 'roll', count: n })}
              style={{
                ...btn('accent', 28),
                marginLeft: 4,
                opacity: busy || !pool ? 0.45 : 1,
                cursor: busy || !pool ? 'not-allowed' : 'pointer',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  animation: roll?.active ? 'lp-spin .6s linear infinite' : 'none',
                }}
              >
                <IconDice size={15} />
              </span>
              곳 뽑기
            </button>
          </div>
        </div>

        {list.length ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))',
              gap: 12,
              paddingTop: 10, // 후보 체크 표시(-7px)가 위에 붙는 툴바에 가리지 않게
            }}
          >
            {shown.map(({ item: r, exiting }, i) => (
              <RestCard
                key={r.id}
                r={r}
                isCand={!!room.cands[r.id]}
                candBy={room.cands[r.id] ? memberOf(room, room.cands[r.id].by) : undefined}
                reason={room.reasons[r.id]}
                flash={roll?.flash === r.id}
                landed={!!roll?.landed.includes(r.id)}
                busy={busy}
                exiting={exiting}
                enterDelay={Math.min(i * 22, 420)}
                onToggle={() => act({ type: 'cand', restId: r.id })}
                onDislike={() => act({ type: 'dislike', restId: r.id })}
                onInfo={() => onInfo(r.id)}
              />
            ))}
          </div>
        ) : (
          <div
            className="lp-fade-up"
            style={{
              minHeight: 260,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: MUTED,
              fontSize: 13.5,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 30 }}>🙅</span>
            모든 식당이 가기 싫은 곳으로 빠졌어요.
            <span style={{ fontSize: 12.5, color: MUTED_2 }}>왼쪽 목록에서 내 표를 빼면 다시 돌아와요.</span>
            {room.order.length ? (
              <button
                type="button"
                className="btn-soft"
                onClick={() => act({ type: 'aiReset' })}
                style={btn('soft', 30)}
              >
                <IconUndo size={13} />
                AI 정렬 초기화
              </button>
            ) : null}
          </div>
        )}
      </div>

      <CandTray room={room} busy={busy} />
    </div>
  );
}
