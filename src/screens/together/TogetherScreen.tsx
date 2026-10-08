/**
 * 같이 고르기 방 (시안: 같이 고르기.dc.html › 같이 고르기 방).
 *
 *   ┌ 머리: ‹ · 방 이름 · ①가기 싫은 곳 빼기 ─ ②후보 올리기 ─ ③추려내기 ─ ④최종 확정 ─ ⑤메뉴 고르기 ─ ⑥예약 완료 · 나가기 ┐
 *   │ 가기 싫은 곳 │ 남은 식당 (무작위 · AI 정렬 · 카드) · 후보 트레이 │ 참여자 · 채팅 │
 *   └─────────────────────────────────────────────────────────────────────┘
 * 확정되면 가운데 열은 메뉴 고르기 · 예약(OrderPanel)으로 바뀐다.
 * 사이드바는 접히고(Sidebar), 방은 아래에서 떠오른다(lp-rise).
 */
import { useCallback, useEffect, useState } from 'react';

import type { RoomState } from '../../share/protocol';
import { reservationAuthor, shortName } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { useUi } from '../../store/uiStore';
import { AC, AINK, MUTED } from '../../theme';
import AiTurnModal from './AiTurnModal';
import Board from './Board';
import ChatPanel from './ChatPanel';
import DislikeColumn from './DislikeColumn';
import FinalModal from './FinalModal';
import InfoDrawer from './InfoDrawer';
import LadderModal from './LadderModal';
import OrderPanel from './OrderPanel';
import { IconBack, IconCheck, IconSync, StatusDot } from './parts';
import ReservedModal from './ReservedModal';
import ReserveModal from './ReserveModal';
import SyncBanner from './SyncBanner';
import { useRollAnim } from './useRoomAnim';

export default function TogetherScreen() {
  const room = useShare((s) => s.room);
  const setView = useUi((s) => s.setView);
  // 방이 사라지면(서버 꺼짐·연결 끊김) 설정으로 돌아간다 — 안내는 EndedDialog 가 한다.
  useEffect(() => {
    if (!room) setView('settings');
  }, [room, setView]);
  return room ? <Room room={room} /> : null;
}

function Room({ room }: { room: RoomState }) {
  const me = useShare((s) => s.myId);
  const role = useShare((s) => s.role);
  const status = useShare((s) => s.status);
  const info = useShare((s) => s.info);
  const target = useShare((s) => s.target);
  const leave = useShare((s) => s.leave);
  const startSync = useShare((s) => s.startSync);
  const setView = useUi((s) => s.setView);

  const [detail, setDetail] = useState<string | null>(null);
  /** 열어 둔 AI 큐 팝업 (요청 id) — 각자 연다 */
  const [aiOpen, setAiOpen] = useState<string | null>(null);
  const closeAi = useCallback(() => setAiOpen(null), []);
  /** 닫은 확정 화면 (확정 시각으로 구분) — 각자 닫는다 */
  const [finSeen, setFinSeen] = useState<number | null>(null);
  /** 닫은 예약 알림 (예약·수정 시각으로 구분) — 각자 닫는다 */
  const [resSeen, setResSeen] = useState<number | null>(null);
  /** 내 예약 화면 — 나만 연다 (다른 사람들에게는 '예약하는 중'으로 보인다) */
  const [reserveOpen, setReserveOpen] = useState(false);
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
  // 예약 알림은 예약(수정)을 보낸 사람 말고 모두에게 뜬다. 떠 있는 동안 확정 화면은 감춘다.
  const resOpen = !!res && resSeen !== res.at && reservationAuthor(res) !== me;
  const finOpen = !!room.final && finSeen !== room.final.at && !resOpen;
  const closeRes = () => {
    if (res) setResSeen(res.at);
    // 예약 알림을 닫으면 확정 화면이 뒤이어 뜨지 않게 한다.
    if (room.final) setFinSeen(room.final.at);
  };
  const finalName = room.final ? room.restaurants.find((r) => r.id === room.final!.restId)?.name : '';
  const sync = room.sync && !room.sync.end ? room.sync : null;
  const syncAnswered = sync ? Object.keys(sync.answers).length : 0;
  const syncTotal = sync
    ? syncAnswered + room.members.filter((m) => m.online && sync.answers[m.id] === undefined).length
    : 0;

  // Esc: 예약 화면 → 예약 알림 → 확정 화면 → AI 큐 팝업 → 식당 정보 순으로 닫는다
  // (사다리는 모두의 화면이라 ✕ 로만 닫는다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (reserveOpen) setReserveOpen(false);
      else if (resOpen && res) {
        setResSeen(res.at);
        if (room.final) setFinSeen(room.final.at);
      } else if (finOpen && room.final) setFinSeen(room.final.at);
      else if (aiOpen) setAiOpen(null);
      else if (detail) setDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reserveOpen, resOpen, res, finOpen, room.final, aiOpen, detail]);

  // 보던 식당이 지워지면 정보 드로어를 닫는다.
  useEffect(() => {
    if (detail && !room.restaurants.some((r) => r.id === detail)) setDetail(null);
  }, [detail, room.restaurants]);

  // 확정되면 열려 있던 식당 정보는 닫는다. 확정이 풀리면 예약 화면도 닫는다.
  useEffect(() => {
    if (room.final) setDetail(null);
    else setReserveOpen(false);
  }, [room.final]);

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
              {hostShort}님의 점심 방
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
              : `식당 ${room.restaurants.length}곳 · ${addr} · 화면 실시간 공유 중`}
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
                padding: '0 13px 0 9px',
                borderRadius: 16,
                background: 'oklch(0.95 0.04 150)',
                color: 'oklch(0.36 0.1 150)',
                fontSize: 13,
                fontWeight: 720,
                cursor: 'pointer',
                animation: 'lp-pop .45s cubic-bezier(.2,.9,.3,1.4)',
              }}
            >
              <IconCheck size={14} />
              오늘은 {finalName}
              {res ? ' · 예약 완료' : ''}
            </div>
          ) : null}
          <button
            type="button"
            className={sync ? '' : 'tg-soft'}
            disabled={!!sync}
            onClick={startSync}
            title={
              sync
                ? `응답 ${syncAnswered}/${syncTotal} · 수락 ${Object.values(sync.answers).filter(Boolean).length} — 모두 답하거나 1분이 지나면 마무리해요`
                : '참여자들과 식당 목록을 합쳐요 — 모두에게 수락/거절을 물어봐요'
            }
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
              cursor: sync ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: sync ? 0.7 : 1,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <IconSync size={14} />
            {sync ? `동기화 중 ${syncAnswered}/${syncTotal}` : '식당 동기화'}
          </button>
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
        <DislikeColumn room={room} me={me} onInfo={setDetail} />
        {room.final ? (
          <OrderPanel
            room={room}
            me={me}
            host={host}
            onInfo={setDetail}
            onReserve={() => setReserveOpen(true)}
          />
        ) : (
          <Board room={room} me={me} roll={roll} onInfo={setDetail} onAiOpen={setAiOpen} />
        )}
        <ChatPanel room={room} me={me} host={host} detail={detail} />
        <SyncBanner room={room} me={me} host={host} />
      </div>

      <InfoDrawer room={room} id={detail} host={host} hostShort={hostShort} onClose={() => setDetail(null)} />
      {aiOpen ? <AiTurnModal room={room} me={me} turnId={aiOpen} onClose={closeAi} /> : null}
      {room.ladder ? <LadderModal room={room} me={me} /> : null}
      {reserveOpen && room.final ? (
        <ReserveModal room={room} me={me} host={host} onClose={closeReserve} />
      ) : null}
      {finOpen ? <FinalModal room={room} me={me} onClose={() => setFinSeen(room.final!.at)} /> : null}
      {resOpen ? <ReservedModal room={room} me={me} onClose={closeRes} /> : null}
    </div>
  );
}

