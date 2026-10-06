/**
 * 같이 고르기 패널. 호스트를 열거나 참여하면 앱 위로 올라오고, 접어 두면 오른쪽 아래 알약으로 남는다.
 *
 *   ┌ 머리: 방 정보 · 참여자 · 접기/나가기 ─────────────────────────────┐
 *   │ 가기 싫은 곳 │ AI 정렬 · 무작위 · 남은 식당 · 후보 트레이 │ 참여자·채팅 │
 *   └──────────────────────────────────────────────────────────┘
 */
import { useEffect, useState } from 'react';

import { copyText } from '../../lib/ipc';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, APP_BG, DANGER, HAIRLINE, INK, MUTED, OK_FG, PANEL } from '../../theme';
import Board from './Board';
import ChatPanel from './ChatPanel';
import DislikeColumn from './DislikeColumn';
import FinalOverlay from './FinalOverlay';
import InfoDrawer from './InfoDrawer';
import LadderOverlay from './LadderOverlay';
import { AvatarStack, IconChevronDown, IconCopy, IconUsers, btn, useBumpKey } from './parts';
import { useLadderAnim, useRollAnim } from './useRoomAnim';

const TITLEBAR_H = 38;
const CONFIRM_MS = 3000;

export default function TogetherPanel() {
  const room = useShare((s) => s.room);
  const open = useShare((s) => s.panelOpen);
  const ended = useShare((s) => s.ended);
  const dismissEnded = useShare((s) => s.dismissEnded);

  return (
    <>
      {room ? <Panel open={open} /> : null}
      {room && !open ? <Pill /> : null}
      {ended ? <EndedDialog reason={ended} onClose={dismissEnded} /> : null}
    </>
  );
}

function Panel({ open }: { open: boolean }) {
  const room = useShare((s) => s.room)!;
  const me = useShare((s) => s.myId);
  const role = useShare((s) => s.role);
  const status = useShare((s) => s.status);
  const info = useShare((s) => s.info);
  const target = useShare((s) => s.target);
  const closePanel = useShare((s) => s.closePanel);
  const stopHost = useShare((s) => s.stopHost);
  const leave = useShare((s) => s.leave);

  const [infoId, setInfoId] = useState<string | null>(null);
  const [finalSeen, setFinalSeen] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const roll = useRollAnim(room.roll);
  const [ladder, closeLadder] = useLadderAnim(room.ladder);

  const isHost = role === 'host';
  const online = room.members.filter((m) => m.online);
  const hostM = room.members.find((m) => m.host);
  const finalOpen = !!room.final && finalSeen !== room.final.at && !ladder;
  const addr = isHost
    ? info
      ? `${info.addrs[0] ?? info.pcName}:${info.port}`
      : ''
    : target
      ? `${target.host}:${target.port}`
      : '';
  const countKey = useBumpKey(online.length);

  useEffect(() => {
    if (!confirmEnd) return;
    const t = setTimeout(() => setConfirmEnd(false), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirmEnd]);

  // Esc: 정보 드로어 → 확정 화면 → 패널 순으로 닫는다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (infoId) setInfoId(null);
      else if (finalOpen && room.final) setFinalSeen(room.final.at);
      else closePanel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, infoId, finalOpen, room.final, closePanel]);

  const end = () => {
    if (isHost) {
      if (!confirmEnd) {
        setConfirmEnd(true);
        return;
      }
      void stopHost().then(() => toast('같이 고르기를 끝냈어요'));
    } else {
      leave();
      toast('같이 고르기에서 나왔어요');
    }
  };

  const infoRest = infoId ? (room.restaurants.find((r) => r.id === infoId) ?? null) : null;

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'absolute',
        top: TITLEBAR_H,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 12,
        background: APP_BG,
        display: 'flex',
        flexDirection: 'column',
        opacity: open ? 1 : 0,
        transform: open ? 'none' : 'translateY(28px) scale(.985)',
        visibility: open ? 'visible' : 'hidden',
        transition: open
          ? 'opacity .32s, transform .42s cubic-bezier(.2,.9,.3,1.1), visibility 0s'
          : 'opacity .22s, transform .28s, visibility 0s .28s',
      }}
    >
      {/* ---------------------------------------------------- 머리 */}
      <div
        style={{
          height: 58,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px 0 18px',
          background: PANEL,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: AC,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px oklch(0.56 0.16 40 / .3)',
            flex: 'none',
          }}
        >
          <IconUsers size={18} stroke={2} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>같이 고르기</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: MUTED,
              marginTop: 2,
            }}
          >
            <LiveDot warn={status === 'reconnecting'} />
            {status === 'reconnecting' ? (
              <span style={{ color: 'oklch(0.5 0.1 70)', fontWeight: 650 }}>
                연결이 잠깐 끊겼어요 — 다시 붙는 중…
              </span>
            ) : (
              <span style={{ color: OK_FG, fontWeight: 650 }}>
                {isHost ? '내가 호스트' : `${hostM?.name ?? '호스트'}님의 방`}
              </span>
            )}
            {addr ? (
              <span
                role="button"
                tabIndex={0}
                title="주소 복사"
                onClick={() => {
                  void copyText(addr);
                  toast(`${addr} 복사됨`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void copyText(addr);
                    toast(`${addr} 복사됨`);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                · {addr}
                <IconCopy size={12} />
              </span>
            ) : null}
            <span>· 식당 정보는 {isHost ? '내' : `${hostM?.name ?? '호스트'}님`} 목록 기준</span>
          </div>
        </div>

        <span style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AvatarStack members={online} size={26} max={6} />
          <span key={countKey} className="lp-pop" style={{ fontSize: 13, fontWeight: 700, color: INK }}>
            {online.length}명
          </span>
        </div>
        <span style={{ width: 1, height: 26, background: HAIRLINE, margin: '0 4px' }} />
        <button
          type="button"
          className="btn-ghost"
          onClick={closePanel}
          title="접어 두기 (Esc)"
          style={btn('ghost')}
        >
          <IconChevronDown size={16} />
          접기
        </button>
        <button
          type="button"
          className="btn-soft"
          onClick={end}
          style={{
            ...btn('soft'),
            color: DANGER,
            minWidth: isHost ? 92 : undefined,
            background: confirmEnd ? 'oklch(0.97 0.025 25)' : 'white',
          }}
        >
          {isHost ? (confirmEnd ? '한 번 더 누르면 종료' : '끝내기') : '나가기'}
        </button>
      </div>

      {/* ---------------------------------------------------- 본문 */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'clamp(190px, 18vw, 232px) minmax(0, 1fr) clamp(250px, 23vw, 300px)',
        }}
      >
        <DislikeColumn room={room} me={me} onInfo={setInfoId} />
        <Board
          room={room}
          me={me}
          roll={roll}
          onInfo={setInfoId}
          finalHidden={!!room.final && !finalOpen}
          onShowFinal={() => setFinalSeen(null)}
        />
        <ChatPanel room={room} me={me} isHost={isHost} />

        <InfoDrawer
          rest={infoRest}
          disliked={!!infoRest && !!room.dislikes[infoRest.id]?.length}
          onClose={() => setInfoId(null)}
        />
        {ladder ? <LadderOverlay view={ladder} room={room} onClose={closeLadder} /> : null}
        {finalOpen ? <FinalOverlay room={room} onClose={() => setFinalSeen(room.final!.at)} /> : null}
      </div>
    </div>
  );
}

