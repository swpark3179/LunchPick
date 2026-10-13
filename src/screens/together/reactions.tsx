/**
 * 채팅 리액션 — 남의 말풍선에 마우스를 올리면 뜨는 고르기 줄(ReactBar)과 말풍선 아래의 칩(ReactChips).
 * 칩에 마우스를 올리면 누른 사람이 보인다. 다는 것·떼는 것은 호스트가 처리한다(react Action, 토글).
 */
import { type ChatMsg, REACTION_KEYS, type ReactKey, type RoomState, shortName } from '../../share/protocol';
import { AINK } from '../../theme';
import { Avatar, memberOf } from './parts';

export const REACTIONS: Record<ReactKey, { glyph: string; label: string }> = {
  yes: { glyph: '⭕', label: '네' },
  no: { glyph: '❌', label: '아니요' },
  good: { glyph: '👍', label: '좋아요' },
  thanks: { glyph: '🙏', label: '고마워요' },
  smile: { glyph: '😊', label: '웃음' },
  wow: { glyph: '😮', label: '놀람' },
  oops: { glyph: '😅', label: '당황' },
  tear: { glyph: '😢', label: '눈물' },
  check: { glyph: '✅', label: '확인' },
};

/** Windows 의 컬러 이모지 글꼴을 먼저 쓴다 */
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

type ChatOnly = Extract<ChatMsg, { kind: 'chat' }>;

/** 마우스를 올리면 뜨는 리액션 고르기 줄. below 면 말풍선 아래에 띄운다 (맨 위 메시지가 잘리지 않게). */
export function ReactBar({
  m,
  me,
  below,
  onPick,
}: {
  m: ChatOnly;
  me: string;
  below: boolean;
  onPick: (k: ReactKey) => void;
}) {
  return (
    <div
      className="tg-react-bar"
      role="toolbar"
      aria-label="리액션 달기"
      style={{
        position: 'absolute',
        left: 26,
        ...(below ? { top: 'calc(100% - 4px)' } : { bottom: 'calc(100% - 6px)' }),
        zIndex: 5,
        display: 'flex',
        gap: 1,
        padding: 3,
        borderRadius: 15,
        background: 'white',
        boxShadow: '0 0 0 1px oklch(0.9 0.006 75), 0 6px 18px oklch(0.3 0.02 60 / .16)',
      }}
    >
      {REACTION_KEYS.map((k) => {
        const on = !!m.react?.[k]?.includes(me);
        return (
          <button
            key={k}
            type="button"
            className="tg-react-pick"
            aria-pressed={on}
            aria-label={REACTIONS[k].label}
            title={on ? `${REACTIONS[k].label} 취소` : REACTIONS[k].label}
            onClick={() => onPick(k)}
            style={{
              width: 24,
              height: 24,
              border: 'none',
              borderRadius: 12,
              padding: 0,
              background: on ? 'oklch(0.94 0.04 50)' : 'transparent',
              fontFamily: EMOJI_FONT,
              fontSize: 14.5,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {REACTIONS[k].glyph}
          </button>
        );
      })}
    </div>
  );
}

/** 말풍선 아래 리액션 칩 — 남의 메시지면 눌러서 내 리액션을 달거나 뗀다. 마우스를 올리면 누른 사람 목록. */
export function ReactChips({
  m,
  room,
  me,
  mine,
  onPick,
}: {
  m: ChatOnly;
  room: RoomState;
  me: string;
  /** 내 메시지면 칩을 누를 수 없고 오른쪽에 붙는다 */
  mine: boolean;
  onPick: (k: ReactKey) => void;
}) {
  const keys = REACTION_KEYS.filter((k) => m.react?.[k]?.length);
  if (!keys.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: mine ? 'flex-end' : 'flex-start',
        marginTop: 3,
      }}
    >
      {keys.map((k) => {
        const who = m.react![k]!;
        const on = who.includes(me);
        const names = who.map((id) =>
          id === me ? '나' : shortName(memberOf(room, id)?.name ?? '나간 사람'),
        );
        return (
          <span key={k} className="tg-react-chip" style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              type="button"
              disabled={mine}
              aria-label={`${REACTIONS[k].label} ${who.length} · ${names.join(', ')}`}
              aria-pressed={on}
              onClick={() => onPick(k)}
              style={{
                height: 22,
                padding: '0 7px 0 5px',
                border: 'none',
                borderRadius: 11,
                background: on ? 'oklch(0.95 0.035 50)' : 'oklch(0.965 0.004 75)',
                boxShadow: `inset 0 0 0 1px ${on ? 'oklch(0.84 0.07 50)' : 'oklch(0.9 0.006 75)'}`,
                color: on ? AINK : 'oklch(0.42 0.012 60)',
                font: 'inherit',
                fontSize: 11.5,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                cursor: mine ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                animation: 'lp-pop .3s ease-out',
              }}
            >
              <span style={{ fontFamily: EMOJI_FONT, fontSize: 12.5, lineHeight: 1 }}>
                {REACTIONS[k].glyph}
              </span>
              {who.length}
            </button>
            {/* 누른 사람 — 칩에 마우스를 올리면 보인다 */}
            <span
              className="tg-react-who"
              role="tooltip"
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                ...(mine ? { right: 0 } : { left: 0 }),
                zIndex: 6,
                minWidth: 120,
                maxWidth: 200,
                padding: '8px 10px',
                borderRadius: 9,
                background: 'oklch(0.26 0.012 60)',
                color: 'white',
                boxShadow: '0 8px 22px oklch(0.2 0.02 60 / .3)',
                flexDirection: 'column',
                gap: 5,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{ fontSize: 11.5, fontWeight: 750, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <span style={{ fontFamily: EMOJI_FONT }}>{REACTIONS[k].glyph}</span>
                {REACTIONS[k].label} · {who.length}명
              </span>
              {who.map((id, i) => (
                <span
                  key={id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                >
                  <Avatar m={memberOf(room, id)} size={16} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {names[i]}
                  </span>
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}
