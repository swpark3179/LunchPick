/**
 * 왼쪽 — 가기 싫은 곳. 누가 싫다고 했는지 모두가 같이 본다.
 * 눌러서 내 표를 빼거나 더할 수 있고, 표가 하나도 없으면 가운데로 돌아간다.
 */
import { useRef } from 'react';

import type { RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AINK, HAIRLINE, MUTED, MUTED_2, catDot } from '../../theme';
import { AvatarStack, IconThumbDown, IconUndo, memberOf, useExiting, useFlip } from './parts';

export default function DislikeColumn({
  room,
  me,
  onInfo,
}: {
  room: RoomState;
  me: string;
  onInfo: (id: string) => void;
}) {
  const act = useShare((s) => s.act);
  const listRef = useRef<HTMLDivElement>(null);
  const items = room.restaurants
    .filter((r) => room.dislikes[r.id]?.length)
    .map((r) => ({ r, who: room.dislikes[r.id] }));
  const shown = useExiting(items, (x) => x.r.id, 240);
  useFlip(listRef, 380);

  return (
    <div
      style={{
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${HAIRLINE}`,
        background: 'oklch(0.965 0.005 75)',
      }}
    >
      <div style={{ padding: '16px 14px 10px', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: 'oklch(0.5 0.14 25)', display: 'inline-flex' }}>
            <IconThumbDown size={16} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 750 }}>가기 싫은 곳</span>
          <span
            key={items.length}
            className="lp-pop"
            style={{ fontSize: 12.5, color: MUTED, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}
          >
            {items.length}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: MUTED_2, marginTop: 5, lineHeight: 1.5 }}>
          카드의 &lsquo;싫어요&rsquo;를 누르면 여기로 빠져요. 다시 누르면 내 표만 빠지고, 아무도 싫어하지
          않으면 가운데로 돌아가요.
        </div>
      </div>

      <div ref={listRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto', padding: '2px 10px 14px' }}>
        {shown.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map(({ item: { r, who }, exiting }) => {
              const mine = who.includes(me);
              return (
                <div
                  key={r.id}
                  data-flip={exiting ? undefined : r.id}
                  role="button"
                  tabIndex={0}
                  className={`tg-dis ${exiting ? 'lp-card-out' : 'lp-slide-left'}`}
                  onClick={() => act({ type: 'dislike', restId: r.id })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') act({ type: 'dislike', restId: r.id });
                  }}
                  title={mine ? '눌러서 내 싫어요를 빼요' : '눌러서 나도 싫어요'}
                  style={{
                    background: 'white',
                    borderRadius: 9,
                    padding: '9px 10px',
                    boxShadow: '0 0 0 1px oklch(0.91 0.006 75)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: catDot(r.category),
                        flex: 'none',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 650,
                        textDecoration: 'line-through',
                        textDecorationColor: 'oklch(0.6 0.12 25 / .55)',
                        color: 'oklch(0.38 0.012 60)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {r.name}
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      title="메뉴·전화번호 보기 (나만 보여요)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInfo(r.id);
                      }}
                      style={{ fontSize: 11.5, color: MUTED_2, fontWeight: 600, flex: 'none' }}
                    >
                      정보
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AvatarStack members={who.map((id) => memberOf(room, id))} size={18} max={5} />
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 11.5,
                        fontWeight: 650,
                        color: mine ? AINK : MUTED,
                      }}
                    >
                      {mine ? (
                        <>
                          <IconUndo size={12} />
                          {who.length > 1 ? '내 표 빼기' : '되돌리기'}
                        </>
                      ) : (
                        '나도 싫어요'
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="lp-fade-up"
            style={{
              marginTop: 18,
              padding: '22px 12px',
              borderRadius: 10,
              border: '1.5px dashed oklch(0.86 0.008 75)',
              color: MUTED_2,
              fontSize: 12.5,
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            아직 없어요.
            <br />
            오늘 내키지 않는 곳을 빼 보세요.
          </div>
        )}
      </div>
    </div>
  );
}
