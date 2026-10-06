import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';

import { windowClose, windowShow } from '../lib/ipc';
import { AC, APP_BG, HAIRLINE, INK, MUTED, PANEL } from '../theme';

type Props = {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** 이 값이 바뀌면 오류 상태를 풀고 다시 그린다 (예: 현재 화면). */
  resetKey?: unknown;
  onError?: (error: Error) => void;
};

type State = { error: Error | null };

/** 렌더링 중 예외를 잡아 흰 화면 대신 fallback 을 보여준다. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error instanceof Error ? error : new Error(String(error)));
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    return error ? this.props.fallback(error, this.reset) : this.props.children;
  }
}

const BTN: React.CSSProperties = {
  height: 38,
  padding: '0 16px',
  borderRadius: 8,
  font: 'inherit',
  fontSize: 13.5,
  cursor: 'pointer',
};
const BTN_ACCENT: React.CSSProperties = {
  ...BTN,
  border: 'none',
  background: AC,
  color: 'white',
  fontWeight: 700,
};
const BTN_SOFT: React.CSSProperties = {
  ...BTN,
  border: '1px solid oklch(0.88 0.006 75)',
  background: 'white',
};

function CrashBody({
  title,
  error,
  children,
}: {
  title: string;
  error: Error;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
    >
      <div style={{ width: 'min(460px, 100%)', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 750, letterSpacing: '-0.02em', color: INK }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
          저장된 식당과 설정은 그대로예요.
        </div>
        <div
          style={{
            marginTop: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: PANEL,
            border: `1px solid ${HAIRLINE}`,
            fontFamily: 'Consolas, monospace',
            fontSize: 12,
            color: 'oklch(0.42 0.012 60)',
            textAlign: 'left',
            wordBreak: 'break-all',
            maxHeight: 120,
            overflow: 'auto',
            userSelect: 'text',
          }}
        >
          {error.message || error.name}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** 한 화면(목록·고르기·설정)이 깨졌을 때 — 타이틀바와 사이드바는 살아 있다. */
export function ScreenCrash({
  error,
  onRetry,
  onHome,
}: {
  error: Error;
  onRetry: () => void;
  onHome?: () => void;
}) {
  return (
    <CrashBody title="이 화면을 그리다 문제가 생겼어요" error={error}>
      <button className="btn-accent" style={BTN_ACCENT} onClick={onRetry}>
        다시 시도
      </button>
      {onHome ? (
        <button className="btn-soft" style={BTN_SOFT} onClick={onHome}>
          식당 목록으로
        </button>
      ) : null}
    </CrashBody>
  );
}

/**
 * 앱 전체가 깨졌을 때의 마지막 화면. 원인이 스토어나 타이틀바일 수도 있으니
 * 다른 컴포넌트·스토어에 기대지 않는다 (창 테두리가 없어 닫기 버튼은 직접 그린다).
 */
export function AppCrash({ error }: { error: Error }) {
  // 첫 렌더에서 깨지면 App 이 창을 띄우지 못한다 (visible:false 로 시작).
  useEffect(() => {
    void windowShow();
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: APP_BG }}>
      <div
        style={{
          height: 38,
          flex: 'none',
          display: 'flex',
          background: PANEL,
          borderBottom: `1px solid ${HAIRLINE}`,
          userSelect: 'none',
        }}
      >
        <div
          data-tauri-drag-region
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 14,
            fontSize: 12.5,
            color: 'oklch(0.42 0.012 60)',
          }}
        >
          점심픽
        </div>
        <div
          className="tb-close"
          title="닫기"
          onClick={() => void windowClose()}
          style={{
            width: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'oklch(0.3 0.01 60)',
          }}
        >
          ✕
        </div>
      </div>
      <CrashBody title="점심픽에 문제가 생겼어요" error={error}>
        <button className="btn-accent" style={BTN_ACCENT} onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
      </CrashBody>
    </div>
  );
}
