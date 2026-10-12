/**
 * 하트 걸기 (같이 고르기 · 추려내기) — 후보 2~6곳에 각자 하트 3개를 나눠 건다.
 * 한 곳에 몰아 걸면 그만큼 더 가고 싶다는 뜻이고, '아무데나 좋아요' 로 빠질 수도 있다.
 * 건 하트는 바로 모두에게 보이고(건 사람의 아바타 색), 누구든 마감하면 하트 수로 순위가 드러난다.
 *
 * 게임에 갇히지 않게 — 무작위가 없고(동점도 그대로 공동 순위), 결과는 참고용이다. 어느 후보든 그 자리에서
 * 확정할 수 있고, 다시 걸거나 그냥 닫아도 된다. 자동 마감도 없다.
 *
 * 방 가운데(가기 싫은 곳 열 + 보드)를 덮는 무대라 채팅·참여자·식당 정보는 그대로 쓸 수 있다. 모두의 화면이라
 * Esc 로는 닫지 않고 ✕ 로만 닫는다. 연출 자체가 기능이라 .keep-motion 으로 감싼다.
 *
 *   ┌ 하트 걸기 · 모두에게 같이 보이는 중 · ✕
 *   │ 내 하트 ♥ ♥ ♡ · 아무데나 좋아요
 *   │ 후보 칸 (2곳이면 시소) — 하트 더미 · 합계 · 건 사람 · −/+   (마감 뒤: 순위 · 왕관 · 확정)
 *   │ 참여자 (다 걸었어요 ✓ / 상관없음 / ♥n 남음)
 *   └ 마감하기   (마감 뒤: 동점끼리 한 번 더 · ♥0 후보 내리기 · 다시 걸기 · 닫기)
 */
import { type MutableRefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Restaurant } from '../../lib/types';
import {
  PREF_BURST_MS,
  PREF_DROP_MS,
  PREF_FLY_MS,
  PREF_SORT_MS,
  PREF_STAGGER_MS,
  PREF_TILT_MS,
} from '../../share/anim';
import {
  betSum,
  cleanBet,
  isDone,
  noBet,
  rankOrder,
  ranks,
  summaryText,
  topTie,
  totals,
  voters,
  zeroIds,
} from '../../share/pref';
import { type Member, type PrefRun, type RoomState, shortName } from '../../share/protocol';
import { speedMul, useAnimSpeed } from '../../store/settingsStore';
import { useShare } from '../../store/shareStore';
import { AC, AINK, CH, HUES, INK, MUTED, MUTED_3, SOFT } from '../../theme';
import {
  Avatar,
  AvatarStack,
  IconCheck,
  IconCrown,
  IconHeart,
  IconHeartLine,
  IconX,
  INPUT_BORDER,
  avBg,
  btnAccent,
  btnSoft,
  shakeAnim,
  whoShort,
} from './parts';

/** 보낸 내 하트가 이 안에 돌아오지 않으면 방 상태를 따른다 (OrderPanel 과 같은 방식) */
const BET_SETTLE_MS = 1500;
/** 두 번 눌러야 하는 버튼이 '한 번 더' 를 기다리는 시간 */
const CONFIRM_MS = 4000;
const GAP = 12;
const BURST = 18;
/** 시소가 가장 많이 기우는 각도 */
const MAX_TILT = 10;

type Draft = { bet: number[]; pass: boolean };
const sigOf = (d: Draft) => `${d.pass ? 'p' : ''}${d.bet.join(',')}`;

/** 다음에 새로 생기는 하트(data-heart 키)가 어디서 날아오는지 */
type Fly = { key: string; from: DOMRect };
type Tok = { key: string; color: string; title: string };

