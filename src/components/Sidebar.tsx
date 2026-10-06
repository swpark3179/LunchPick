import { AC, HAIRLINE, INK, MUTED, MUTED_3, PANEL } from '../theme';
import { todayText } from '../lib/util';
import type { View } from '../lib/types';
import { useData } from '../store/dataStore';
import { useList } from '../store/listStore';
import { useShare } from '../store/shareStore';
import { useUi } from '../store/uiStore';

const NAV: { id: View; label: string }[] = [
  { id: 'list', label: '식당 목록' },
  { id: 'pick', label: '오늘 뭐 먹지?' },
  { id: 'settings', label: '설정' },
];

export default function Sidebar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const count = useData((s) => s.restaurants.length);
  const openNew = useList((s) => s.openNew);

  return (
    <div
      style={{
        width: 212,
        flex: 'none',
        background: PANEL,
        borderRight: `1px solid ${HAIRLINE}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 10px',
        gap: 4,
      }}
    >
      <div style={{ padding: '4px 10px 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>점심픽</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{todayText()}</div>
      </div>

      {NAV.map((n) => {
        const on = view === n.id;
        return (
          <div
            key={n.id}
            role="button"
            tabIndex={0}
            onClick={() => setView(n.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setView(n.id);
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 38,
              padding: '0 12px',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 14,
              background: on ? 'oklch(0.995 0.002 75)' : 'transparent',
              color: on ? INK : 'oklch(0.42 0.012 60)',
              fontWeight: on ? 680 : 500,
              boxShadow: on ? '0 1px 2px oklch(0.4 0.02 60 / .12)' : 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 11,
                bottom: 11,
                width: 3,
                borderRadius: 3,
                background: on ? AC : 'transparent',
              }}
            />
            <span>{n.label}</span>
            <span
              style={{
                fontSize: 12,
                color: 'oklch(0.55 0.012 60)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n.id === 'list' ? count : ''}
            </span>
          </div>
        );
      })}

      <button
        type="button"
        className="btn-accent"
        onClick={openNew}
        style={{
          marginTop: 12,
          height: 36,
          border: 'none',
          borderRadius: 7,
          background: AC,
          color: 'white',
          font: 'inherit',
          fontSize: 13.5,
          fontWeight: 650,
          cursor: 'pointer',
        }}
      >
        + 식당 등록
      </button>

      <div style={{ flex: 1 }} />

      <ShareStatusCard onSettings={() => setView('settings')} />

      <div style={{ fontSize: 11.5, color: MUTED_3, padding: '8px 10px 0', lineHeight: 1.5 }}>
        변경 사항은 이 PC에 자동 저장됩니다.
      </div>
    </div>
  );
}

/** 사이드바 아래의 같이 고르기 상태. 연결 중이면 눌러서 패널을 열고, 아니면 설정으로 간다. */
function ShareStatusCard({ onSettings }: { onSettings: () => void }) {
  const role = useShare((s) => s.role);
  const status = useShare((s) => s.status);
  const room = useShare((s) => s.room);
  const unread = useShare((s) => s.unread);
  const openPanel = useShare((s) => s.openPanel);

  const live = !!room && (status === 'hosting' || status === 'connected' || status === 'reconnecting');
  const online = room?.members.filter((m) => m.online).length ?? 0;
  const hostName = room?.members.find((m) => m.host)?.name;
  const warn = status === 'reconnecting' || status === 'connecting' || status === 'starting';
  const dot = live && !warn ? 'oklch(0.62 0.15 150)' : warn ? 'oklch(0.72 0.14 75)' : 'oklch(0.75 0.01 60)';
  const title = !live
    ? warn
      ? '같이 고르기 연결 중…'
      : '같이 고르기'
    : role === 'host'
      ? '같이 고르기 진행 중'
      : `${hostName ?? '호스트'}님 방 참여 중`;
  const sub = !live
    ? warn
      ? '잠시만 기다려 주세요'
      : '설정에서 서버를 열거나 참여해요'
    : status === 'reconnecting'
      ? '다시 연결하는 중…'
      : `${online}명 · ${role === 'host' ? '내가 호스트' : '눌러서 열기'}`;
  const go = () => (live ? openPanel() : onSettings());

  return (
    <div
      role="button"
      tabIndex={0}
      className="srv-card"
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') go();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 10px',
        borderRadius: 7,
        cursor: 'pointer',
        background: live ? 'oklch(0.975 0.02 150)' : 'oklch(0.99 0.002 75)',
        border: `1px solid ${live ? 'oklch(0.88 0.05 150)' : HAIRLINE}`,
        transition: 'background .3s, border-color .3s',
      }}
    >
      <span style={{ position: 'relative', width: 8, height: 8, flex: 'none' }}>
        {live && !warn ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: dot,
              animation: 'lp-ping 1.8s cubic-bezier(0,.6,.4,1) infinite',
            }}
          />
        ) : null}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: dot,
            animation: warn ? 'lp-breathe 1s infinite' : 'none',
          }}
        />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 650,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: MUTED }}>{sub}</div>
      </div>
      {unread ? (
        <span
          key={unread}
          className="lp-pop"
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: AC,
            color: 'white',
            fontSize: 11,
            fontWeight: 750,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          {unread}
        </span>
      ) : null}
    </div>
  );
}
