/**
 * 가운데 — 남은 식당. 모두가 같은 순서·같은 후보를 본다 (시안: 가운데: 남은 식당).
 *
 * 카드는 절대 위치로 놓고 transform 으로 옮긴다 — AI 정렬로 순서가 바뀌면 미끄러지고,
 * 가기 싫은 곳으로 빠지면 그 자리에서 작아지며 사라진다. 무작위 뽑기의 스포트라이트와
 * 다른 사람이 보고 있는 카드의 이름표도 같은 좌표 위를 움직인다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Restaurant } from '../../lib/types';
import { restTags, TAG_LABEL } from '../../share/ai';
import { LIMITS, type RoomState, shortName } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, AINK, CARD_RING, CH, INK, MUTED, MUTED_3 } from '../../theme';
import CandTray from './CandTray';
import {
  Avatar,
  IconBan,
  IconCursor,
  IconDice,
  IconInfo,
  IconSpark,
  INPUT_BORDER,
  avBg,
  memberOf,
} from './parts';
import type { RollView } from './useRoomAnim';

const GAP = 12;
const CARD_H = 108;
const MIN_W = 220;
const TOP = 10;

type Pos = { x: number; y: number };

/** 호스트의 visible() 과 같은 순서 — AI 순서가 있으면 그 순서, 없으면 식당 목록 순서. */
export function boardOrder(room: RoomState): Restaurant[] {
  if (!room.order.length) return room.restaurants;
  const idx = new Map(room.order.map((id, i) => [id, i]));
  return [...room.restaurants].sort((a, b) => (idx.get(a.id) ?? 1e9) - (idx.get(b.id) ?? 1e9));
}

/** 내가 보낸 원문 — 내 화면에서만, 내 요청 칩의 툴팁으로 보여준다 (순서로 짝짓는다). */
const myPrompts: string[] = [];

