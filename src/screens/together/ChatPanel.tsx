/**
 * 오른쪽 — 참여자와 채팅 (시안: 오른쪽: 참여자 + 채팅).
 * 참여자 아래에는 지금 보고 있는 카드가 보인다. 내가 식당 정보를 열어 둔 건 나만 안다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { hhmm } from '../../lib/util';
import { type ChatMsg, LIMITS, type RoomState, shortName } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, INK, MUTED_3 } from '../../theme';
import { Avatar, IconSend, INPUT_BORDER, memberOf } from './parts';

const TYPING_SEND_MS = 2000;

const MINUTE = 60000;

/** 같은 사람이 같은 분에 이어 보낸 말풍선 묶음의 마지막에만 시각을 단다. */
const showTime = (m: ChatMsg, next: ChatMsg | undefined) =>
  m.kind === 'chat' &&
  !(
    next?.kind === 'chat' &&
    next.from === m.from &&
    Math.floor(next.at / MINUTE) === Math.floor(m.at / MINUTE)
  );

/** 말풍선 옆의 작은 시각 */
function Time({ at }: { at: number }) {
  return (
    <span
      style={{
        alignSelf: 'flex-end',
        flex: 'none',
        fontSize: 10.5,
        lineHeight: 1.2,
        color: MUTED_3,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        paddingBottom: 1,
      }}
    >
      {hhmm(at)}
    </span>
  );
}

