/**
 * 도란식사 정하기 방 — 같이 고르기와 같은 방(실시간 공유 · 오른쪽 참여자·채팅)인데, 식당 목록은 방 안에서
 * 모두가 입력하고, 식당 + 메뉴 구성으로 만든 '선택지'를 좁혀 정한다.
 *
 *   ┌ 머리: ‹ · ○○님의 도란식사 방 · ①식당 올리기 ─ ②선택지 만들기 ─ ③추려내기 ─ ④최종 확정 ─ ⑤예약 완료 · 나가기 ┐
 *   │ 식당 (추가·불러오기) │ 총사용금액 · 도구 · 선택지 카드 (확정 뒤: 확정된 선택지 · 예약) │ 참여자 · 채팅 │
 *   └──────────────────────────────────────────────────────────────────────────────────────┘
 * 하트 걸기는 왼쪽 두 열을 덮고(PrefStage), 사다리·확정·예약 알림은 점심 방과 같은 창을 쓴다.
 */
import { useCallback, useEffect, useState } from 'react';

import { choiceName, choiceOf } from '../../share/doran';
import { reservationAuthor, type RoomState, shortName } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { useUi } from '../../store/uiStore';
import { MUTED } from '../../theme';
import ChatPanel from '../together/ChatPanel';
import FinalModal from '../together/FinalModal';
import { isDone } from '../../share/pref';
import LadderModal from '../together/LadderModal';
import { IconBack, IconCheck, StatusDot } from '../together/parts';
import PrefStage from '../together/PrefStage';
import ReservedModal from '../together/ReservedModal';
import ReserveModal from '../together/ReserveModal';
import StepTrack from '../together/StepTrack';
import { useRollAnim } from '../together/useRoomAnim';
import ChoiceModal from './ChoiceModal';
import DoranBoard from './DoranBoard';
import DoranFinalPanel from './DoranFinalPanel';
import DoranLibraryModal from './DoranLibraryModal';
import DoranRestColumn from './DoranRestColumn';
import DoranRestModal from './DoranRestModal';

type RestOpen = { id: string | null } | null;
type ChoiceOpen = { restId?: string; editId?: string } | null;

