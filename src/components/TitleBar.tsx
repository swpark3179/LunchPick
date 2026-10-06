import { AC, HAIRLINE, PANEL } from '../theme';
import { windowClose, windowMinimize, windowToggleMaximize } from '../lib/ipc';

const BTN: React.CSSProperties = {
  width: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'default',
};

export default function TitleBar() {
  return (
    <div
      style={{
        height: 38,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: PANEL,
        borderBottom: `1px solid ${HAIRLINE}`,
        userSelect: 'none',
      }}
    >
      {/* 빈 공간까지 창 끌기 영역으로 쓴다 */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 14,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: AC,
            color: 'white',
            fontSize: 11,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          점
        </div>
        <span style={{ fontSize: 12.5, color: 'oklch(0.42 0.012 60)' }}>
          점심픽 — 점심 예약 도우미
        </span>
      </div>
      <div style={{ display: 'flex', height: '100%', flex: 'none' }}>
        <div className="tb-btn" style={BTN} title="최소화" onClick={() => void windowMinimize()}>
          <div style={{ width: 10, height: 1, background: 'oklch(0.3 0.01 60)' }} />
        </div>
        <div
          className="tb-btn"
          style={BTN}
          title="최대화"
          onClick={() => void windowToggleMaximize()}
        >
          <div style={{ width: 9, height: 9, border: '1px solid oklch(0.3 0.01 60)' }} />
        </div>
        <div
          className="tb-close"
          style={{ ...BTN, fontSize: 13, color: 'oklch(0.3 0.01 60)' }}
          title="닫기"
          onClick={() => void windowClose()}
        >
          ✕
        </div>
      </div>
    </div>
  );
}
