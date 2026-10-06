import { AC, HAIRLINE, INK, MUTED, MUTED_3, PANEL } from '../theme';
import { todayText } from '../lib/util';
import type { View } from '../lib/types';
import { useData } from '../store/dataStore';
import { useList } from '../store/listStore';
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

      {/* 공유 서버는 이번 버전에서 비활성 — 디자인은 유지하고 상태만 '준비 중' 으로 고정한다. */}
      <div
        role="button"
        tabIndex={0}
        className="srv-card"
        onClick={() => setView('settings')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setView('settings');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 10px',
          borderRadius: 7,
          cursor: 'pointer',
          background: 'oklch(0.99 0.002 75)',
          border: `1px solid ${HAIRLINE}`,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flex: 'none',
            background: 'oklch(0.75 0.01 60)',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 650 }}>같이 고르기 준비 중</div>
          <div style={{ fontSize: 11.5, color: MUTED }}>다음 버전에서 제공해요</div>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: MUTED_3, padding: '8px 10px 0', lineHeight: 1.5 }}>
        변경 사항은 이 PC에 자동 저장됩니다.
      </div>
    </div>
  );
}
