/**
 * 식당 정보 동기화 알림 — 아직 답하지 않은 사람에게만 방 본문 위쪽 가운데에 떠서 수락/거절을 묻는다.
 * 답하고 나면 사라지고(진행은 머리의 '동기화 중 n/m' 버튼에 보인다), 결과는 채팅 한 줄과 토스트로 알린다.
 */
import { useEffect, useRef, useState } from 'react';

import { type RoomState, shortName } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, MUTED } from '../../theme';
import { AvatarStack, IconSync, btnAccent, btnSoft, memberOf } from './parts';

export default function SyncBanner({ room, me, host }: { room: RoomState; me: string; host: boolean }) {
  const answer = useShare((s) => s.answerSync);
  const run = room.sync;
  const open = !!run && !run.end && run.answers[me] === undefined;
  const [, setTick] = useState(0);
  // 마감 시각은 호스트 시계라, 참여자는 처음 본 때부터 센다.
  const seen = useRef<{ id: string; at: number } | null>(null);
  if (run && seen.current?.id !== run.id) seen.current = { id: run.id, at: host ? run.at : Date.now() };

  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [open]);

  if (!run || !open) return null;
  const left = Math.max(0, Math.ceil((seen.current!.at + (run.until - run.at) - Date.now()) / 1000));
  const yes = room.members.filter((m) => run.answers[m.id] === true);
  const by = run.by === me ? '내가' : `${shortName(memberOf(room, run.by)?.name ?? '누군가')}님이`;

  return (
    <div
      role="alertdialog"
      aria-label="식당 정보 동기화"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 24,
        width: 460,
        maxWidth: 'calc(100% - 32px)',
        background: 'white',
        borderRadius: 12,
        boxShadow: `0 0 0 1px oklch(0.88 0.03 50), 0 16px 40px oklch(0.3 0.03 60 / .18)`,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'lp-rise .45s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'oklch(0.965 0.025 50)',
            color: AC,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <IconSync size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 750 }}>{by} 식당 정보를 동기화하자고 해요</div>
          <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginTop: 3 }}>
            수락한 사람끼리 식당 목록을 합쳐요. 내 목록에 없는 식당·메뉴가 더해지고, 있던 정보는 그대로예요.
            {host ? ' 방 목록은 내 목록이라 내가 수락해야 합쳐져요.' : ' 호스트가 수락해야 합쳐져요.'}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: MUTED,
            fontVariantNumeric: 'tabular-nums',
            flex: 'none',
            paddingTop: 2,
          }}
        >
          {left}초
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED, flex: 1 }}>
          <AvatarStack members={yes} size={20} />
          수락 {yes.length}
        </span>
        <button type="button" className="tg-soft" onClick={() => answer(false)} style={btnSoft(34, 14)}>
          거절
        </button>
        <button type="button" className="tg-accent" onClick={() => answer(true)} style={btnAccent(34, 16)}>
          수락
        </button>
      </div>
    </div>
  );
}
