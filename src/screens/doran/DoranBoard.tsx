/**
 * 도란식사 가운데 — 총사용금액 · 도구(무작위 n개 남기기 · 사다리 · 하트 걸기) · 선택지 카드.
 *
 * 선택지는 만들면 바로 '남은 선택지'(후보)다. 빼면 아래 '빠진 선택지'로 내려가고 다시 넣을 수 있다.
 * 카드마다 합계(가격 미정 메뉴가 끼면 + α)와 총사용금액 대비 남음/딱 맞음/초과가 보인다.
 * 마우스를 올린 카드는 다른 사람 화면에 '보는 중'으로 보인다.
 */
import { useEffect, useRef, useState } from 'react';

import { budgetFit, choiceName, type Fit, moneyOf, moneyText } from '../../share/doran';
import { type Choice, LIMITS, type RoomState, shortName } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, AINK, CARD_RING, INK, MUTED, MUTED_3 } from '../../theme';
import { Stepper } from '../together/Board';
import { itemOf } from '../together/items';
import {
  Avatar,
  AvatarStack,
  btnAccent,
  btnSoft,
  IconCheck,
  IconDice,
  IconHeart,
  IconInfo,
  IconLadder,
  INPUT_BORDER,
  memberOf,
} from '../together/parts';
import type { RollView } from '../together/useRoomAnim';
import { CodeBadge, FitBadge, moneyInput, moneyValue } from './ui';

/** 카드에 보여 줄 메뉴 줄 수 */
const ITEM_LINES = 4;