export default function Board({
  room,
  me,
  roll,
  onInfo,
}: {
  room: RoomState;
  me: string;
  roll: RollView | null;
  onInfo: (id: string) => void;
}) {
  const act = useShare((s) => s.act);
  const sendFocus = useShare((s) => s.sendFocus);
  const focus = useShare((s) => s.focus);
  const role = useShare((s) => s.role);
  const [randN, setRandN] = useState(2);
  const [aiText, setAiText] = useState('');

  // ---------------------------------------------------------------- 자리 계산
  const gridRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = boardOrder(room);
  const vis = all.filter((r) => !room.dislikes[r.id]?.length);
  const width = W || 640;
  const cols = Math.max(1, Math.floor((width + GAP) / (MIN_W + GAP)));
  const cw = (width - GAP * (cols - 1)) / cols;
  const pos: Record<string, Pos> = {};
  vis.forEach((r, i) => {
    pos[r.id] = { x: (i % cols) * (cw + GAP), y: TOP + Math.floor(i / cols) * (CARD_H + GAP) };
  });
  // 빠진 카드는 마지막 자리에서 사라지게 한다.
  const lastPos = useRef<Record<string, Pos>>({});
  Object.assign(lastPos.current, pos);
  const gridH = TOP + Math.ceil(vis.length / cols) * (CARD_H + GAP) + 6;
  const rank = new Map(vis.map((r, i) => [r.id, i]));

  // ---------------------------------------------------------------- 무작위 · AI
  const spinning = !!roll || (!!room.roll && !room.roll.done);
  const lock = spinning || !!room.final;
  const pool = vis.filter((r) => !room.cands[r.id]).length;
  const n = Math.max(1, Math.min(randN, LIMITS.rollMax, Math.max(1, pool)));
  const pending = room.ai.filter((t) => t.status === 'queued' || t.status === 'running');
  const hostShort = shortName(room.members.find((m) => m.host)?.name ?? '호스트');

  const submitAi = () => {
    const t = aiText.trim();
    if (!t) return;
    myPrompts.push(t);
    act({ type: 'ai', prompt: t });
    setAiText('');
  };

  // ---------------------------------------------------------------- 이름표 (다른 사람이 보는 카드)
  const tagPos = useRef<Record<string, Pos>>({});
  const stack: Record<string, number> = {};
  const tags = room.members
    .filter((m) => m.id !== me && m.online)
    .map((m) => {
      const fid = focus[m.id];
      const p = fid ? pos[fid] : undefined;
      if (p && fid) {
        const k = (stack[fid] = (stack[fid] ?? 0) + 1) - 1;
        tagPos.current[m.id] = { x: p.x + cw - 58 - k * 50, y: p.y - 9 };
      }
      return { m, on: !!p, at: tagPos.current[m.id] ?? { x: 0, y: 0 } };
    });

  // 방을 떠나면 내 이름표를 거둔다.
  useEffect(() => () => sendFocus(null), [sendFocus]);

  const spot = roll?.cursor ? pos[roll.cursor] : undefined;

  return (
    <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{ flex: 'none', padding: '14px 18px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 760 }}>남은 식당</span>
              <span style={{ fontSize: 17, fontWeight: 760, color: AC, fontVariantNumeric: 'tabular-nums' }}>
                {vis.length}
              </span>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              카드를 누르면 후보로 올라가고, 한 번 더 누르면 내려와요. 모두에게 같이 보여요.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <Stepper
              value={n}
              min={1}
              max={Math.max(1, Math.min(LIMITS.rollMax, pool))}
              onChange={setRandN}
              w={30}
            />
            <button
              type="button"
              className={spinning ? '' : 'tg-dark'}
              onClick={() => !spinning && act({ type: 'roll', count: n })}
              style={{
                height: 36,
                padding: '0 14px',
                border: 'none',
                borderRadius: 8,
                background: INK,
                color: 'white',
                font: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                cursor: spinning ? 'default' : 'pointer',
                opacity: spinning ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <IconDice size={15} />
              {spinning ? '뽑는 중…' : `무작위 ${n}곳`}
            </button>
          </div>
        </div>

        {/* AI 입력 — 원문은 나만 보고 키워드만 공유된다 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 44,
            padding: '0 5px 0 12px',
            borderRadius: 10,
            background: 'white',
            boxShadow: `0 0 0 1px ${INPUT_BORDER}, 0 1px 3px oklch(0.5 0.02 60 / .06)`,
          }}
        >
          <IconSpark />
          <input
            value={aiText}
            maxLength={LIMITS.prompt}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitAi();
            }}
            placeholder="AI에게 오늘 땡기는 걸 말해보세요 — 원문은 나만 보고, 키워드만 공유돼요"
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              font: 'inherit',
              fontSize: 13.5,
              color: INK,
            }}
          />
          <button
            type="button"
            className="tg-accent"
            onClick={submitAi}
            style={{
              height: 34,
              padding: '0 14px',
              border: 'none',
              borderRadius: 7,
              background: AC,
              color: 'white',
              font: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              flex: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            AI로 정렬
          </button>
        </div>

        {/* AI 큐 — 들어온 순서대로 처리하고 결과는 앞 요청 위에 쌓인다 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 28 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, marginRight: 2 }}>AI 큐</span>
          {room.ai.length ? (
            room.ai.map((t) => (
              <AiChip
                key={t.id}
                room={room}
                me={me}
                turnId={t.id}
                queuePos={pending.findIndex((p) => p.id === t.id)}
              />
            ))
          ) : (
            <span style={{ fontSize: 12, color: MUTED_3 }}>
              요청이 들어온 순서대로 처리하고, 결과는 앞 요청 위에 쌓여요
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: 'oklch(0.55 0.012 60)', whiteSpace: 'nowrap' }}>
            {!room.aiReady
              ? `${role === 'host' ? '내 PC' : `${hostShort}님 PC`}에 AI 키가 없어 키워드로 정렬`
              : role === 'host'
                ? '내 FabriX로 처리'
                : `${hostShort}님 PC의 FabriX로 처리`}
          </span>
          {room.aiTurns > 0 ? (
            <span
              role="button"
              tabIndex={0}
              onClick={() => act({ type: 'aiReset' })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') act({ type: 'aiReset' });
              }}
              style={{ fontSize: 11.5, fontWeight: 650, color: AINK, cursor: 'pointer', padding: '2px 4px' }}
            >
              순서 초기화
            </span>
          ) : null}
        </div>
      </div>

      {/* ---------------------------------------------------------------- 카드 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 18px 18px' }}>
        <div
          ref={gridRef}
          className={spinning ? 'keep-motion' : undefined}
          onMouseLeave={() => sendFocus(null)}
          style={{ position: 'relative', height: gridH, transition: 'height .45s cubic-bezier(.2,.8,.2,1)' }}
        >
          {all.map((r) => (
            <Card
              key={r.id}
              r={r}
              room={room}
              me={me}
              p={pos[r.id] ?? lastPos.current[r.id] ?? { x: 0, y: TOP }}
              w={cw}
              roll={roll}
              lock={lock}
              rank={room.aiTurns ? rank.get(r.id) : undefined}
              onInfo={onInfo}
              onHover={() => sendFocus(r.id)}
            />
          ))}

          {/* 무작위 뽑기의 스포트라이트 — 카드 사이를 건너뛰다 당첨에서 멈춘다 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: cw,
              height: CARD_H,
              borderRadius: 11,
              transform: spot ? `translate(${spot.x}px, ${spot.y}px)` : `translate(0px, ${TOP}px)`,
              opacity: spot ? 1 : 0,
              pointerEvents: 'none',
              zIndex: 8,
              boxShadow: `0 0 0 3px ${AC}, 0 0 0 10px oklch(0.56 0.16 40 / .16), 0 16px 40px oklch(0.56 0.16 40 / .3)`,
              transition: 'transform .09s ease-out, opacity .3s',
            }}
          />

          {/* 다른 사람이 보고 있는 카드의 이름표 */}
          {tags.map(({ m, on, at }) => (
            <div
              key={m.id}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${at.x}px, ${at.y}px)`,
                opacity: on ? 1 : 0,
                zIndex: 9,
                pointerEvents: 'none',
                transition: 'transform .75s cubic-bezier(.2,.8,.2,1), opacity .3s',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                height: 19,
                padding: '0 7px 0 4px',
                borderRadius: 10,
                background: avBg(m.hue),
                color: 'white',
                fontSize: 10.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px oklch(0.3 0.02 60 / .25)',
              }}
            >
              <IconCursor />
              {shortName(m.name)}
            </div>
          ))}
        </div>
      </div>

      <CandTray room={room} me={me} lock={lock} onInfo={onInfo} />
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'oklch(0.62 0.01 60)',
  flex: 'none',
  cursor: 'pointer',
};

function Card({
  r,
  room,
  me,
  p,
  w,
  roll,
  lock,
  rank,
  onInfo,
  onHover,
}: {
  r: Restaurant;
  room: RoomState;
  me: string;
  p: Pos;
  w: number;
  roll: RollView | null;
  lock: boolean;
  rank: number | undefined;
  onInfo: (id: string) => void;
  onHover: () => void;
}) {
  const act = useShare((s) => s.act);
  const ex = !!room.dislikes[r.id]?.length;
  const cand = room.cands[r.id];
  const landed = !!roll?.landed.includes(r.id);
  const cur = roll?.cursor === r.id;
  const fin = room.final?.restId === r.id;
  const scl = ex ? 0.86 : landed ? 1.03 : 1;
  const op = ex ? 0 : roll && !landed && !cur && !cand ? 0.45 : 1;
  const ring = fin
    ? '0 0 0 2.5px oklch(0.55 0.13 150), 0 10px 28px oklch(0.55 0.13 150 / .22)'
    : landed
      ? `0 0 0 3px ${AC}, 0 12px 30px oklch(0.56 0.16 40 / .3)`
      : cand
        ? `0 0 0 2px ${AC}, 0 6px 18px oklch(0.56 0.16 40 / .14)`
        : CARD_RING;
  const d = room.delta?.map[r.id] ?? 0;
  const by = cand ? memberOf(room, cand.by) : undefined;
  const toggle = () => !lock && act({ type: 'cand', restId: r.id });

  return (
    <div
      role="button"
      tabIndex={ex ? -1 : 0}
      aria-pressed={!!cand}
      className={`tg-card ${cand ? 'is-cand' : ''} ${lock ? 'is-lock' : ''}`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
      onMouseEnter={onHover}
      onFocus={onHover}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: CARD_H,
        transform: `translate(${p.x}px, ${p.y}px) scale(${scl})`,
        opacity: op,
        pointerEvents: ex || roll ? 'none' : 'auto',
        zIndex: landed || cand ? 2 : 1,
        background: cand || landed ? 'oklch(0.985 0.014 50)' : 'white',
        boxShadow: ring,
        borderRadius: 11,
        padding: '11px 10px 10px 14px',
        cursor: lock ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: `oklch(0.62 0.15 ${CH[r.category] ?? 300})`,
            flex: 'none',
          }}
        />
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 720,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {r.name}
        </span>
        {/* AI 정렬로 오르내린 칸 수 — 잠시 보였다가 사라진다 */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: d > 0 ? 'oklch(0.5 0.13 150)' : 'oklch(0.55 0.1 25)',
            opacity: d ? 1 : 0,
            transition: 'opacity .5s',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        <div
          role="button"
          tabIndex={-1}
          title="가기 싫어요"
          className="tg-icon-no"
          onClick={(e) => {
            e.stopPropagation();
            act({ type: 'dislike', restId: r.id });
          }}
          style={iconBtn}
        >
          <IconBan size={15} />
        </div>
        <div
          role="button"
          tabIndex={-1}
          title="식당 정보 (나만 보기)"
          className="tg-icon"
          onClick={(e) => {
            e.stopPropagation();
            onInfo(r.id);
          }}
          style={{ ...iconBtn, marginLeft: -4 }}
        >
          <IconInfo size={15} />
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: MUTED,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingRight: 6,
        }}
      >
        {r.category} ·{' '}
        {r.menus.length
          ? r.menus
              .slice(0, 2)
              .map((m) => m.name)
              .join(', ')
          : '메뉴 미등록'}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: 2 }}>
        {cand ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              height: 22,
              padding: '0 9px 0 3px',
              borderRadius: 11,
              background: AC,
              color: 'white',
              fontSize: 11.5,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              animation: 'lp-pop .4s cubic-bezier(.2,.9,.3,1.4) both',
            }}
          >
            <Avatar m={by} size={16} ring={1.5} />
            후보 · {cand.by === me ? '나' : shortName(by?.name ?? '누군가')}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, minWidth: 0, overflow: 'hidden' }}>
            {restTags(r).map((t) => {
              const hit = room.aiTags.includes(t);
              return (
                <span
                  key={t}
                  style={{
                    fontSize: 11.5,
                    color: hit ? AINK : MUTED_3,
                    fontWeight: hit ? 700 : 500,
                    whiteSpace: 'nowrap',
                    transition: 'color .4s',
                  }}
                >
                  {TAG_LABEL[t]}
                </span>
              );
            })}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {rank !== undefined && rank < 3 && !ex ? (
          <span
            title={room.reasons[r.id]}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 20,
              padding: '0 7px',
              borderRadius: 6,
              background: 'oklch(0.965 0.025 50)',
              color: AINK,
              fontSize: 11,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              flex: 'none',
              animation: 'lp-pop .4s ease-out both',
            }}
          >
            AI {rank + 1}위
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AiChip({
  room,
  me,
  turnId,
  queuePos,
}: {
  room: RoomState;
  me: string;
  turnId: string;
  queuePos: number;
}) {
  const t = room.ai.find((x) => x.id === turnId)!;
  const m = memberOf(room, t.by);
  const run = t.status === 'running';
  const done = t.status === 'done';
  const failed = t.status === 'failed';
  const mine = room.ai.filter((x) => x.by === me);
  const raw = t.by === me ? myPrompts[myPrompts.length - mine.length + mine.indexOf(t)] : undefined;
  const kw = t.keywords.length
    ? t.keywords.map((k) => `#${k}`).join(' ')
    : run || t.status === 'queued'
      ? '키워드 분석 중'
      : '#조건 없음';
  const st = run
    ? '정렬 중…'
    : done
      ? t.moved
        ? `✓ ${t.moved}곳 이동`
        : '변화 없음'
      : failed
        ? '못 했어요'
        : `대기 ${Math.max(1, queuePos)}`;
  return (
    <div
      title={[raw ? `내 원문(나만 보임): ${raw}` : '원문은 공개되지 않아요', t.note ?? '']
        .filter(Boolean)
        .join('\n')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px 0 3px',
        borderRadius: 14,
        // 정렬 중에만 빛이 훑고 지나간다. shorthand(background)를 쓰면 상태가 바뀔 때
        // backgroundSize 가 풀려 버리므로 따로 지정한다.
        backgroundColor: done ? 'white' : 'oklch(0.97 0.004 75)',
        backgroundImage: run
          ? 'linear-gradient(90deg, oklch(0.97 0.02 50) 0%, oklch(0.92 0.06 50) 50%, oklch(0.97 0.02 50) 100%)'
          : 'none',
        backgroundSize: '200% 100%',
        boxShadow: `inset 0 0 0 1px ${run ? 'oklch(0.8 0.08 50)' : 'oklch(0.9 0.006 75)'}`,
        fontSize: 12,
        animation: run ? 'lp-shimmer 1.3s linear infinite' : 'lp-pop .35s ease-out both',
        whiteSpace: 'nowrap',
        transition: 'box-shadow .3s',
        opacity: failed ? 0.6 : 1,
      }}
    >
      <Avatar m={m} size={22} />
      <span style={{ fontWeight: 700, color: t.keywords.length ? AINK : MUTED_3 }}>{kw}</span>
      <span
        style={{ fontSize: 11, fontWeight: 650, color: run ? AINK : done ? 'oklch(0.45 0.1 150)' : MUTED_3 }}
      >
        {st}
      </span>
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  h = 36,
  w = 28,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  h?: number;
  w?: number;
}) {
  const v = Math.max(min, Math.min(max, value));
  const btn = (on: boolean): React.CSSProperties => ({
    width: w,
    height: h,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: on ? 'pointer' : 'default',
    fontSize: 16,
    color: on ? 'oklch(0.5 0.012 60)' : 'oklch(0.78 0.006 60)',
    userSelect: 'none',
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: h,
        borderRadius: 8,
        boxShadow: `inset 0 0 0 1px ${INPUT_BORDER}`,
        background: 'white',
      }}
    >
      <div
        role="button"
        aria-label="줄이기"
        tabIndex={0}
        onClick={() => v > min && onChange(v - 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v > min) onChange(v - 1);
        }}
        style={btn(v > min)}
      >
        −
      </div>
      <span
        key={v}
        style={{
          minWidth: 18,
          textAlign: 'center',
          fontWeight: 750,
          fontVariantNumeric: 'tabular-nums',
          animation: 'lp-pop .3s ease-out',
        }}
      >
        {v}
      </span>
      <div
        role="button"
        aria-label="늘리기"
        tabIndex={0}
        onClick={() => v < max && onChange(v + 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v < max) onChange(v + 1);
        }}
        style={btn(v < max)}
      >
        +
      </div>
    </div>
  );
}
