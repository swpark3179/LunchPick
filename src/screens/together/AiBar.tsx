/**
 * AI 정렬. 원문은 호스트의 AI 에만 가고, 다른 사람에게는 키워드만 보인다.
 * 여러 사람이 보내면 들어온 순서대로 대기열에 쌓여 하나의 대화로 이어서 반영된다.
 */
import { useState } from 'react';

import { LIMITS, type AiTurn, type RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, AINK, MUTED, MUTED_2, PANEL_RING } from '../../theme';
import { Avatar, IconSpark, IconUndo, INPUT_BORDER, Spinner, btn, memberOf } from './parts';

/** 내가 보낸 원문 — 내 화면에서만, 내 요청 칩에 툴팁으로 보여준다. */
const myPrompts: string[] = [];

export default function AiBar({ room, me }: { room: RoomState; me: string }) {
  const act = useShare((s) => s.act);
  const [text, setText] = useState('');
  const pending = room.ai.filter((t) => t.status === 'queued' || t.status === 'running');
  const full = pending.length >= LIMITS.aiPending;

  const send = () => {
    const p = text.trim();
    if (!p || full) return;
    myPrompts.push(p);
    act({ type: 'ai', prompt: p });
    setText('');
  };

  // 내 요청 칩과 원문을 순서로 짝짓는다.
  const mine = room.ai.filter((t) => t.by === me);
  const promptOf = (t: AiTurn) => {
    const i = mine.indexOf(t);
    const offset = myPrompts.length - mine.length;
    return i >= 0 ? myPrompts[offset + i] : undefined;
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: PANEL_RING,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            flex: 'none',
            background: 'linear-gradient(135deg, oklch(0.62 0.16 40), oklch(0.6 0.15 320))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconSpark size={16} stroke={2} />
        </span>
        <input
          className="inp"
          value={text}
          maxLength={LIMITS.prompt}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) send();
          }}
          placeholder="AI에게 오늘 땡기는 걸 말해 보세요 — 예: 비 와서 뜨끈한 국물, 매운 건 빼고"
          style={{
            flex: 1,
            minWidth: 0,
            height: 36,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 8,
            padding: '0 12px',
            font: 'inherit',
            fontSize: 13.5,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || full}
          style={{
            ...btn('ink', 36),
            opacity: !text.trim() || full ? 0.45 : 1,
            cursor: full ? 'not-allowed' : 'pointer',
          }}
        >
          AI로 정렬
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 26 }}>
        {room.ai.length ? (
          room.ai.map((t, i) => (
            <TurnChip
              key={t.id}
              t={t}
              room={room}
              me={me}
              n={i}
              prompt={promptOf(t)}
              queuePos={pending.indexOf(t)}
            />
          ))
        ) : (
          <span style={{ fontSize: 12, color: MUTED_2 }}>
            {room.aiReady
              ? '원문은 호스트의 AI에만 전달되고, 다른 사람에게는 주요 키워드만 보여요. 여러 명이 보내면 순서대로 이어서 반영해요.'
              : '호스트 PC에 AI 키가 없어 키워드로 간단히 정렬해요. 원문은 다른 사람에게 보이지 않아요.'}
          </span>
        )}
        {room.order.length ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => act({ type: 'aiReset' })}
            title="AI 대화와 정렬을 처음으로 되돌려요"
            style={{ ...btn('ghost', 26), marginLeft: 'auto', color: MUTED, fontSize: 12 }}
          >
            <IconUndo size={13} />
            처음 순서로
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TurnChip({
  t,
  room,
  me,
  n,
  prompt,
  queuePos,
}: {
  t: AiTurn;
  room: RoomState;
  me: string;
  n: number;
  prompt?: string;
  queuePos: number;
}) {
  const m = memberOf(room, t.by);
  const running = t.status === 'running';
  const queued = t.status === 'queued';
  const failed = t.status === 'failed';
  const title = [
    `${m?.name ?? '누군가'}님의 요청`,
    t.by === me && prompt ? `내가 보낸 말: ${prompt}` : '',
    t.note ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {n > 0 ? <span style={{ color: 'oklch(0.78 0.01 60)', fontSize: 12 }}>›</span> : null}
      <span
        className="lp-pop"
        title={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 26,
          padding: '0 9px 0 3px',
          borderRadius: 13,
          background: running
            ? 'oklch(0.96 0.03 250)'
            : failed
              ? 'oklch(0.96 0.01 60)'
              : 'oklch(0.97 0.02 50)',
          boxShadow: running ? 'inset 0 0 0 1px oklch(0.75 0.1 250)' : 'inset 0 0 0 1px oklch(0.9 0.02 50)',
          fontSize: 12,
          fontWeight: 650,
          color: failed ? MUTED : AINK,
          opacity: failed ? 0.7 : 1,
          transition: 'background .3s, box-shadow .3s',
        }}
      >
        <Avatar m={m} size={20} />
        {t.keywords.length ? (
          t.keywords.map((k, i) => (
            <span key={k} className="lp-blur-in" style={{ animationDelay: `${i * 120}ms` }}>
              #{k}
            </span>
          ))
        ) : queued || running ? (
          <span
            className="lp-skeleton"
            style={{ width: 56, height: 10, borderRadius: 5, display: 'inline-block' }}
            aria-label="키워드 분석 중"
          />
        ) : (
          <span>#요청</span>
        )}
        {running ? (
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'oklch(0.5 0.13 250)' }}
          >
            <Spinner size={11} />
            정렬 중
          </span>
        ) : queued ? (
          <span style={{ color: MUTED, fontWeight: 600 }}>{queuePos > 0 ? `대기 ${queuePos}` : '대기'}</span>
        ) : t.note && !failed ? (
          <span style={{ color: MUTED_2, fontWeight: 600 }} title={t.note}>
            키워드
          </span>
        ) : null}
        {t.by === me ? (
          <span style={{ fontSize: 10.5, color: AC, fontWeight: 750, marginLeft: -1 }}>나</span>
        ) : null}
      </span>
    </span>
  );
}
