import { AC, HAIRLINE, INK, MUTED, MUTED_3, PANEL } from '../theme';
import { todayText } from '../lib/util';
import type { View } from '../lib/types';
import { shortName } from '../share/protocol';
import { useData } from '../store/dataStore';
import { useList } from '../store/listStore';
import { isLive, useShare } from '../store/shareStore';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';

const NAV: { id: View; label: string }[] = [
  { id: 'list', label: '식당 목록' },
  { id: 'pick', label: '오늘 뭐 먹지?' },
  { id: 'together', label: '같이 고르기' },
  { id: 'settings', label: '설정' },
];

const SB_W = 212;
const OK = 'oklch(0.62 0.15 150)';
const AMBER = 'oklch(0.75 0.14 75)';
const GRAY = 'oklch(0.75 0.01 60)';

export default function Sidebar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const count = useData((s) => s.restaurants.length);
  const openNew = useList((s) => s.openNew);
  const share = useShare();
  const live = isLive(share);
  const people = share.room?.members.filter((m) => m.online).length ?? 0;

  const go = (v: View) => (v === 'together' ? share.enterRoom() : setView(v));

  return (
    // 같이 고르기 방에서는 사이드바를 접어 방을 넓게 쓴다 (시안: width .45s).
    <div
      style={{
        width: view === 'together' ? 0 : SB_W,
        flex: 'none',
        overflow: 'hidden',
        transition: 'width .45s cubic-bezier(.2,.8,.2,1)',
        background: PANEL,
        borderRight: `1px solid ${HAIRLINE}`,
      }}
    >
      <div
        style={{
          width: SB_W,
          height: '100%',
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
          const right =
            n.id === 'list'
              ? String(count)
              : n.id === 'together' && live
                ? share.unread
                  ? ''
                  : `${people}명`
                : '';
          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => go(n.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') go(n.id);
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {n.label}
                {n.id === 'together' && live ? (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: OK,
                      animation: 'lp-breathe 2s infinite',
                    }}
                  />
                ) : null}
              </span>
              {n.id === 'together' && live && share.unread ? (
                <span
                  key={share.unread}
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
                    animation: 'lp-pop .35s ease-out both',
                  }}
                >
                  {share.unread}
                </span>
              ) : (
                <span
                  style={{ fontSize: 12, color: 'oklch(0.55 0.012 60)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {right}
                </span>
              )}
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
    </div>
  );
}

/** 사이드바 아래의 같이 고르기 상태 (시안의 sc). 연결 중이면 눌러서 방으로, 아니면 설정으로. */
function ShareStatusCard({ onSettings }: { onSettings: () => void }) {
  const share = useShare();
  const port = useSettings((s) => s.port);
  const mode = useSettings((s) => s.shareMode);
  const live = isLive(share);
  const people = share.room?.members.filter((m) => m.online).length ?? 0;
  const hostName = shortName(share.room?.members.find((m) => m.host)?.name ?? '호스트');
  const addr = share.info ? `${share.info.addrs[0] ?? share.info.pcName}:${share.info.port}` : '';
  const target = share.target ? `${share.target.host}:${share.target.port}` : '';

  let dot = GRAY;
  let anim = 'none';
  let t: string;
  let sub: string;
  if (share.role === 'host' && live) {
    [dot, anim, t, sub] = [OK, 'lp-breathe 2s infinite', '같이 고르기 열림', `${people}명 · ${addr}`];
  } else if (share.status === 'starting') {
    [dot, t, sub] = [AMBER, '서버 시작 중…', `포트 ${port}`];
  } else if (share.role === 'client' && share.status === 'reconnecting') {
    [dot, anim, t, sub] = [AMBER, 'lp-blink 1s infinite', '다시 연결 중…', target];
  } else if (share.role === 'client' && live) {
    [dot, anim, t, sub] = [
      OK,
      'lp-breathe 2s infinite',
      `${hostName}님 방에 접속`,
      `${people}명이 함께 고르는 중`,
    ];
  } else if (share.status === 'connecting') {
    [dot, t, sub] = [AMBER, '접속 중…', target];
  } else {
    [t, sub] = ['같이 고르기 꺼짐', mode === 'join' ? '설정에서 호스트에 접속' : '설정에서 서버 켜기'];
  }
  const go = () => (live ? share.enterRoom() : onSettings());

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
        background: 'oklch(0.99 0.002 75)',
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      <div
        style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: dot, animation: anim }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 650,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {t}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: MUTED,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}
