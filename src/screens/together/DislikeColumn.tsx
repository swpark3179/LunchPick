/**
 * 왼쪽 — 가기 싫은 곳 (시안: 왼쪽: 가기 싫은 곳). 한 명이라도 빼면 가운데에서 빠지고,
 * 누가 뺐는지 모두가 같이 본다. 빠진 순서대로 쌓인다.
 */
import type { RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AINK, CH, MUTED } from '../../theme';
import { Avatar, IconInfo, memberOf, whoShort } from './parts';

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
  const items = room.exclOrder
    .map((id) => ({ r: room.restaurants.find((x) => x.id === id), who: room.dislikes[id] ?? [] }))
    .filter((x) => x.r && x.who.length);

  return (
    <div
      style={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'oklch(0.965 0.006 60)',
        borderRight: '1px solid oklch(0.91 0.006 75)',
      }}
    >
      <div style={{ padding: '16px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 750 }}>가기 싫은 곳</span>
          <span
            key={items.length}
            style={{
              minWidth: 22,
              height: 20,
              padding: '0 6px',
              borderRadius: 10,
              background: 'oklch(0.92 0.03 25)',
              color: 'oklch(0.45 0.15 25)',
              fontSize: 11.5,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontVariantNumeric: 'tabular-nums',
              animation: 'lp-pop .35s ease-out',
            }}
          >
            {items.length}
          </span>
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 4, textWrap: 'pretty' }}>
          한 명이라도 빼면 가운데 목록에서 빠져요. 누가 뺐는지 같이 보여요.
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '4px 12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {items.length ? null : (
          <div
            style={{
              border: '1.5px dashed oklch(0.86 0.01 60)',
              borderRadius: 10,
              padding: '18px 14px',
              fontSize: 12.5,
              color: 'oklch(0.55 0.012 60)',
              lineHeight: 1.55,
              textAlign: 'center',
            }}
          >
            카드의 <b style={{ color: 'oklch(0.5 0.17 25)' }}>⊘</b> 버튼으로
            <br />
            오늘 가기 싫은 곳을 빼 보세요
          </div>
        )}
        {items.map(({ r, who }) => {
          const mine = who.includes(me);
          const whoText =
            who.length > 1
              ? `${who.length}명이 싫대요`
              : `${who[0] === me ? '내가' : `${whoShort(room, me, who[0])}님이`} 뺐어요`;
          return (
            <div
              key={r!.id}
              style={{
                background: 'white',
                borderRadius: 9,
                boxShadow: '0 0 0 1px oklch(0.91 0.006 75)',
                padding: '10px 10px 9px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                animation: 'lp-left .4s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: `oklch(0.62 0.15 ${CH[r!.category] ?? 300})`,
                    flex: 'none',
                    opacity: 0.6,
                  }}
                />
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 650,
                    color: 'oklch(0.45 0.012 60)',
                    textDecoration: 'line-through',
                    textDecorationColor: 'oklch(0.5 0.17 25 / .6)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {r!.name}
                </span>
                <div
                  role="button"
                  tabIndex={0}
                  title="식당 정보"
                  className="tg-act"
                  onClick={() => onInfo(r!.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onInfo(r!.id);
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'oklch(0.6 0.01 60)',
                    cursor: 'pointer',
                    flex: 'none',
                  }}
                >
                  <IconInfo size={13} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex' }}>
                  {who.map((id) => (
                    <Avatar
                      key={id}
                      m={memberOf(room, id)}
                      size={20}
                      ring={2}
                      style={{ marginRight: -5, animation: 'lp-pop .35s ease-out both' }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: MUTED, paddingLeft: 6, whiteSpace: 'nowrap' }}>
                  {whoText}
                </span>
                <div style={{ flex: 1 }} />
                <div
                  role="button"
                  tabIndex={0}
                  className="tg-act"
                  onClick={() => act({ type: 'dislike', restId: r!.id })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') act({ type: 'dislike', restId: r!.id });
                  }}
                  style={{
                    height: 22,
                    padding: '0 8px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 650,
                    color: mine ? AINK : 'oklch(0.5 0.17 25)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {mine ? '내 표시 취소' : '나도 싫어요'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