function LiveDot({ warn }: { warn?: boolean }) {
  const c = warn ? 'oklch(0.72 0.14 75)' : 'oklch(0.62 0.15 150)';
  return (
    <span style={{ position: 'relative', width: 8, height: 8, flex: 'none', display: 'inline-block' }}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: c,
          animation: warn ? 'lp-breathe 1s infinite' : 'lp-ping 1.8s cubic-bezier(0,.6,.4,1) infinite',
        }}
      />
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: c }} />
    </span>
  );
}

/** 패널을 접어 두었을 때 오른쪽 아래에 남는 알약 */
function Pill() {
  const room = useShare((s) => s.room)!;
  const unread = useShare((s) => s.unread);
  const status = useShare((s) => s.status);
  const openPanel = useShare((s) => s.openPanel);
  const online = room.members.filter((m) => m.online);
  const bump = useBumpKey(unread);
  return (
    <button
      type="button"
      key={bump}
      onClick={openPanel}
      className={unread ? 'lp-bounce' : 'lp-pop'}
      style={{
        position: 'absolute',
        right: 20,
        bottom: 20,
        zIndex: 14,
        height: 44,
        padding: '0 16px 0 10px',
        border: 'none',
        borderRadius: 22,
        background: INK,
        color: 'white',
        font: 'inherit',
        fontSize: 13.5,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        boxShadow: '0 12px 30px rgba(0,0,0,.22)',
      }}
    >
      <LiveDot warn={status === 'reconnecting'} />
      <AvatarStack members={online} size={24} max={4} />
      같이 고르기
      {unread ? (
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 10,
            background: AC,
            fontSize: 11.5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {unread}
        </span>
      ) : null}
    </button>
  );
}

function EndedDialog({ reason, onClose }: { reason: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 26,
        background: 'oklch(0.25 0.012 60 / .32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'lp-fade-in .2s both',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: 'calc(100% - 40px)',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'lp-zoom-in .4s cubic-bezier(.2,.9,.3,1.1) both',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 780 }}>같이 고르기가 끝났어요</div>
        <div style={{ fontSize: 13.5, color: 'oklch(0.35 0.012 60)', lineHeight: 1.6 }}>{reason}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-accent" onClick={onClose} style={btn('accent')}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
