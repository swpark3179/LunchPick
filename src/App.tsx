import { useEffect, useRef } from 'react';

import ErrorBoundary, { ScreenCrash } from './components/ErrorBoundary';
import RestaurantModal from './components/RestaurantModal';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import Toast from './components/Toast';
import { windowShow } from './lib/ipc';
import ListScreen from './screens/ListScreen';
import PickScreen from './screens/PickScreen';
import SettingsScreen from './screens/SettingsScreen';
import { useData } from './store/dataStore';
import { useList } from './store/listStore';
import { clearTimers, usePick } from './store/pickStore';
import { useSettings } from './store/settingsStore';
import { toastError, useUi } from './store/uiStore';
import { APP_BG, MUTED } from './theme';

export default function App() {
  const view = useUi((s) => s.view);
  const ready = useData((s) => s.ready);
  const modalOpen = useList((s) => s.modal !== null);
  const booted = useRef(false);

  useEffect(() => {
    // StrictMode 의 이펙트 2회 실행을 막는다 — 초기 로드는 한 번만.
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      try {
        await Promise.all([useData.getState().init(), useSettings.getState().init()]);
      } finally {
        // 로드에 실패해도 창은 띄워야 한다 (visible:false 로 시작하므로).
        await windowShow();
      }
    })();
  }, []);

  // 언마운트 시 고르기 타이머를 정리한다.
  useEffect(() => () => clearTimers(), []);

  // Escape: 모달이 열려 있으면 모달, 아니면 상세 드로어를 닫는다 (목업과 동일한 순서).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useList.getState();
      if (s.modal) s.closeModal();
      else if (s.selId) s.closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: APP_BG,
        overflow: 'hidden',
        position: 'relative',
        fontSize: 14,
        color: 'oklch(0.24 0.012 60)',
      }}
    >
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar />
        <ErrorBoundary
          resetKey={view}
          fallback={(error, reset) => {
            // 고르기 도중이었다면 같은 상태로 다시 깨지지 않게 후보 고르기 단계로 되돌린다.
            const unstick = () => {
              if (view === 'pick') usePick.getState().quit();
            };
            return (
              <ScreenCrash
                error={error}
                onRetry={() => {
                  unstick();
                  reset();
                }}
                onHome={
                  view === 'list'
                    ? undefined
                    : () => {
                        unstick();
                        useUi.getState().setView('list');
                      }
                }
              />
            );
          }}
        >
          {!ready ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: MUTED,
                fontSize: 13.5,
              }}
            >
              불러오는 중…
            </div>
          ) : view === 'list' ? (
            <ListScreen />
          ) : view === 'pick' ? (
            <PickScreen />
          ) : (
            <SettingsScreen />
          )}
        </ErrorBoundary>
      </div>
      {/* 모달이 깨지면 닫고 알린다 — 목록 화면은 그대로 쓸 수 있다. */}
      <ErrorBoundary
        resetKey={modalOpen}
        fallback={() => null}
        onError={(e) => {
          useList.getState().closeModal();
          toastError(e, '식당 편집 창 오류');
        }}
      >
        <RestaurantModal />
      </ErrorBoundary>
      <Toast />
    </div>
  );
}