export default function ChatPanel({
  room,
  me,
  host,
  detail,
}: {
  room: RoomState;
  me: string;
  host: boolean;
  detail: string | null;
}) {
  const act = useShare((s) => s.act);
  const kick = useShare((s) => s.kick);
  const focus = useShare((s) => s.focus);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);

  // 호스트를 맨 위, 그다음 나, 나머지는 들어온 순서
  const ppl = [...room.members]
    .filter((m) => m.online)
    .sort(
      (a, b) =>
        Number(b.host) - Number(a.host) ||
        Number(b.id === me) - Number(a.id === me) ||
        a.joinedAt - b.joinedAt,
    );
  const typing = room.members.filter((m) => m.typing && m.id !== me && m.online);
  const rname = (id: string) => room.restaurants.find((r) => r.id === id)?.name ?? '';

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [room.chat.length, typing.length]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    act({ type: 'chat', text: t });
    setText('');
    lastTyping.current = 0;
  };

  let prev: (typeof room.chat)[number] | null = null;

  return (
    <div
      style={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid oklch(0.91 0.006 75)',
        background: 'white',
      }}
    >
      <div
        style={{
          flex: 'none',
          padding: '14px 16px 12px',
          borderBottom: '1px solid oklch(0.93 0.005 75)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 260,
          overflow: 'auto',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 750 }}>
          참여자{' '}
          <span style={{ color: 'oklch(0.5 0.012 60)', fontVariantNumeric: 'tabular-nums' }}>
            {ppl.length}
          </span>
        </span>
        {ppl.map((p) => {
          const mine = p.id === me;
          const f = !mine && focus[p.id] && !room.dislikes[focus[p.id]]?.length ? focus[p.id] : null;
          const sub = mine
            ? detail
              ? `‘${rname(detail)}’ 정보 보는 중 · 비공개`
              : '같이 보는 중'
            : p.typing
              ? '입력 중…'
              : f
                ? `보는 중 · ${rname(f)}`
                : '같이 보는 중';
          return (
            <div
              key={p.id}
              className="tg-member"
              style={{ display: 'flex', alignItems: 'center', gap: 9, animation: 'lp-in .35s ease-out both' }}
            >
              <div style={{ position: 'relative', flex: 'none' }}>
                <Avatar m={p} size={28} />
                <span
                  style={{
                    position: 'absolute',
                    right: -1,
                    bottom: -1,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: 'oklch(0.62 0.15 150)',
                    boxShadow: '0 0 0 2px white',
                  }}
                />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 650 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mine ? `${p.name} (나)` : p.name}
                  </span>
                  {p.host ? (
                    <span
                      style={{
                        height: 17,
                        padding: '0 5px',
                        borderRadius: 5,
                        background: 'oklch(0.96 0.04 75)',
                        color: 'oklch(0.5 0.12 70)',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        flex: 'none',
                      }}
                    >
                      호스트
                    </span>
                  ) : null}
                </div>
                <div
                  key={sub}
                  style={{
                    fontSize: 11.5,
                    color: 'oklch(0.55 0.012 60)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    animation: 'lp-in .25s ease-out',
                  }}
                >
                  {sub}
                </div>
              </div>
              {host && !p.host ? (
                <button
                  type="button"
                  className="tg-kick tg-danger"
                  onClick={() => kick(p.id)}
                  style={{
                    height: 22,
                    padding: '0 7px',
                    border: 'none',
                    borderRadius: 5,
                    background: 'transparent',
                    color: 'oklch(0.5 0.17 25)',
                    font: 'inherit',
                    fontSize: 11.5,
                    fontWeight: 650,
                    cursor: 'pointer',
                    flex: 'none',
                  }}
                >
                  내보내기
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        ref={listRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {room.chat.map((m, i) => {
          const p = prev;
          prev = m;
          const time = showTime(m, room.chat[i + 1]) ? <Time at={m.at} /> : null;
          const sys = m.kind === 'sys';
          const same = !sys && p !== null && p.kind === 'chat' && m.kind === 'chat' && p.from === m.from;
          const gap = p ? (same ? 4 : 10) : 0;
          if (m.kind === 'sys')
            return (
              <div key={m.id} style={{ marginTop: gap, animation: 'lp-in .3s ease-out both' }}>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'oklch(0.55 0.012 60)',
                    textAlign: 'center',
                    lineHeight: 1.45,
                    padding: '2px 8px',
                    textWrap: 'pretty',
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          const who = memberOf(room, m.from);
          if (m.from === me)
            return (
              <div
                key={m.id}
                style={{
                  marginTop: gap,
                  animation: 'lp-in .3s ease-out both',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 5,
                }}
              >
                {time}
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.45,
                    background: AC,
                    color: 'white',
                    padding: '7px 11px',
                    borderRadius: '12px 4px 12px 12px',
                    maxWidth: '80%',
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                    userSelect: 'text',
                  }}
                >
                  {m.text}
                </span>
              </div>
            );
          return (
            <div
              key={m.id}
              style={{
                marginTop: gap,
                animation: 'lp-in .3s ease-out both',
                display: 'flex',
                gap: 7,
                alignItems: 'flex-start',
              }}
            >
              <Avatar m={who} size={24} style={{ visibility: same ? 'hidden' : 'visible' }} />
              {/* 시각이 옆에 붙어도 말풍선 폭은 예전(80%)만큼 쓴다 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 0,
                  maxWidth: 'calc(80% + 34px)',
                }}
              >
                {same ? null : (
                  <span style={{ fontSize: 11, fontWeight: 650, color: 'oklch(0.42 0.012 60)' }}>
                    {shortName(who?.name ?? '나간 사람')}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 5, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      lineHeight: 1.45,
                      background: 'oklch(0.955 0.005 75)',
                      padding: '7px 11px',
                      borderRadius: '4px 12px 12px 12px',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                      userSelect: 'text',
                    }}
                  >
                    {m.text}
                  </span>
                  {time}
                </div>
              </div>
            </div>
          );
        })}
        {typing.length ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginTop: 10,
              fontSize: 11.5,
              color: 'oklch(0.55 0.012 60)',
              animation: 'lp-in .25s ease-out',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 3,
                padding: '8px 10px',
                borderRadius: 12,
                background: 'oklch(0.955 0.005 75)',
              }}
            >
              {[0, 0.15, 0.3].map((d) => (
                <span
                  key={d}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'oklch(0.5 0.012 60)',
                    animation: `lp-dot 1s ${d}s infinite`,
                  }}
                />
              ))}
            </div>
            {typing.map((m) => shortName(m.name)).join(', ')}님이 입력 중
          </div>
        ) : null}
      </div>

      <div
        style={{
          flex: 'none',
          padding: '10px 12px 12px',
          borderTop: '1px solid oklch(0.93 0.005 75)',
          display: 'flex',
          gap: 6,
        }}
      >
        <input
          className="tg-input"
          value={text}
          maxLength={LIMITS.chat}
          onChange={(e) => {
            setText(e.target.value);
            const now = Date.now();
            if (e.target.value && now - lastTyping.current > TYPING_SEND_MS) {
              lastTyping.current = now;
              act({ type: 'typing' });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="메시지 보내기"
          style={{
            flex: 1,
            minWidth: 0,
            height: 38,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 8,
            padding: '0 11px',
            font: 'inherit',
            fontSize: 13.5,
            outline: 'none',
            background: 'white',
            color: INK,
          }}
        />
        <button
          type="button"
          title="보내기"
          className="tg-accent"
          onClick={send}
          style={{
            width: 38,
            height: 38,
            border: 'none',
            borderRadius: 8,
            background: AC,
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <IconSend size={16} />
        </button>
      </div>
    </div>
  );
}
