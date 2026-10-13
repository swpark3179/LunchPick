/**
 * 오른쪽 — 참여자와 채팅 (시안: 오른쪽: 참여자 + 채팅).
 * 참여자 아래에는 지금 보고 있는 카드가 보인다. 내가 식당 정보를 열어 둔 건 나만 안다.
 * 참여자 줄에 마우스를 올리면 '부르기'가 보인다 — 한 번 더 물은 뒤 그 사람 창을 맨 앞으로 띄운다.
 * 오른쪽 위의 '조용히'를 켜면 새 채팅이 와도 작업표시줄에서 깜박이지 않는다 (방 머리는 최소 창 폭에
 * 맞춰 꽉 차 있어서 이 열의 머리에 둔다).
 * 남의 말풍선에 마우스를 올리면 리액션 고르기 줄이 뜨고, 단 리액션은 말풍선 아래 칩으로 모두에게 보인다
 * (reactions.tsx). 점심 방·도란식사 방이 같이 쓴다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { hhmm } from '../../lib/util';
import { candLabel } from '../../share/doran';
import { type ChatMsg, LIMITS, type ReactKey, type RoomState, shortName } from '../../share/protocol';
import { useSettings } from '../../store/settingsStore';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, AINK, INK, MUTED, MUTED_3 } from '../../theme';
import {
  Avatar,
  btnAccent,
  btnSoft,
  IconBell,
  IconBellOff,
  IconRing,
  IconSend,
  INPUT_BORDER,
  memberOf,
} from './parts';
import { ReactBar, ReactChips } from './reactions';

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
  const callMember = useShare((s) => s.callMember);
  const focus = useShare((s) => s.focus);
  const [text, setText] = useState('');
  /** 부르기 확인창을 띄운 사람 */
  const [callFor, setCallFor] = useState<string | null>(null);
  const closeCall = useCallback(() => setCallFor(null), []);
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
  // 확인하는 사이에 나가면 확인창도 닫는다.
  const callTarget = callFor ? ppl.find((m) => m.id === callFor && m.id !== me) : undefined;
  // 점심은 식당, 도란식사는 선택지(보는 중)·식당(정보 보는 중)
  const rname = (id: string) => candLabel(room, id) || (room.restaurants.find((r) => r.id === id)?.name ?? '');
  const reactTo = (msgId: string) => (key: ReactKey) => act({ type: 'react', msgId, key });
  const lastMsg = room.chat[room.chat.length - 1];
  const lastReact = lastMsg?.kind === 'chat' ? JSON.stringify(lastMsg.react ?? {}) : '';

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [room.chat.length, typing.length]);

  // 맨 아래 말풍선에 리액션이 붙어 키가 커지면 — 맨 아래를 보고 있었을 때만 따라 내려간다.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !lastReact) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 90) el.scrollTop = el.scrollHeight;
  }, [lastReact]);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 750 }}>
            참여자{' '}
            <span style={{ color: 'oklch(0.5 0.012 60)', fontVariantNumeric: 'tabular-nums' }}>
              {ppl.length}
            </span>
          </span>
          <QuietToggle />
        </div>
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
              {!mine ? (
                <button
                  type="button"
                  className="tg-call"
                  title={`${shortName(p.name)}님 PC에서 점심픽 창을 맨 앞으로 띄워요`}
                  onClick={() => setCallFor(p.id)}
                  style={{
                    height: 22,
                    padding: '0 7px',
                    border: 'none',
                    borderRadius: 5,
                    background: 'transparent',
                    color: AINK,
                    font: 'inherit',
                    fontSize: 11.5,
                    fontWeight: 650,
                    cursor: 'pointer',
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <IconRing size={12} />
                  부르기
                </button>
              ) : null}
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
                className="tg-msg"
                style={{
                  position: 'relative',
                  marginTop: gap,
                  animation: 'lp-in .3s ease-out both',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5, width: '100%' }}>
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
                <ReactChips m={m} room={room} me={me} mine onPick={reactTo(m.id)} />
              </div>
            );
          return (
            <div
              key={m.id}
              className="tg-msg"
              style={{
                position: 'relative',
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
                <ReactChips m={m} room={room} me={me} mine={false} onPick={reactTo(m.id)} />
              </div>
              <ReactBar m={m} me={me} below={i === 0} onPick={reactTo(m.id)} />
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
      {callTarget ? (
        <CallConfirm
          name={shortName(callTarget.name)}
          onCancel={closeCall}
          onOk={() => {
            closeCall();
            callMember(callTarget.id);
          }}
        />
      ) : null}
    </div>
  );
}

/** 조용히 — 켜면 새 채팅이 와도 작업표시줄에서 깜박이지 않는다. 내 PC 에만 해당하고 설정에 남는다. */
function QuietToggle() {
  const quiet = useSettings((s) => s.quiet);
  const patch = useSettings((s) => s.patch);
  const flip = () => {
    patch({ quiet: !quiet });
    toast(quiet ? '새 채팅이 오면 작업표시줄에서 깜박여요' : '조용히 · 새 채팅이 와도 깜박이지 않아요');
  };
  return (
    <button
      type="button"
      className={quiet ? '' : 'tg-soft'}
      aria-pressed={quiet}
      onClick={flip}
      title={
        quiet
          ? '조용히 켜짐 — 새 채팅이 와도 작업표시줄에서 깜박이지 않아요 (부르기는 그대로 와요)'
          : '켜면 새 채팅이 와도 작업표시줄에서 깜박이지 않아요 (부르기는 그대로 와요)'
      }
      style={{
        height: 26,
        padding: '0 9px',
        border: `1px solid ${quiet ? 'oklch(0.86 0.05 50)' : 'oklch(0.88 0.006 75)'}`,
        borderRadius: 13,
        background: quiet ? 'oklch(0.965 0.025 50)' : 'white',
        color: quiet ? AINK : 'oklch(0.42 0.012 60)',
        font: 'inherit',
        fontSize: 12,
        fontWeight: quiet ? 700 : 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
        flex: 'none',
        transition: 'background .2s, color .2s, border-color .2s',
      }}
    >
      {quiet ? <IconBellOff size={13} /> : <IconBell size={13} />}
      조용히
    </button>
  );
}

/** 부르기 전에 한 번 더 묻는다 — 상대 화면에 창이 갑자기 튀어나오니 놀랄 수 있다. */
function CallConfirm({ name, onCancel, onOk }: { name: string; onCancel: () => void; onOk: () => void }) {
  // 방의 Esc(식당 정보·팝업 닫기)보다 먼저 받아서 이 창만 닫는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'oklch(0.22 0.012 60 / .4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'lp-in .2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-label={`${name}님 부르기`}
        style={{
          width: 380,
          maxWidth: '100%',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'lp-rise .4s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'oklch(0.965 0.025 50)',
              color: AC,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <IconRing size={18} />
          </span>
          <span style={{ fontSize: 16.5, fontWeight: 780 }}>{name}님을 부를까요?</span>
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: 'oklch(0.35 0.012 60)',
            lineHeight: 1.6,
            textWrap: 'pretty',
            wordBreak: 'keep-all',
          }}
        >
          {name}님 PC에서 점심픽 창이 <b style={{ fontWeight: 700 }}>맨 앞으로 튀어나와요</b>. 하던 일을
          가리게 되니 {name}님이 놀랄 수 있어요.
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>부른 건 채팅에 한 줄 남아요.</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
          <button type="button" className="tg-soft" onClick={onCancel} autoFocus style={btnSoft(36)}>
            취소
          </button>
          <button type="button" className="tg-accent" onClick={onOk} style={btnAccent(36, 18)}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