/**
 * ①가기 싫은 곳 빼기 ─ ②후보 올리기 ─ ③추려내기 ─ ④최종 확정 ─ ⑤메뉴 고르기 ─ ⑥예약 완료.
 * 지금 단계는 은은하게 빛난다. 머리 폭(최소 창 1040px)에 맞게 확정 전에는 ①~④만, 확정 뒤에는 ④~⑥만 보이고,
 * 지나간 ④⑤는 체크 동그라미로 줄인다 (이름은 툴팁, 식당 이름은 머리의 '오늘은 …' 에 보인다).
 */
function Steps({ room }: { room: RoomState }) {
  const exclCount = room.exclOrder.length;
  const candCount = Object.keys(room.cands).length;
  const finalName = room.final ? (room.restaurants.find((r) => r.id === room.final!.restId)?.name ?? '') : '';
  const people = room.members.filter((m) => m.online || room.picks[m.id]?.items.length);
  const picked = people.filter((m) => room.picks[m.id]?.items.length).length;
  const res = room.reservation;
  const at = res ? 5 : room.final ? 4 : room.ladder || candCount >= 2 ? 2 : exclCount || candCount ? 1 : 0;
  const steps: [string, string][] = [
    ['가기 싫은 곳 빼기', exclCount ? String(exclCount) : ''],
    ['후보 올리기', candCount ? String(candCount) : ''],
    ['추려내기', ''],
    ['최종 확정', finalName],
    ['메뉴 고르기', room.final ? `${picked}/${people.length}` : ''],
    ['예약 완료', res ? shortName(room.members.find((m) => m.id === res.by)?.name ?? '') : ''],
  ];
  const last = steps.length - 1;
  const shown = room.final ? [3, 4, 5] : [0, 1, 2, 3];
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 0,
        flexWrap: 'wrap',
      }}
    >
      {shown.map((i, k) => {
        const [label, count] = steps[i];
        const done = i < at;
        const cur = i === at;
        const mini = room.final && done;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              title={mini ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 30,
                padding: mini ? '0 5px' : '0 12px 0 5px',
                borderRadius: 15,
                background: cur ? AC : done ? 'oklch(0.965 0.025 50)' : 'oklch(0.955 0.005 75)',
                color: cur ? 'white' : done ? AINK : MUTED,
                fontSize: 12.5,
                fontWeight: 650,
                whiteSpace: 'nowrap',
                transition: 'background .4s, color .4s',
                animation: cur && i < last ? 'lp-glow 2.2s infinite' : 'none',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: cur ? 'oklch(1 0 0 / .22)' : done ? 'oklch(0.9 0.05 50)' : 'white',
                  color: cur ? 'white' : done ? AINK : MUTED,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background .4s',
                }}
              >
                {done ? <IconCheck size={11} stroke={3} /> : i + 1}
              </span>
              {mini ? null : label}
              {count && !mini ? (
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>{count}</span>
              ) : null}
            </div>
            {k < shown.length - 1 ? (
              <div
                style={{
                  width: 16,
                  height: 2,
                  borderRadius: 2,
                  background: done ? 'oklch(0.8 0.08 50)' : 'oklch(0.9 0.006 75)',
                  transition: 'background .4s',
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
