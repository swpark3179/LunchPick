/**
 * 도란식사 왼쪽 열 — 방에 올라온 식당. 누구든 식당을 올리거나(+ 식당 추가) 내 PC 에 저장해 둔 식당을
 * 골라 불러온다. 식당 줄을 누르면 정보(수정)가 열리고, '+ 선택지' 로 그 식당의 선택지를 만든다.
 */
import { priceRange } from '../../share/doran';
import type { RoomState } from '../../share/protocol';
import { AC, AINK, CH, MUTED, MUTED_3 } from '../../theme';
import { btnSoft } from '../together/parts';

/** 방금 고친 식당에 '수정됨' 을 붙여 두는 시간 */
const EDITED_MS = 20000;

export default function DoranRestColumn({
  room,
  lock,
  onAdd,
  onLibrary,
  onOpen,
  onChoice,
}: {
  room: RoomState;
  /** 확정·뽑기·하트 걸기·사다리 중이라 선택지를 만들 수 없다 */
  lock: boolean;
  onAdd: () => void;
  onLibrary: () => void;
  onOpen: (restId: string) => void;
  onChoice: (restId: string) => void;
}) {
  const now = Date.now();
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
      <div style={{ padding: '16px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 750 }}>식당</span>
            <span
              key={room.restaurants.length}
              style={{
                fontSize: 14,
                fontWeight: 760,
                color: AC,
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-block',
                animation: 'lp-pop .35s ease-out',
              }}
            >
              {room.restaurants.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 3, textWrap: 'pretty' }}>
            모두가 같이 올리고 고쳐요. 올라온 식당은 각자 PC에도 저장돼요.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="tg-accent"
            onClick={onAdd}
            style={{
              flex: 1,
              height: 34,
              border: 'none',
              borderRadius: 8,
              background: AC,
              color: 'white',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + 식당 추가
          </button>
          <button
            type="button"
            className="tg-soft"
            onClick={onLibrary}
            title="내 PC에 저장해 둔 식당 중 몇 곳만 골라 올려요"
            style={{ ...btnSoft(34, 10), fontSize: 12.5, whiteSpace: 'nowrap' }}
          >
            불러오기
          </button>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '2px 10px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {room.restaurants.length ? null : (
          <div
            style={{
              border: '1.5px dashed oklch(0.86 0.01 60)',
              borderRadius: 10,
              padding: '18px 14px',
              fontSize: 12.5,
              color: 'oklch(0.55 0.012 60)',
              lineHeight: 1.6,
              textAlign: 'center',
              textWrap: 'pretty',
            }}
          >
            아직 식당이 없어요.
            <br />
            ‘+ 식당 추가’로 메뉴와 가격을 적어 올리거나, 저장해 둔 식당을 불러오세요.
          </div>
        )}
        {room.restaurants.map((r) => {
          const n = room.choices.filter((c) => c.restId === r.id).length;
          const edited = now - (room.edited[r.id] ?? 0) < EDITED_MS;
          const range = priceRange(r);
          return (
            <div
              key={r.id}
              className="tg-card"
              role="button"
              tabIndex={0}
              title="식당 정보 · 고치기"
              onClick={() => onOpen(r.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpen(r.id);
              }}
              style={{
                background: 'white',
                borderRadius: 10,
                boxShadow: '0 0 0 1px oklch(0.91 0.006 75)',
                padding: '9px 10px 9px 12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                animation: 'lp-in .3s ease-out both',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: `oklch(0.62 0.15 ${CH[r.category] ?? 300})`,
                    flex: 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 720,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {r.name}
                </span>
                {edited ? (
                  <span style={{ fontSize: 10.5, fontWeight: 750, color: AINK, flex: 'none' }}>수정됨</span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: MUTED,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {[r.category, r.menus.length ? `메뉴 ${r.menus.length}` : '메뉴 없음', range]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span
                  style={{ flex: 1, fontSize: 11.5, color: n ? AINK : MUTED_3, fontWeight: n ? 700 : 500 }}
                >
                  {n ? `선택지 ${n}개` : '선택지 없음'}
                </span>
                <button
                  type="button"
                  className={lock ? '' : 'tg-soft'}
                  disabled={lock}
                  title={
                    lock
                      ? '지금은 선택지를 만들 수 없어요 (확정·뽑기·사다리·하트 걸기 중)'
                      : '이 식당으로 선택지 만들기'
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onChoice(r.id);
                  }}
                  style={{
                    ...btnSoft(26, 8),
                    fontSize: 12,
                    fontWeight: 650,
                    color: AINK,
                    opacity: lock ? 0.45 : 1,
                    cursor: lock ? 'default' : 'pointer',
                  }}
                >
                  + 선택지
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