export default function DoranRoom({ room }: { room: RoomState }) {
  const me = useShare((s) => s.myId);
  const role = useShare((s) => s.role);
  const status = useShare((s) => s.status);
  const info = useShare((s) => s.info);
  const target = useShare((s) => s.target);
  const leave = useShare((s) => s.leave);
  const setView = useUi((s) => s.setView);

  /** 식당 추가(id null) · 정보 수정 — 각자 연다 */
  const [restOpen, setRestOpen] = useState<RestOpen>(null);
  const [choiceOpen, setChoiceOpen] = useState<ChoiceOpen>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [finSeen, setFinSeen] = useState<number | null>(null);
  const [resSeen, setResSeen] = useState<number | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);
  const closeRest = useCallback(() => setRestOpen(null), []);
  const closeChoice = useCallback(() => setChoiceOpen(null), []);
  const closeLib = useCallback(() => setLibOpen(false), []);
  const closeReserve = useCallback(() => setReserveOpen(false), []);
  const roll = useRollAnim(room.roll);

  const host = role === 'host';
  const hostShort = shortName(room.members.find((m) => m.host)?.name ?? '호스트');
  const addr = host
    ? info
      ? `${info.addrs[0] ?? info.pcName}:${info.port}`
      : ''
    : target
      ? `${target.host}:${target.port}`
      : '';
  const res = room.reservation;
  const resOpen = !!res && resSeen !== res.at && reservationAuthor(res) !== me;
  const finOpen = !!room.final && finSeen !== room.final.at && !resOpen;
  const closeRes = () => {
    if (res) setResSeen(res.at);
    if (room.final) setFinSeen(room.final.at);
  };
  const finalChoice = room.final?.choiceId ? choiceOf(room, room.final.choiceId) : undefined;
  const finalName = finalChoice
    ? `${choiceName(finalChoice)} ${finalChoice.label || room.restaurants.find((r) => r.id === finalChoice.restId)?.name || ''}`
    : '';
  const lock = !!room.final || !!room.ladder || !!room.pref || (!!room.roll && !room.roll.done);
  const editRest = restOpen?.id ? room.restaurants.find((r) => r.id === restOpen.id) : undefined;

  // Esc: 예약 화면 → 예약 알림 → 확정 화면 순으로 닫는다 (식당·선택지·보관함 창은 각자 Esc 를 먼저 받는다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (reserveOpen) setReserveOpen(false);
      else if (resOpen && res) {
        setResSeen(res.at);
        if (room.final) setFinSeen(room.final.at);
      } else if (finOpen && room.final) setFinSeen(room.final.at);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reserveOpen, resOpen, res, finOpen, room.final]);

  // 고치던 식당이 지워지면 정보 창을 닫는다. 확정이 풀리면 예약 화면도 닫는다.
  useEffect(() => {
    if (restOpen?.id && !editRest) setRestOpen(null);
  }, [restOpen, editRest]);
  useEffect(() => {
    if (!room.final) setReserveOpen(false);
    else setChoiceOpen(null);
  }, [room.final]);

  const openChoice = (o: NonNullable<ChoiceOpen>) => {
    setRestOpen(null);
    setChoiceOpen(o);
  };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        animation: 'lp-rise .5s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      {/* ------------------------------------------------ 방 머리 */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 18px',
          borderBottom: '1px solid oklch(0.91 0.006 75)',
          background: 'white',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="tg-soft"
          onClick={() => setView('settings')}
          title="설정으로"
          style={{
            width: 34,
            height: 34,
            border: '1px solid oklch(0.88 0.006 75)',
            borderRadius: 8,
            background: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'oklch(0.42 0.012 60)',
            flex: 'none',
          }}
        >
          <IconBack size={16} />
        </button>
        <div style={{ minWidth: 0, flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot tone={status === 'reconnecting' ? 'wait' : 'live'} />
            <span style={{ fontSize: 16, fontWeight: 760, letterSpacing: '-0.01em' }}>
              {hostShort}님의 도란식사 방
            </span>
            <span
              style={{
                height: 20,
                padding: '0 7px',
                borderRadius: 6,
                background: 'oklch(0.955 0.005 75)',
                color: 'oklch(0.45 0.012 60)',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                flex: 'none',
              }}
            >
              {host ? '호스트' : '참여자'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {status === 'reconnecting'
              ? '연결이 잠깐 끊겼어요 · 다시 붙는 중…'
              : `식당 ${room.restaurants.length}곳 · 선택지 ${room.choices.length}개 · ${addr} · 화면 실시간 공유 중`}
          </div>
        </div>
        <Steps room={room} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          {room.final && !finOpen && !resOpen ? (
            <div
              role="button"
              tabIndex={0}
              title={res ? '예약 내용 보기' : '확정 화면 다시 보기'}
              onClick={() => (res ? setResSeen(null) : setFinSeen(null))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (res ? setResSeen : setFinSeen)(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 32,
                maxWidth: 260,
                padding: '0 13px 0 9px',
                borderRadius: 16,
                background: 'oklch(0.95 0.04 150)',
                color: 'oklch(0.36 0.1 150)',
                fontSize: 13,
                fontWeight: 720,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                animation: 'lp-pop .45s cubic-bezier(.2,.9,.3,1.4)',
              }}
            >
              <IconCheck size={14} />
              {finalName}
              {res ? ' · 예약 완료' : ''}
            </div>
          ) : null}
          <button
            type="button"
            className="tg-soft"
            onClick={() => (host ? setView('settings') : leave())}
            style={{
              height: 32,
              padding: '0 12px',
              border: '1px solid oklch(0.88 0.006 75)',
              borderRadius: 8,
              background: 'white',
              color: 'oklch(0.42 0.012 60)',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {host ? '설정으로' : '방 나가기'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ 본문 3열 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '236px minmax(0,1fr) 300px',
          position: 'relative',
        }}
      >
        <DoranRestColumn
          room={room}
          lock={lock}
          onAdd={() => setRestOpen({ id: null })}
          onLibrary={() => setLibOpen(true)}
          onOpen={(id) => setRestOpen({ id })}
          onChoice={(restId) => openChoice({ restId })}
        />
        {room.final ? (
          <DoranFinalPanel
            room={room}
            me={me}
            host={host}
            onReserve={() => setReserveOpen(true)}
            onInfo={(id) => setRestOpen({ id })}
          />
        ) : (
          <DoranBoard
            room={room}
            me={me}
            roll={roll}
            onNew={() => openChoice({})}
            onEdit={(editId) => openChoice({ editId })}
            onInfo={(id) => setRestOpen({ id })}
          />
        )}
        <ChatPanel room={room} me={me} host={host} detail={null} />
        {/* 하트 걸기는 가운데(식당 열 + 보드)만 덮는다 — 채팅·참여자는 그대로 쓴다 */}
        {room.pref && !room.final ? (
          <PrefStage key={room.pref.id} room={room} me={me} onInfo={(id) => setRestOpen({ id })} />
        ) : null}
      </div>

      {room.ladder ? <LadderModal room={room} me={me} /> : null}
      {reserveOpen && room.final ? (
        <ReserveModal room={room} me={me} host={host} onClose={closeReserve} />
      ) : null}
      {finOpen ? <FinalModal room={room} me={me} onClose={() => setFinSeen(room.final!.at)} /> : null}
      {resOpen ? <ReservedModal room={room} me={me} onClose={closeRes} /> : null}
      {restOpen ? (
        <DoranRestModal
          key={restOpen.id ?? 'new'}
          room={room}
          rest={editRest}
          onClose={closeRest}
          onChoice={lock ? undefined : (restId) => openChoice({ restId })}
        />
      ) : null}
      {choiceOpen ? (
        <ChoiceModal
          key={choiceOpen.editId ?? choiceOpen.restId ?? 'new'}
          room={room}
          restId={choiceOpen.restId}
          editId={choiceOpen.editId}
          onClose={closeChoice}
        />
      ) : null}
      {libOpen ? <DoranLibraryModal room={room} onClose={closeLib} /> : null}
    </div>
  );
}

/**
 * ①식당 올리기 ─ ②선택지 만들기 ─ ③추려내기 ─ ④최종 확정 ─ ⑤예약 완료.
 * 머리 폭에 맞게 확정 전에는 ①~④, 확정 뒤에는 ③~⑤만 보인다.
 */
function Steps({ room }: { room: RoomState }) {
  const live = room.choices.filter((c) => room.cands[c.id]).length;
  const res = room.reservation;
  const pref = room.pref;
  const at = res
    ? 4
    : room.final
      ? 3
      : room.choices.length >= 2 || pref || room.ladder
        ? 2
        : room.restaurants.length
          ? 1
          : 0;
  const online = room.members.filter((m) => m.online);
  const narrowing = pref
    ? pref.closed
      ? '♥ 결과'
      : `♥ ${online.filter((m) => isDone(pref, m.id)).length}/${online.length}`
    : room.choices.length
      ? `${live}/${room.choices.length}`
      : '';
  const finalChoice = room.final?.choiceId ? choiceOf(room, room.final.choiceId) : undefined;
  const steps: [string, string][] = [
    ['식당 올리기', room.restaurants.length ? String(room.restaurants.length) : ''],
    ['선택지 만들기', room.choices.length ? String(room.choices.length) : ''],
    ['추려내기', narrowing],
    ['최종 확정', finalChoice ? choiceName(finalChoice) : ''],
    ['예약 완료', res ? shortName(room.members.find((m) => m.id === res.by)?.name ?? '') : ''],
  ];
  return (
    <StepTrack steps={steps} at={at} shown={room.final ? [2, 3, 4] : [0, 1, 2, 3]} compact={!!room.final} />
  );
}