export default function DoranBoard({
  room,
  me,
  roll,
  onNew,
  onEdit,
  onInfo,
}: {
  room: RoomState;
  me: string;
  roll: RollView | null;
  /** 선택지 만들기 (식당은 고르는 창에서) */
  onNew: () => void;
  onEdit: (choiceId: string) => void;
  onInfo: (restId: string) => void;
}) {
  const act = useShare((s) => s.act);
  const sendFocus = useShare((s) => s.sendFocus);
  const [keepN, setKeepN] = useState(2);
  const [ladderN, setLadderN] = useState(1);
  const [showOut, setShowOut] = useState(false);

  const live = room.choices.filter((c) => room.cands[c.id]);
  const out = room.choices.filter((c) => !room.cands[c.id]);
  const n = live.length;
  const spinning = !!roll || (!!room.roll && !room.roll.done);
  const lock = spinning || !!room.ladder || !!room.pref;
  const keepMax = Math.max(1, Math.min(LIMITS.rollMax, n - 1));
  const k = Math.min(keepN, keepMax);
  const ladderMax = Math.max(1, n - 1);
  const lk = Math.min(ladderN, ladderMax);
  const canRoll = n >= 2 && !lock;
  const canLadder = n >= 2 && n <= LIMITS.ladderMax && !lock;
  const canPref = n >= 2 && n <= LIMITS.prefMax && !lock;
  const fits = live.map((c) => budgetFit(c.items, room.budget)).filter((f): f is Fit => !!f);
  const fitIn = fits.filter((f) => f.tone === 'under' || f.tone === 'exact').length;
  const fitOver = fits.filter((f) => f.tone === 'over').length;

  // 방을 떠나면 내 '보는 중' 표시를 거둔다.
  useEffect(() => () => sendFocus(null), [sendFocus]);

  const tool = (on: boolean): React.CSSProperties => ({
    height: 34,
    padding: '0 12px',
    border: 'none',
    borderRadius: 8,
    background: on ? INK : 'oklch(0.9 0.006 75)',
    color: on ? 'white' : MUTED,
    font: 'inherit',
    fontSize: 12.5,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: on ? 'pointer' : 'default',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{ flex: 'none', padding: '14px 18px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <BudgetBar room={room} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 760 }}>남은 선택지</span>
              <span
                key={n}
                style={{
                  fontSize: 17,
                  fontWeight: 760,
                  color: AC,
                  fontVariantNumeric: 'tabular-nums',
                  display: 'inline-block',
                  animation: 'lp-pop .35s ease-out',
                }}
              >
                {n}
              </span>
              {room.budget && fits.length ? (
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                  예산 안 {fitIn} · 초과 {fitOver}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              식당만, 또는 식당 + 메뉴 구성으로 선택지를 만들고 무작위·사다리·하트로 좁혀요. 모두에게 같이
              보여요.
            </div>
          </div>
          <button
            type="button"
            className="tg-accent"
            disabled={lock || !room.restaurants.length}
            onClick={onNew}
            title={!room.restaurants.length ? '먼저 왼쪽에서 식당을 올려 주세요' : undefined}
            style={{ ...btnAccent(34, 14), opacity: lock || !room.restaurants.length ? 0.45 : 1 }}
          >
            + 선택지 만들기
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stepper value={k} min={1} max={keepMax} onChange={setKeepN} h={34} w={28} />
            <button
              type="button"
              className={canRoll ? 'tg-dark' : ''}
              disabled={!canRoll}
              onClick={() => act({ type: 'roll', count: k })}
              title={
                n < 2
                  ? '선택지가 2개 이상 남아 있어야 뽑을 수 있어요'
                  : '남은 선택지 중 무작위로 몇 개만 남겨요'
              }
              style={tool(canRoll)}
            >
              <IconDice size={14} />
              {spinning ? '뽑는 중…' : `무작위 ${k}개 남기기`}
            </button>
          </div>
          <div style={{ width: 1, height: 22, background: 'oklch(0.88 0.006 75)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stepper value={lk} min={1} max={ladderMax} onChange={setLadderN} h={34} w={28} />
            <button
              type="button"
              className={canLadder ? 'tg-dark' : ''}
              disabled={!canLadder}
              onClick={() => act({ type: 'ladder', keep: lk })}
              title={
                n > LIMITS.ladderMax
                  ? `사다리는 선택지 ${LIMITS.ladderMax}개 이하에서 탈 수 있어요`
                  : '모두가 같은 사다리를 보고 같이 내려보내요'
              }
              style={tool(canLadder)}
            >
              <IconLadder size={14} />
              사다리 · {lk}개 남기기
            </button>
          </div>
          <button
            type="button"
            className={canPref ? 'tg-dark' : ''}
            disabled={!canPref}
            onClick={() => act({ type: 'pref' })}
            title={
              n > LIMITS.prefMax
                ? `하트 걸기는 선택지 ${LIMITS.prefMax}개 이하에서 할 수 있어요`
                : '각자 하트 3개를 나눠 걸어 어디를 더 원하는지 모아요'
            }
            style={tool(canPref)}
          >
            <IconHeart size={14} />
            하트 걸기
          </button>
        </div>
      </div>

      <div
        className={spinning ? 'keep-motion' : undefined}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 18px 18px' }}
        onMouseLeave={() => sendFocus(null)}
      >
        {room.choices.length ? null : (
          <div
            style={{
              border: '1.5px dashed oklch(0.86 0.01 60)',
              borderRadius: 12,
              padding: '28px 18px',
              fontSize: 13,
              color: 'oklch(0.55 0.012 60)',
              lineHeight: 1.7,
              textAlign: 'center',
            }}
          >
            {room.restaurants.length ? (
              <>
                아직 선택지가 없어요.
                <br />
                ‘+ 선택지 만들기’ 또는 왼쪽 식당의 ‘+ 선택지’로 만들어 보세요. 같은 식당도 메뉴 구성을 달리해
                여러 개 만들 수 있어요.
              </>
            ) : (
              <>
                왼쪽에서 식당을 먼저 올려 주세요.
                <br />
                식당 정보와 메뉴·가격을 적으면 그걸로 선택지를 만들어요.
              </>
            )}
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(204px, 1fr))',
            gap: 12,
            alignItems: 'start',
          }}
        >
          {live.map((c) => (
            <ChoiceCard
              key={c.id}
              room={room}
              me={me}
              c={c}
              roll={roll}
              lock={lock}
              onEdit={() => onEdit(c.id)}
              onInfo={() => onInfo(c.restId)}
            />
          ))}
        </div>
        {out.length ? (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="tg-soft"
              onClick={() => setShowOut((v) => !v)}
              aria-expanded={showOut}
              style={{ ...btnSoft(30, 11), fontSize: 12.5 }}
            >
              빠진 선택지 {out.length} {showOut ? '▾' : '▸'}
            </button>
            {showOut ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {out.map((c) => (
                  <OutRow key={c.id} room={room} c={c} lock={lock} onInfo={() => onInfo(c.restId)} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 총사용금액

function BudgetBar({ room }: { room: RoomState }) {
  const act = useShare((s) => s.act);
  const [text, setText] = useState(room.budget ? room.budget.toLocaleString('ko-KR') : '');
  const editing = useRef(false);
  // 다른 사람이 바꾸면 따라간다 (내가 적는 중에는 건드리지 않는다).
  useEffect(() => {
    if (!editing.current) setText(room.budget ? room.budget.toLocaleString('ko-KR') : '');
  }, [room.budget]);

  const commit = () => {
    editing.current = false;
    const v = moneyValue(text);
    if (v !== room.budget) act({ type: 'budget', amount: v });
    setText(v ? v.toLocaleString('ko-KR') : '');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 11,
        background: 'white',
        boxShadow: `0 0 0 1px ${INPUT_BORDER}, 0 1px 3px oklch(0.5 0.02 60 / .06)`,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 760 }}>총사용금액</span>
      <div style={{ position: 'relative' }}>
        <input
          className="tg-input"
          value={text}
          inputMode="numeric"
          aria-label="총사용금액"
          placeholder="정하지 않음"
          onFocus={() => (editing.current = true)}
          onChange={(e) => setText(moneyInput(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{
            width: 150,
            height: 34,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 8,
            padding: '0 28px 0 10px',
            font: 'inherit',
            fontSize: 15,
            fontWeight: 750,
            textAlign: 'right',
            outline: 'none',
            color: INK,
            background: 'white',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <span style={{ position: 'absolute', right: 10, top: 9, fontSize: 12.5, color: MUTED }}>원</span>
      </div>
      {room.budget ? (
        <span
          role="button"
          tabIndex={0}
          onClick={() => act({ type: 'budget', amount: null })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') act({ type: 'budget', amount: null });
          }}
          style={{ fontSize: 12, fontWeight: 650, color: AINK, cursor: 'pointer' }}
        >
          지우기
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
        {room.budget
          ? '선택지마다 남는지 · 딱 맞는지 · 넘는지 보여요 (가격 미정은 + α)'
          : '정해 두면 선택지마다 예산 안인지 바로 보여요'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- 카드

function ChoiceCard({
  room,
  me,
  c,
  roll,
  lock,
  onEdit,
  onInfo,
}: {
  room: RoomState;
  me: string;
  c: Choice;
  roll: RollView | null;
  lock: boolean;
  onEdit: () => void;
  onInfo: () => void;
}) {
  const act = useShare((s) => s.act);
  const sendFocus = useShare((s) => s.sendFocus);
  const focus = useShare((s) => s.focus);
  const [confirmDel, setConfirmDel] = useState(false);
  const it = itemOf(room, c.id)!;
  const r = room.restaurants.find((x) => x.id === c.restId);
  const money = moneyOf(c.items);
  const fit = budgetFit(c.items, room.budget);
  const tally = room.prefTally?.[c.id];
  const by = memberOf(room, c.by);
  const watching = room.members.filter((m) => m.id !== me && m.online && focus[m.id] === c.id);
  const cur = roll?.cursor === c.id;
  const landed = !!roll?.landed.includes(c.id);
  const dim = !!roll && !cur && !landed;
  const ring = landed
    ? `0 0 0 3px ${AC}, 0 12px 30px oklch(0.56 0.16 40 / .3)`
    : cur
      ? `0 0 0 3px oklch(0.78 0.12 70), 0 10px 26px oklch(0.6 0.12 70 / .3)`
      : CARD_RING;

  return (
    <div
      className="tg-card"
      onMouseEnter={() => sendFocus(c.id)}
      style={{
        position: 'relative',
        background: landed ? 'oklch(0.985 0.014 50)' : 'white',
        borderRadius: 12,
        boxShadow: ring,
        padding: '12px 12px 10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: dim ? 0.45 : 1,
        transform: landed || cur ? 'scale(1.02)' : 'none',
        transition: 'box-shadow .15s, opacity .25s, transform .2s',
        animation: 'lp-pop .4s cubic-bezier(.2,.9,.3,1.4) both',
      }}
    >
      {watching.length ? (
        <span
          style={{ position: 'absolute', right: 10, top: -9 }}
          title={watching.map((m) => `${m.name} 보는 중`).join(', ')}
        >
          <AvatarStack members={watching} size={18} max={3} />
        </span>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <CodeBadge code={choiceName(c)} hue={it.hue} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 740,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {c.label || r?.name}
          </div>
          {c.label ? (
            <div
              style={{
                fontSize: 11.5,
                color: MUTED,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {r?.name}
            </div>
          ) : null}
        </div>
        <div
          role="button"
          tabIndex={0}
          title="식당 정보"
          className="tg-icon"
          onClick={onInfo}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onInfo();
          }}
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'oklch(0.62 0.01 60)',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          <IconInfo size={15} />
        </div>
      </div>

      {c.items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {c.items.slice(0, ITEM_LINES).map((x) => (
            <div
              key={`${x.menuId ?? x.name}`}
              style={{ display: 'flex', gap: 6, fontSize: 12.5, minWidth: 0 }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {x.name} <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>×{x.qty}</span>
              </span>
              <span
                style={{
                  flex: 'none',
                  color: x.price == null ? MUTED_3 : 'oklch(0.42 0.012 60)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {x.price == null ? '가격 미정' : (x.price * x.qty).toLocaleString('ko-KR')}
              </span>
            </div>
          ))}
          {c.items.length > ITEM_LINES ? (
            <span style={{ fontSize: 11.5, color: MUTED_3 }}>+ {c.items.length - ITEM_LINES}가지 더</span>
          ) : null}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: MUTED }}>식당만 정했어요 · 메뉴는 그때 정해요</div>
      )}
      {c.note ? (
        <div
          style={{
            fontSize: 11.5,
            color: 'oklch(0.45 0.012 60)',
            lineHeight: 1.45,
            overflowWrap: 'anywhere',
          }}
        >
          “{c.note}”
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span
          title={money.unknown ? `가격 미정 메뉴 ${money.unknown}가지는 합계에서 빠졌어요` : undefined}
          style={{
            fontSize: 16,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: c.items.length ? INK : MUTED_3,
          }}
        >
          {moneyText(c.items)}
        </span>
        <FitBadge fit={fit} />
        <div style={{ flex: 1 }} />
        {tally !== undefined ? (
          <span
            title={`하트 걸기 결과 · 하트 ${tally}개`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 12,
              fontWeight: 750,
              color: tally ? AC : MUTED,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <IconHeart size={12} color={tally ? AC : 'oklch(0.8 0.01 60)'} />
            {tally}
          </span>
        ) : null}
        <Avatar m={by} size={20} title={`${by?.name ?? '나간 사람'}님이 만든 선택지`} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          paddingTop: 8,
          borderTop: '1px solid oklch(0.95 0.005 75)',
        }}
      >
        <button
          type="button"
          className={lock ? '' : 'tg-accent'}
          disabled={lock}
          onClick={() => act({ type: 'choiceFinal', id: c.id })}
          style={{ ...btnAccent(28, 10), fontSize: 12, opacity: lock ? 0.45 : 1 }}
        >
          <IconCheck size={11} stroke={3} />
          확정
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className={lock ? '' : 'tg-soft'}
          disabled={lock}
          onClick={() => act({ type: 'cand', restId: c.id })}
          title="후보에서 빼기 — 아래 ‘빠진 선택지’에서 다시 넣을 수 있어요"
          style={{ ...btnSoft(28, 8), fontSize: 12, opacity: lock ? 0.45 : 1 }}
        >
          빼기
        </button>
        <button
          type="button"
          className={lock ? '' : 'tg-soft'}
          disabled={lock}
          onClick={onEdit}
          style={{ ...btnSoft(28, 8), fontSize: 12, opacity: lock ? 0.45 : 1 }}
        >
          수정
        </button>
        <button
          type="button"
          className={lock ? '' : 'tg-danger'}
          disabled={lock}
          onClick={() => {
            if (!confirmDel) return setConfirmDel(true);
            setConfirmDel(false);
            act({ type: 'choiceRemove', id: c.id });
          }}
          onBlur={() => setConfirmDel(false)}
          style={{
            ...btnSoft(28, 8),
            fontSize: 12,
            color: confirmDel ? 'white' : 'oklch(0.5 0.17 25)',
            background: confirmDel ? 'oklch(0.55 0.19 25)' : 'white',
            border: confirmDel ? 'none' : btnSoft(28, 9).border,
            opacity: lock ? 0.45 : 1,
          }}
        >
          {confirmDel ? '지울까요?' : '삭제'}
        </button>
      </div>
    </div>
  );
}

function OutRow({
  room,
  c,
  lock,
  onInfo,
}: {
  room: RoomState;
  c: Choice;
  lock: boolean;
  onInfo: () => void;
}) {
  const act = useShare((s) => s.act);
  const it = itemOf(room, c.id)!;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 8px 7px 10px',
        borderRadius: 10,
        background: 'oklch(0.975 0.004 75)',
        boxShadow: `inset 0 0 0 1px ${INPUT_BORDER}`,
        animation: 'lp-in .25s ease-out',
      }}
    >
      <CodeBadge code={choiceName(c)} hue={it.hue} size="sm" />
      <span
        role="button"
        tabIndex={0}
        onClick={onInfo}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onInfo();
        }}
        title="식당 정보"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: 650,
          color: 'oklch(0.45 0.012 60)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {it.title.replace(`${choiceName(c)} `, '')}
        <span style={{ fontWeight: 500, color: MUTED_3 }}> · {moneyText(c.items)}</span>
      </span>
      <span style={{ fontSize: 11.5, color: MUTED_3, flex: 'none' }}>
        {shortName(memberOf(room, c.by)?.name ?? '나간 사람')}
      </span>
      <button
        type="button"
        className={lock ? '' : 'tg-soft'}
        disabled={lock}
        onClick={() => act({ type: 'cand', restId: c.id })}
        style={{ ...btnSoft(26, 9), fontSize: 12, color: AINK, opacity: lock ? 0.45 : 1 }}
      >
        다시 넣기
      </button>
    </div>
  );
}