export default function PrefStage({
  room,
  me,
  onInfo,
}: {
  room: RoomState;
  me: string;
  onInfo: (id: string) => void;
}) {
  const act = useShare((s) => s.act);
  const sp = speedMul(useAnimSpeed());
  const run = room.pref!;
  const n = run.cands.length;
  const closed = !!run.closed;
  const meM = room.members.find((m) => m.id === me);

  // ---------------------------------------------------------------- 내 하트 (로컬 초안)
  // 빨리 눌러도 숫자가 꼬이지 않게 들고 있다가 통째로 보낸다. 돌아오면 다시 방 상태를 따른다.
  const roomDraft: Draft = { bet: run.bets[me] ?? noBet(run), pass: run.pass.includes(me) };
  const roomSig = sigOf(roomDraft);
  const [draft, setDraft] = useState<Draft>(roomDraft);
  const sent = useRef<string | null>(null);
  const latest = useRef(roomDraft);
  latest.current = roomDraft;
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (sent.current === null || sent.current === roomSig) {
      sent.current = null;
      setDraft(latest.current);
    }
  }, [roomSig]);
  // 마감·다시 걸기 때는 무조건 방 상태에 맞춘다.
  useEffect(() => {
    sent.current = null;
    setDraft(latest.current);
  }, [run.closed?.at]);
  useEffect(() => () => clearTimeout(settle.current), []);

  const commit = (next: Draft) => {
    const bet = cleanBet(next.bet, run);
    if (!bet) return;
    const d: Draft = { bet, pass: next.pass && !betSum(bet) };
    setDraft(d);
    sent.current = sigOf(d);
    act({ type: 'prefBet', id: run.id, hearts: d.bet, pass: d.pass || undefined });
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (sent.current === null) return;
      sent.current = null;
      setDraft(latest.current);
    }, BET_SETTLE_MS);
  };

  // 내 초안을 얹은 판 — 내가 누른 건 기다리지 않고 바로 보인다.
  const view: PrefRun = useMemo(() => {
    const bets = { ...run.bets };
    if (draft.pass || !betSum(draft.bet)) delete bets[me];
    else bets[me] = draft.bet;
    const pass = run.pass.filter((x) => x !== me);
    return { ...run, bets, pass: draft.pass ? [...pass, me] : pass };
  }, [run, draft, me]);

  const t = totals(view);
  const rk = ranks(t);
  const order = rankOrder(t);
  /** 칸 i 가 순위로 서는 자리 */
  const slotOf: number[] = [];
  order.forEach((i, slot) => (slotOf[i] = slot));
  const maxT = Math.max(0, ...t);
  const who = voters(view, room.members);
  const left = run.hearts - betSum(draft.bet);
  const rest = (id: string) => room.restaurants.find((r) => r.id === id);
  const nameOf = (id: string) => rest(id)?.name ?? '';
  /** '내가' / '서원님이' */
  const byWho = (id: string) => (id === me ? '내가' : `${whoShort(room, me, id)}님이`);

  const online = room.members.filter((m) => m.online);
  const people = room.members.filter(
    (m) => m.online || view.bets[m.id] || view.pass.includes(m.id) || m.id === me,
  );
  const pending = online.filter((m) => !isDone(view, m.id));
  const allDone = online.length > 0 && !pending.length;
  const anyBet = Object.keys(view.bets).length > 0;

  // ---------------------------------------------------------------- 날아가는 하트
  const rootRef = useRef<HTMLDivElement>(null);
  const flyRef = useRef<Fly | null>(null);
  const rectOf = (key: string) =>
    rootRef.current?.querySelector<HTMLElement>(`[data-heart="${key}"]`)?.getBoundingClientRect() ?? null;

  const [shake, setShake] = useState(0);
  const [note, setNote] = useState('');

  const plus = (i: number) => {
    if (closed) return;
    if (left <= 0) {
      setShake((x) => x + 1);
      setNote('하트를 다 걸었어요 · 다른 곳에서 하나 빼 오면 옮길 수 있어요');
      return;
    }
    setNote('');
    const from = rectOf(`tray:${left - 1}`);
    if (from) flyRef.current = { key: `${me}:${i}:${draft.bet[i]}`, from };
    commit({ bet: draft.bet.map((v, j) => (j === i ? v + 1 : v)), pass: false });
  };
  const minus = (i: number) => {
    if (closed || !draft.bet[i]) return;
    setNote('');
    const from = rectOf(`${me}:${i}:${draft.bet[i] - 1}`);
    if (from) flyRef.current = { key: `tray:${left}`, from };
    commit({ bet: draft.bet.map((v, j) => (j === i ? v - 1 : v)), pass: false });
  };
  const togglePass = () => {
    if (closed) return;
    setNote('');
    commit({ bet: noBet(run), pass: !draft.pass });
  };

  /** 칸 i 의 하트 — 사람 순서대로, 한 사람의 하트는 이어서 */
  const tokensOf = (i: number): Tok[] =>
    room.members.flatMap((m) =>
      Array.from({ length: view.bets[m.id]?.[i] ?? 0 }, (_, k) => ({
        key: `${m.id}:${i}:${k}`,
        color: avBg(m.hue),
        title: `${m.id === me ? '나' : m.name}의 하트`,
      })),
    );

  // ---------------------------------------------------------------- 마감 · 결과 연출
  // 열려 있는 걸 보다가 마감되는 순간을 봤을 때만 연출한다 (마감 뒤에 들어온 사람은 결과만 본다).
  const closedAt = run.closed?.at ?? null;
  const prevClosed = useRef(closedAt);
  const [reveal, setReveal] = useState(0);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (closedAt && !prevClosed.current) {
      setReveal((x) => x + 1);
      setBurst((x) => x + 1);
    }
    prevClosed.current = closedAt;
  }, [closedAt]);
  const sortMs = n > 2 ? PREF_SORT_MS * sp : 0;
  const stagger = PREF_STAGGER_MS * sp;
  const crownAt = sortMs + Math.min(n, 3) * stagger;
  useEffect(() => {
    if (!burst) return;
    const id = setTimeout(() => setBurst(0), crownAt + PREF_BURST_MS * 1.4 * sp + 200);
    return () => clearTimeout(id);
  }, [burst, crownAt, sp]);
  const revealing = closed && reveal > 0;
  /** 순위 배지가 튀어나오는 지연 (순위대로) */
  const badgeDelay = (i: number) => (revealing ? sortMs + slotOf[i] * stagger : 0);
  const winners = closed && maxT > 0 ? run.cands.filter((_, i) => t[i] === maxT) : [];
  const tie = topTie(view);
  const zeros = closed ? zeroIds(view) : [];

  // ---------------------------------------------------------------- 두 번 눌러야 하는 버튼
  const [confirm, setConfirm] = useState<'close' | 'cancel' | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const id = setTimeout(() => setConfirm(null), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [confirm]);
  useEffect(() => setConfirm(null), [allDone, closed]);

  const closeBets = () => {
    if (!anyBet && !view.pass.length) return;
    if (pending.length && confirm !== 'close') return setConfirm('close');
    setConfirm(null);
    act({ type: 'prefClose', id: run.id });
  };
  const cancel = () => {
    if (!closed && anyBet && confirm !== 'cancel') return setConfirm('cancel');
    setConfirm(null);
    act({ type: 'prefCancel', id: run.id });
  };

  const cand = (i: number) => ({
    i,
    r: rest(run.cands[i]),
    total: t[i],
    rank: rk[i],
    shared: rk.filter((x) => x === rk[i]).length > 1,
    who: who[i],
    mine: draft.bet[i] ?? 0,
    tokens: tokensOf(i),
    win: winners.includes(run.cands[i]),
  });

  const common: Common = {
    closed,
    sp,
    flyRef,
    left,
    badgeDelay,
    crownAt: revealing ? crownAt : 0,
    burst,
    onPlus: plus,
    onMinus: minus,
    onInfo,
    onFinal: (id: string) => act({ type: 'final', restId: id }),
  };

  return (
    <div
      ref={rootRef}
      className="keep-motion"
      role="region"
      aria-label="하트 걸기"
      style={{
        position: 'absolute',
        inset: 0,
        gridColumn: '1 / 3',
        gridRow: 1,
        zIndex: 15,
        background: 'oklch(0.975 0.004 75)',
        overflow: 'auto',
        animation: 'lp-in .25s ease-out',
      }}
    >
      <div
        style={{
          maxWidth: 940,
          margin: '0 auto',
          padding: '18px 22px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'lp-rise .45s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {/* ------------------------------------------------ 머리 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconHeart size={20} />
              <span style={{ fontSize: 18, fontWeight: 780 }}>
                하트 걸기{run.round > 1 ? ` · ${run.round}라운드` : ''}
              </span>
              <span style={{ fontSize: 12, color: MUTED }}>{byWho(run.by)} 열었어요</span>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
              {closed
                ? `후보 ${n}곳 · 하트 ${run.hearts}개씩 · 하트가 많은 순서대로 섰어요`
                : `후보 ${n}곳에 하트 ${run.hearts}개를 나눠 걸어요 · 한 곳에 몰면 그만큼 더 가고 싶다는 뜻 · 건 하트는 모두에게 바로 보여요`}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 14,
              background: 'oklch(0.955 0.005 75)',
              fontSize: 12,
              fontWeight: 650,
              color: 'oklch(0.42 0.012 60)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'oklch(0.62 0.15 150)',
                animation: 'lp-breathe 2s infinite',
              }}
            />
            모두에게 같이 보이는 중
          </div>
          <button
            type="button"
            title={
              confirm === 'cancel'
                ? '건 하트가 모두 사라져요 · 한 번 더 누르면 닫혀요'
                : '닫기 (모두의 화면에서 닫혀요)'
            }
            aria-label="하트 걸기 닫기"
            className="tg-act"
            onClick={cancel}
            style={{
              height: 36,
              minWidth: 36,
              padding: confirm === 'cancel' ? '0 12px' : 0,
              border: 'none',
              borderRadius: 8,
              background: confirm === 'cancel' ? 'oklch(0.96 0.02 25)' : 'transparent',
              color: confirm === 'cancel' ? 'oklch(0.5 0.17 25)' : 'oklch(0.42 0.012 60)',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: 650,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {confirm === 'cancel' ? '한 번 더 누르면 닫혀요' : null}
            <IconX size={15} stroke={2.2} />
          </button>
        </div>

        {/* ------------------------------------------------ 내 하트 */}
        {closed ? (
          <ResultBar
            text={summaryText(view, nameOf)}
            sub={`${byWho(run.closed!.by)} 마감했어요 · 결과는 참고용이에요 — 어떤 후보든 확정할 수 있어요`}
          />
        ) : (
          <Tray
            me={meM}
            hearts={run.hearts}
            left={left}
            pass={draft.pass}
            flyRef={flyRef}
            sp={sp}
            shake={shake}
            note={note}
            onPass={togglePass}
          />
        )}

        {/* ------------------------------------------------ 후보 */}
        {n === 2 ? (
          <Seesaw a={cand(0)} b={cand(1)} {...common} />
        ) : (
          <div style={{ display: 'flex', gap: GAP, alignItems: 'stretch' }}>
            {run.cands.map((id, i) => (
              <Column key={id} c={cand(i)} slot={slotOf[i]} scale={Math.max(maxT, run.hearts)} {...common} />
            ))}
          </div>
        )}

        {/* ------------------------------------------------ 참여자 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'white',
            boxShadow: '0 0 0 1px oklch(0.91 0.006 75)',
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.38 0.012 60)', marginRight: 2 }}>
            다 건 사람 {online.length - pending.length}/{online.length}
          </span>
          {people.map((m) => (
            <MemberChip key={m.id} m={m} me={me} view={view} />
          ))}
          {allDone && !closed ? (
            <span
              style={{
                marginLeft: 'auto',
                height: 26,
                padding: '0 11px',
                borderRadius: 13,
                background: SOFT,
                color: AINK,
                fontSize: 12.5,
                fontWeight: 750,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                animation: 'lp-pop .45s cubic-bezier(.2,.9,.3,1.4) both',
              }}
            >
              <IconHeart size={13} />
              모두 걸었어요!
            </span>
          ) : null}
        </div>

        {/* ------------------------------------------------ 아래 줄 */}
        {closed ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {tie.length ? (
              <button
                type="button"
                className="tg-soft"
                onClick={() => act({ type: 'pref', retie: true })}
                style={btnSoft(36, 13)}
              >
                <IconHeart size={13} />
                동점끼리 한 번 더
              </button>
            ) : null}
            {zeros.length ? (
              <button
                type="button"
                className="tg-soft"
                title={zeros.map(nameOf).join(', ')}
                onClick={() => act({ type: 'prefDrop', id: run.id })}
                style={btnSoft(36, 13)}
              >
                ♥0 후보 내리기
              </button>
            ) : null}
            <button
              type="button"
              className="tg-soft"
              onClick={() => act({ type: 'prefReopen', id: run.id })}
              style={btnSoft(36, 13)}
            >
              다시 걸기
            </button>
            <button
              type="button"
              className="tg-soft"
              title="닫아도 하트 수는 후보에 ♥로 남아요"
              onClick={cancel}
              style={btnSoft(36, 13)}
            >
              닫기
            </button>
            {winners.length === 1 ? (
              <button
                type="button"
                className="tg-accent"
                onClick={() => act({ type: 'final', restId: winners[0] })}
                style={{
                  ...btnAccent(36, 16),
                  animation: revealing
                    ? `lp-pop .45s ${crownAt / 1000}s cubic-bezier(.2,.9,.3,1.4) both`
                    : 'none',
                }}
              >
                <IconCheck size={13} stroke={3} />‘{nameOf(winners[0])}’ 확정
              </button>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
              {confirm === 'close'
                ? `아직 ${pending.map((m) => whoShort(room, me, m.id)).join(', ')} 거는 중이에요 · 한 번 더 누르면 지금 하트로 마감해요`
                : allDone
                  ? '모두 걸었어요 · 마감하면 순위가 나와요 (고치고 싶은 사람은 마감 전에 고쳐요)'
                  : '누구든 마감할 수 있어요 · 자동으로 마감되지 않아요'}
            </div>
            <button
              type="button"
              className={anyBet || view.pass.length ? 'tg-accent' : ''}
              disabled={!anyBet && !view.pass.length}
              title={anyBet || view.pass.length ? undefined : '아직 아무도 하트를 걸지 않았어요'}
              onClick={closeBets}
              style={{
                ...btnAccent(38, 18),
                opacity: anyBet || view.pass.length ? 1 : 0.4,
                cursor: anyBet || view.pass.length ? 'pointer' : 'default',
                animation: allDone ? 'lp-glow 1.6s infinite' : 'none',
                transition: 'opacity .3s',
              }}
            >
              {confirm === 'close' ? '한 번 더 누르면 마감' : '마감하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================== 조각들

type CandView = {
  i: number;
  r: Restaurant | undefined;
  total: number;
  rank: number;
  shared: boolean;
  who: { m: Member; n: number }[];
  mine: number;
  tokens: Tok[];
  win: boolean;
};

type Common = {
  closed: boolean;
  sp: number;
  flyRef: MutableRefObject<Fly | null>;
  left: number;
  badgeDelay: (i: number) => number;
  /** 왕관이 튀어나오는 지연 (연출하지 않으면 0) */
  crownAt: number;
  /** 하트 터짐을 그릴지 (마감되는 순간을 봤을 때만) */
  burst: number;
  onPlus: (i: number) => void;
  onMinus: (i: number) => void;
  onInfo: (id: string) => void;
  onFinal: (id: string) => void;
};

/** 내 하트 트레이 — 남은 하트는 두근거리고, 건 자리는 테두리만 남는다. */
function Tray({
  me,
  hearts,
  left,
  pass,
  flyRef,
  sp,
  shake,
  note,
  onPass,
}: {
  me: Member | undefined;
  hearts: number;
  left: number;
  pass: boolean;
  flyRef: MutableRefObject<Fly | null>;
  sp: number;
  shake: number;
  note: string;
  onPass: () => void;
}) {
  const color = avBg(me?.hue ?? 40);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 14px',
        borderRadius: 12,
        background: 'white',
        boxShadow: '0 0 0 1px oklch(0.91 0.006 75), 0 1px 3px oklch(0.5 0.02 60 / .05)',
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 750 }}>내 하트</span>
      <div
        key={shake}
        style={{ display: 'flex', alignItems: 'center', gap: 6, animation: shakeAnim(shake) }}
        aria-hidden
      >
        {Array.from({ length: hearts }, (_, j) =>
          j < left ? (
            <Token
              key={`f${j}`}
              id={`tray:${j}`}
              color={pass ? 'oklch(0.82 0.01 60)' : color}
              size={26}
              flyRef={flyRef}
              ms={PREF_FLY_MS * sp}
              drop="none"
              beat={!pass ? `lp-beat 1.6s ${j * 0.12}s ease-in-out infinite` : undefined}
            />
          ) : (
            <span key={`e${j}`} style={{ display: 'inline-flex', color: 'oklch(0.82 0.01 60)' }}>
              <IconHeartLine size={26} />
            </span>
          ),
        )}
      </div>
      <span
        aria-live="polite"
        style={{ fontSize: 12.5, color: note ? AINK : MUTED, fontWeight: note ? 650 : 500 }}
      >
        {note ||
          (pass
            ? '아무데나 좋아요 — 하트를 걸면 다시 함께해요'
            : left
              ? `남은 하트 ${left}개 · 후보 칸의 + 로 걸어요`
              : '다 걸었어요 · 마감 전까지 얼마든지 옮길 수 있어요')}
      </span>
      <button
        type="button"
        aria-pressed={pass}
        className={pass ? '' : 'tg-soft'}
        onClick={onPass}
        style={{
          ...btnSoft(32, 12),
          marginLeft: 'auto',
          background: pass ? SOFT : 'white',
          color: pass ? AINK : INK,
          borderColor: pass ? AC : INPUT_BORDER,
          transition: 'background .2s, color .2s, border-color .2s',
        }}
      >
        {pass ? <IconCheck size={12} stroke={3} /> : null}
        아무데나 좋아요
      </button>
    </div>
  );
}

/** 마감 뒤 트레이 자리에 뜨는 결과 줄 — 자리가 그대로라 칸이 위아래로 튀지 않는다. */
function ResultBar({ text, sub }: { text: string; sub: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 58,
        boxSizing: 'border-box',
        padding: '10px 14px',
        borderRadius: 12,
        background: SOFT,
        boxShadow: '0 0 0 1px oklch(0.9 0.04 50)',
        animation: 'lp-in .35s ease-out',
      }}
    >
      <IconHeart size={22} />
      <div style={{ minWidth: 0 }}>
        <div aria-live="polite" style={{ fontSize: 14, fontWeight: 760, color: INK }}>
          {text}
        </div>
        <div style={{ fontSize: 12, color: AINK, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

/**
 * 하트 하나. 내가 방금 건(뺀) 하트면 트레이(칸)에서 날아오고, 남이 건 하트는 위에서 떨어져 앉는다.
 * 어디서 날아올지는 처음 그릴 때 한 번만 정한다 (다시 그려도 연출을 되풀이하지 않는다).
 */
function Token({
  id,
  color,
  size,
  title,
  flyRef,
  ms,
  drop,
  beat,
}: {
  id: string;
  color: string;
  size: number;
  title?: string;
  flyRef: MutableRefObject<Fly | null>;
  ms: number;
  drop: string;
  beat?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [from] = useState(() => (flyRef.current?.key === id ? flyRef.current.from : null));
  const [flying, setFlying] = useState(!!from);
  useLayoutEffect(() => {
    const el = ref.current;
    if (flyRef.current?.key === id) flyRef.current = null;
    if (!from || !el) return;
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const s = from.width / Math.max(1, to.width);
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        { transform: `translate(${dx / 2}px, ${dy / 2 - 46}px) scale(${(s + 1) / 2 + 0.25})`, offset: 0.5 },
        { transform: 'none' },
      ],
      { duration: ms, easing: 'cubic-bezier(.3,.7,.35,1)' },
    );
    anim.onfinish = () => setFlying(false);
    return () => anim.cancel();
    // 처음 그릴 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span
      ref={ref}
      data-heart={id}
      title={title}
      style={{
        display: 'inline-flex',
        position: 'relative',
        zIndex: flying ? 5 : undefined,
        filter: 'drop-shadow(0 1px 1px oklch(0.3 0.02 60 / .25))',
        // 날아온 하트는 떨어지는 연출을 하지 않는다. 트레이 하트는 내려앉은 뒤부터 두근거린다.
        animation: flying ? 'none' : (beat ?? (from ? 'none' : drop)),
      }}
    >
      <IconHeart size={size} color={color} />
    </span>
  );
}

/** 한 칸에 쌓인 하트 — 아래에서부터 쌓인다 */
function Pile({
  c,
  flyRef,
  sp,
  height,
}: {
  c: CandView;
  flyRef: MutableRefObject<Fly | null>;
  sp: number;
  height: number;
}) {
  const size = c.tokens.length > 24 ? 13 : c.tokens.length > 12 ? 16 : 19;
  return (
    <div
      style={{
        position: 'relative',
        height,
        display: 'flex',
        flexWrap: 'wrap-reverse',
        alignContent: 'flex-start',
        justifyContent: 'center',
        gap: 3,
        padding: 8,
        boxSizing: 'border-box',
      }}
    >
      {c.tokens.map((tk) => (
        <Token
          key={tk.key}
          id={tk.key}
          color={tk.color}
          size={size}
          title={tk.title}
          flyRef={flyRef}
          ms={PREF_FLY_MS * sp}
          drop={`lp-drop ${PREF_DROP_MS * sp}ms cubic-bezier(.2,.8,.3,1) both`}
        />
      ))}
    </div>
  );
}

/** 식당 이름 · 분류 · 대표 메뉴 — 이름을 누르면 식당 정보(나만 보기) */
function CandHead({ c, onInfo }: { c: CandView; onInfo: (id: string) => void }) {
  const r = c.r;
  if (!r) return null;
  const hue = CH[r.category] ?? 300;
  const menus = (r.menus.some((m) => m.fav) ? r.menus.filter((m) => m.fav) : r.menus)
    .slice(0, 2)
    .map((m) => m.name)
    .join(' · ');
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: `oklch(0.62 0.15 ${hue})`,
            flex: 'none',
          }}
        />
        <span
          role="button"
          tabIndex={0}
          title="식당 정보 (나만 보기)"
          onClick={() => onInfo(r.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onInfo(r.id);
          }}
          style={{
            fontSize: 15,
            fontWeight: 760,
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {r.name}
        </span>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: MUTED_3,
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {r.category}
        {menus ? ` · ${menus}` : ''}
      </div>
    </div>
  );
}

/** 합계 · 건 사람 · −/+ (마감 뒤에는 순위 · 확정) */
function CandFoot({ c, ...p }: { c: CandView } & Common) {
  const name = c.r?.name ?? '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26 }}>
        <span
          key={c.total}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 18,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: c.total ? AINK : MUTED_3,
            animation: 'lp-pop .35s ease-out',
          }}
        >
          <IconHeart size={15} color={c.total ? AC : 'oklch(0.82 0.01 60)'} />
          {c.total}
        </span>
        {c.who.length ? (
          <span title={c.who.map((w) => `${w.m.name} ${w.n}`).join(' · ')} style={{ marginLeft: 'auto' }}>
            <AvatarStack members={c.who.map((w) => w.m)} size={20} max={4} />
          </span>
        ) : null}
      </div>
      {p.closed ? (
        <button
          type="button"
          className={c.win ? 'tg-accent' : 'tg-soft'}
          onClick={() => c.r && p.onFinal(c.r.id)}
          style={c.win ? btnAccent(32, 12) : btnSoft(32, 12)}
        >
          {c.win ? <IconCheck size={12} stroke={3} /> : null}
          확정
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 34,
            borderRadius: 9,
            boxShadow: `inset 0 0 0 1px ${INPUT_BORDER}`,
            background: 'white',
          }}
        >
          <button
            type="button"
            aria-label={`‘${name}’에서 하트 하나 빼기 (지금 ${c.mine}개)`}
            disabled={!c.mine}
            onClick={() => p.onMinus(c.i)}
            style={stepBtn(!!c.mine)}
          >
            −
          </button>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: c.mine ? AINK : MUTED_3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            내 하트{' '}
            <span key={c.mine} style={{ display: 'inline-block', animation: 'lp-pop .3s ease-out' }}>
              {c.mine}
            </span>
          </span>
          <button
            type="button"
            aria-label={`‘${name}’에 하트 하나 걸기 (지금 ${c.mine}개, 남은 하트 ${p.left}개)`}
            aria-disabled={p.left <= 0}
            onClick={() => p.onPlus(c.i)}
            style={stepBtn(p.left > 0, true)}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

const stepBtn = (on: boolean, accent?: boolean): React.CSSProperties => ({
  width: 38,
  height: 34,
  border: 'none',
  background: 'transparent',
  font: 'inherit',
  fontSize: 18,
  fontWeight: 700,
  color: on ? (accent ? AC : 'oklch(0.45 0.012 60)') : 'oklch(0.8 0.006 60)',
  cursor: on ? 'pointer' : 'default',
});

/** 순위 배지 + (1위면) 왕관 */
function RankBadge({ c, delay, crownAt }: { c: CandView; delay: number; crownAt: number }) {
  return (
    <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
      {c.win ? (
        <span
          style={{
            display: 'inline-flex',
            animation: `lp-pop .5s ${crownAt / 1000}s cubic-bezier(.2,.9,.3,1.5) both`,
          }}
        >
          <IconCrown size={20} />
        </span>
      ) : null}
      <span
        style={{
          height: 24,
          padding: '0 10px',
          borderRadius: 12,
          background: c.win ? AC : c.total ? 'oklch(0.93 0.02 50)' : 'oklch(0.94 0.004 75)',
          color: c.win ? 'white' : c.total ? AINK : MUTED,
          fontSize: 12,
          fontWeight: 780,
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          animation: `lp-pop .4s ${delay / 1000}s cubic-bezier(.2,.9,.3,1.4) both`,
        }}
      >
        {c.shared ? '공동 ' : ''}
        {c.rank}위
      </span>
    </div>
  );
}

/** 후보가 3곳 이상일 때의 칸 — 마감되면 순위 자리로 미끄러져 간다 (DOM 순서는 그대로). */
function Column({ c, slot, scale, ...p }: { c: CandView; slot: number; scale: number } & Common) {
  // 게이지는 1위 하트 수(적어도 한 사람 몫)에 맞춰 차오르고, 위쪽은 조금 비워 둔다.
  const fill = (c.total / Math.max(1, scale)) * 0.92;
  const shift = p.closed ? slot - c.i : 0;
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 12px 12px',
        borderRadius: 14,
        background: 'white',
        boxShadow: c.win
          ? `0 0 0 2px ${AC}, 0 12px 28px oklch(0.56 0.16 40 / .18)`
          : '0 0 0 1px oklch(0.91 0.006 75), 0 1px 3px oklch(0.5 0.02 60 / .05)',
        transform: `translateX(calc(${shift} * (100% + ${GAP}px))) scale(${c.win ? 1.03 : 1})`,
        opacity: p.closed && !c.win ? 0.78 : 1,
        transition: `transform ${PREF_SORT_MS * p.sp}ms cubic-bezier(.2,.8,.2,1), opacity .4s, box-shadow .4s`,
        position: 'relative',
        // backwards — 끝난 뒤에는 위의 transform(순위 자리)·opacity 가 그대로 먹게 한다.
        animation: `lp-pop .45s ${c.i * 0.06}s cubic-bezier(.2,.9,.3,1.3) backwards`,
      }}
    >
      {p.closed ? <RankBadge c={c} delay={p.badgeDelay(c.i)} crownAt={p.crownAt} /> : null}
      <CandHead c={c} onInfo={p.onInfo} />
      <div style={{ position: 'relative', borderRadius: 10, background: 'oklch(0.97 0.004 75)' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: '0 0 10px 10px',
            height: `${fill * 100}%`,
            background: c.win ? 'oklch(0.93 0.06 40)' : 'oklch(0.95 0.035 45)',
            borderTop: fill ? '2px solid oklch(0.85 0.08 40)' : 'none',
            transition: `height ${PREF_TILT_MS * p.sp}ms cubic-bezier(.2,.9,.3,1.25), background .4s`,
          }}
        />
        <Pile c={c} flyRef={p.flyRef} sp={p.sp} height={170} />
      </div>
      <CandFoot c={c} {...p} />
      {p.burst && c.win ? <Burst key={p.burst} sp={p.sp} delay={p.crownAt + 80} /> : null}
    </div>
  );
}

/** 후보가 2곳이면 시소 — 하트가 많은 쪽으로 기운다. 접시는 늘 똑바로 선다. */
function Seesaw({ a, b, ...p }: { a: CandView; b: CandView } & Common) {
  const sum = a.total + b.total;
  const ang = Math.max(-MAX_TILT, Math.min(MAX_TILT, (MAX_TILT * (b.total - a.total)) / Math.max(3, sum)));
  const tilt = `${PREF_TILT_MS * p.sp}ms cubic-bezier(.2,.9,.3,1.35)`;
  const pan = (c: CandView, side: 'left' | 'right') => (
    <div
      style={{
        position: 'absolute',
        [side]: -6,
        bottom: 8,
        width: '40%',
        transformOrigin: '50% 100%',
        transform: `rotate(${-ang}deg)`,
        transition: `transform ${tilt}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <div style={{ position: 'relative' }}>
        {p.closed && c.win ? (
          <div style={{ position: 'absolute', left: '50%', top: -24, transform: 'translateX(-50%)' }}>
            <span
              style={{
                display: 'inline-flex',
                animation: `lp-pop .5s ${p.crownAt / 1000}s cubic-bezier(.2,.9,.3,1.5) both`,
              }}
            >
              <IconCrown size={26} />
            </span>
          </div>
        ) : null}
        <Pile c={c} flyRef={p.flyRef} sp={p.sp} height={80} />
        {p.burst && c.win ? <Burst key={p.burst} sp={p.sp} delay={p.crownAt + 80} /> : null}
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 5,
          background: c.win ? AC : 'oklch(0.86 0.02 50)',
          boxShadow: '0 2px 4px oklch(0.4 0.02 60 / .15)',
          transition: 'background .4s',
        }}
      />
      <div style={{ width: 4, height: 12, margin: '0 auto', background: 'oklch(0.78 0.01 60)' }} />
    </div>
  );
  const card = (c: CandView) => (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 14,
        background: 'white',
        boxShadow: c.win
          ? `0 0 0 2px ${AC}, 0 12px 28px oklch(0.56 0.16 40 / .18)`
          : '0 0 0 1px oklch(0.91 0.006 75), 0 1px 3px oklch(0.5 0.02 60 / .05)',
        opacity: p.closed && !c.win ? 0.8 : 1,
        transition: 'opacity .4s, box-shadow .4s',
        animation: `lp-pop .45s ${c.i * 0.08}s cubic-bezier(.2,.9,.3,1.3) backwards`,
      }}
    >
      {p.closed ? <RankBadge c={c} delay={p.badgeDelay(c.i)} crownAt={p.crownAt} /> : null}
      <CandHead c={c} onInfo={p.onInfo} />
      <CandFoot c={c} {...p} />
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          position: 'relative',
          height: 300,
          borderRadius: 14,
          background: 'white',
          boxShadow: '0 0 0 1px oklch(0.91 0.006 75)',
        }}
        aria-hidden
      >
        {/* 받침 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 18,
            width: 0,
            height: 0,
            transform: 'translateX(-50%)',
            borderLeft: '26px solid transparent',
            borderRight: '26px solid transparent',
            borderBottom: `64px solid ${INK}`,
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '20%',
            right: '20%',
            bottom: 14,
            height: 4,
            borderRadius: 2,
            background: 'oklch(0.9 0.006 75)',
          }}
        />
        {/* 판 — 받침 꼭대기를 축으로 돈다 */}
        <div
          style={{
            position: 'absolute',
            left: '9%',
            right: '9%',
            bottom: 82,
            height: 8,
            borderRadius: 4,
            background: 'oklch(0.42 0.02 60)',
            transformOrigin: '50% 50%',
            transform: `rotate(${ang}deg)`,
            transition: `transform ${tilt}`,
          }}
        >
          {pan(a, 'left')}
          {pan(b, 'right')}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 14,
            bottom: 12,
            fontSize: 12,
            fontWeight: 700,
            color: MUTED_3,
          }}
        >
          {sum
            ? a.total === b.total
              ? '팽팽해요'
              : `${(a.total > b.total ? a : b).r?.name ?? ''} 쪽으로 기울었어요`
            : '하트를 걸면 기울어요'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: GAP }}>
        {card(a)}
        {card(b)}
      </div>
    </div>
  );
}

/** 1위에서 하트가 터져 퍼진다 (마감되는 순간을 본 화면에서만) */
function Burst({ sp, delay }: { sp: number; delay: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: BURST }, (_, i) => {
        const a = (i / BURST) * Math.PI * 2 + Math.random() * 0.35;
        const d = 60 + Math.random() * 70;
        return {
          dx: Math.cos(a) * d,
          dy: Math.sin(a) * d - 24,
          size: 10 + Math.random() * 9,
          hue: HUES[i % HUES.length],
          dur: (PREF_BURST_MS * (0.75 + Math.random() * 0.5) * sp).toFixed(0),
        };
      }),
    [sp],
  );
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%',
        top: '42%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      {pieces.map((q, i) => (
        <span
          key={i}
          style={
            {
              position: 'absolute',
              left: 0,
              top: 0,
              display: 'inline-flex',
              '--dx': `${q.dx}px`,
              '--dy': `${q.dy}px`,
              animation: `lp-burst ${q.dur}ms ${delay.toFixed(0)}ms cubic-bezier(.2,.7,.3,1) both`,
            } as React.CSSProperties
          }
        >
          <IconHeart size={q.size} color={`oklch(0.68 0.17 ${q.hue})`} />
        </span>
      ))}
    </div>
  );
}

/** 참여자 한 사람 — 다 걸었으면 ✓, 빠졌으면 '상관없음', 아니면 남은 하트 */
function MemberChip({ m, me, view }: { m: Member; me: string; view: PrefRun }) {
  const pass = view.pass.includes(m.id);
  const done = isDone(view, m.id);
  const left = view.hearts - betSum(view.bets[m.id] ?? []);
  return (
    <span
      title={m.name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 28,
        padding: '0 9px 0 3px',
        borderRadius: 14,
        background: done ? 'oklch(0.965 0.025 50)' : 'oklch(0.965 0.004 75)',
        opacity: m.online ? 1 : 0.55,
        transition: 'background .3s',
      }}
    >
      <Avatar m={m} size={22} />
      <span style={{ fontSize: 12, fontWeight: 650 }}>{m.id === me ? '나' : shortName(m.name)}</span>
      <span
        key={pass ? 'p' : done ? 'd' : 'w'}
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: done ? AINK : MUTED_3,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          animation: done ? 'lp-pop .4s cubic-bezier(.2,.9,.3,1.4) both' : 'none',
        }}
      >
        {pass ? '상관없음' : done ? <IconCheck size={11} stroke={3} /> : `♥${left} 남음`}
        {!m.online ? ' · 나감' : ''}
      </span>
    </span>
  );
}
