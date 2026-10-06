/**
 * 오른쪽 — 참여자와 채팅. 무작위 뽑기·AI 정렬·확정 같은 일도 채팅에 한 줄씩 남는다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ChatMsg, Member, RoomState } from '../../share/protocol';
import { LIMITS } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, HAIRLINE, INK, MUTED, MUTED_2 } from '../../theme';
import {
  Avatar,
  IconCrown,
  IconDice,
  IconEdit,
  IconLadder,
  IconSend,
  IconSpark,
  IconCheck,
  IconUsers,
  INPUT_BORDER,
  avatarSoft,
  memberOf,
} from './parts';

const TYPING_SEND_MS = 2000;

const timeText = (at: number) =>
  new Date(at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

export default function ChatPanel({ room, me, isHost }: { room: RoomState; me: string; isHost: boolean }) {
  const act = useShare((s) => s.act);
  const kick = useShare((s) => s.kick);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastTyping = useRef(0);

  const members = [...room.members].sort(
    (a, b) =>
      Number(b.online) - Number(a.online) || Number(b.host) - Number(a.host) || a.joinedAt - b.joinedAt,
  );
  const online = members.filter((m) => m.online).length;
  const typing = room.members.filter((m) => m.typing && m.id !== me && m.online);

  // 맨 아래를 보고 있을 때만 새 메시지에 맞춰 내려간다.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
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
    stick.current = true;
    lastTyping.current = 0;
  };

  return (
    <div
      style={{
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `1px solid ${HAIRLINE}`,
        background: 'white',
      }}
    >
      {/* 참여자 */}
      <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${HAIRLINE}`, flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <IconUsers size={15} color={MUTED} />
          <span style={{ fontSize: 13.5, fontWeight: 750 }}>참여자</span>
          <span style={{ fontSize: 12.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
            {online}명{members.length > online ? ` · 나간 사람 ${members.length - online}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 156, overflow: 'auto' }}>
          {members.map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              me={me}
              canKick={isHost && !m.host && m.online}
              onKick={() => kick(m.id)}
            />
          ))}
        </div>
      </div>

      {/* 채팅 */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '12px 12px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {room.chat.length ? null : (
          <div
            style={{ margin: 'auto 0', textAlign: 'center', color: MUTED_2, fontSize: 12.5, lineHeight: 1.6 }}
          >
            함께 고르는 동안 자유롭게 얘기해요.
            <br />
            누가 뽑고 정렬했는지도 여기에 남아요.
          </div>
        )}
        {room.chat.map((m, i) => (
          <Bubble key={m.id} m={m} prev={room.chat[i - 1]} room={room} me={me} />
        ))}
        {typing.length ? (
          <div
            className="lp-fade-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: MUTED,
              padding: '2px 4px',
            }}
          >
            <span style={{ display: 'inline-flex', gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: MUTED_2,
                    animation: `lp-dot 1.1s ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </span>
            {typing.map((m) => m.name).join(', ')}님이 입력 중
          </div>
        ) : null}
      </div>

      <div style={{ padding: '8px 10px 12px', flex: 'none', display: 'flex', gap: 6 }}>
        <input
          className="inp"
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
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) send();
          }}
          placeholder="메시지 보내기"
          style={{
            flex: 1,
            minWidth: 0,
            height: 36,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 18,
            padding: '0 14px',
            font: 'inherit',
            fontSize: 13.5,
            outline: 'none',
          }}
        />
        <button
          type="button"
          aria-label="보내기"
          onClick={send}
          className={text.trim() ? 'btn-accent' : ''}
          style={{
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: '50%',
            background: text.trim() ? AC : 'oklch(0.92 0.006 75)',
            color: text.trim() ? 'white' : MUTED_2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'default',
            flex: 'none',
            transition: 'background .2s, transform .2s',
            transform: text.trim() ? 'none' : 'scale(.92)',
          }}
        >
          <IconSend size={16} />
        </button>
      </div>
    </div>
  );
}

function MemberRow({
  m,
  me,
  canKick,
  onKick,
}: {
  m: Member;
  me: string;
  canKick: boolean;
  onKick: () => void;
}) {
  return (
    <div
      className="tg-member lp-slide-left"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 30,
        padding: '0 4px',
        borderRadius: 7,
        opacity: m.online ? 1 : 0.5,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Avatar m={m} size={24} dim={!m.online} />
        <span
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: m.online ? 'oklch(0.66 0.16 150)' : 'oklch(0.78 0.01 60)',
            boxShadow: '0 0 0 2px white',
          }}
        />
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: m.id === me ? 700 : 550,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {m.name}
      </span>
      {m.host ? (
        <span title="호스트" style={{ color: 'oklch(0.65 0.14 75)', display: 'inline-flex' }}>
          <IconCrown size={13} stroke={2} />
        </span>
      ) : null}
      {m.id === me ? <span style={{ fontSize: 11, color: AC, fontWeight: 750 }}>나</span> : null}
      <span style={{ flex: 1 }} />
      {m.typing && m.id !== me ? <span style={{ fontSize: 11, color: MUTED_2 }}>입력 중…</span> : null}
      {canKick ? (
        <button
          type="button"
          className="tg-kick btn-ghost-danger"
          onClick={onKick}
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
          }}
        >
          내보내기
        </button>
      ) : null}
    </div>
  );
}

const SYS_ICON = {
  info: null,
  ai: <IconSpark size={12} />,
  pick: <IconDice size={12} />,
  ladder: <IconLadder size={12} />,
  final: <IconCheck size={12} stroke={2.6} />,
  edit: <IconEdit size={12} />,
} as const;

function Bubble({
  m,
  prev,
  room,
  me,
}: {
  m: ChatMsg;
  prev: ChatMsg | undefined;
  room: RoomState;
  me: string;
}) {
  if (m.kind === 'sys') {
    const strong = m.tone === 'final';
    return (
      <div className="lp-fade-up" style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            maxWidth: '100%',
            padding: '4px 10px',
            borderRadius: 11,
            background: strong ? 'oklch(0.95 0.04 150)' : 'oklch(0.965 0.005 75)',
            color: strong ? 'oklch(0.4 0.1 150)' : MUTED,
            fontSize: 11.5,
            fontWeight: strong ? 700 : 550,
            lineHeight: 1.45,
            textAlign: 'center',
          }}
        >
          {SYS_ICON[m.tone]}
          <span>{m.text}</span>
        </span>
      </div>
    );
  }
  const mine = m.from === me;
  const who = memberOf(room, m.from);
  const grouped = prev?.kind === 'chat' && prev.from === m.from && m.at - prev.at < 120000;
  return (
    <div
      className={mine ? 'lp-slide-left' : 'lp-slide-right'}
      style={{
        display: 'flex',
        flexDirection: mine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 6,
        marginTop: grouped ? -2 : 4,
      }}
    >
      {mine ? null : grouped ? <span style={{ width: 24, flex: 'none' }} /> : <Avatar m={who} size={24} />}
      <div
        style={{
          maxWidth: '78%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: mine ? 'flex-end' : 'flex-start',
          gap: 2,
        }}
      >
        {!mine && !grouped ? (
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 650, marginLeft: 2 }}>
            {who?.name ?? '나간 사람'}
          </span>
        ) : null}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 5,
            flexDirection: mine ? 'row-reverse' : 'row',
          }}
        >
          <span
            style={{
              padding: '7px 11px',
              borderRadius: 14,
              borderBottomRightRadius: mine ? 4 : 14,
              borderBottomLeftRadius: mine ? 14 : 4,
              background: mine ? AC : who ? avatarSoft(who.hue) : 'oklch(0.96 0.005 75)',
              color: mine ? 'white' : INK,
              fontSize: 13,
              lineHeight: 1.45,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              userSelect: 'text',
            }}
          >
            {m.text}
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: 'oklch(0.68 0.01 60)',
              flex: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeText(m.at)}
          </span>
        </div>
      </div>
    </div>
  );
}
