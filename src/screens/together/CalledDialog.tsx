/** 누군가 나를 불렀을 때 — 창이 맨 앞으로 뜬 까닭을 알려 준다. 어느 화면에서든 뜬다. */
import { useEffect } from 'react';

import { useShare } from '../../store/shareStore';
import { useUi } from '../../store/uiStore';
import { AC } from '../../theme';
import { btnAccent, btnSoft, IconRing } from './parts';

export default function CalledDialog() {
  const called = useShare((s) => s.called);
  const dismiss = useShare((s) => s.dismissCalled);
  const enterRoom = useShare((s) => s.enterRoom);
  const inRoom = useUi((s) => s.view === 'together');
  // 방의 Esc 처리보다 먼저 받아서 이 창만 닫는다.
  useEffect(() => {
    if (!called) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      dismiss();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [called, dismiss]);
  if (!called) return null;
  const go = () => {
    dismiss();
    enterRoom();
  };
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 70,
        background: 'oklch(0.25 0.012 60 / .32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'lp-in .2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        role="alertdialog"
        aria-label="부르기"
        style={{
          width: 380,
          maxWidth: 'calc(100% - 40px)',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          textAlign: 'center',
          animation: 'lp-rise .45s cubic-bezier(.2,.9,.3,1.25)',
        }}
      >
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: 'oklch(0.965 0.025 50)',
            color: AC,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'lp-pop .5s cubic-bezier(.2,.9,.3,1.4)',
          }}
        >
          <IconRing size={24} />
        </span>
        <div style={{ fontSize: 17, fontWeight: 780 }}>{called.name}님이 불렀어요</div>
        <div style={{ fontSize: 13.5, color: 'oklch(0.35 0.012 60)', lineHeight: 1.6 }}>
          같이 고르기 화면을 확인해 주세요.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {inRoom ? (
            <button type="button" className="tg-accent" onClick={dismiss} autoFocus style={btnAccent(36, 18)}>
              확인
            </button>
          ) : (
            <>
              <button type="button" className="tg-soft" onClick={dismiss} style={btnSoft(36)}>
                닫기
              </button>
              <button type="button" className="tg-accent" onClick={go} autoFocus style={btnAccent(36, 16)}>
                같이 고르기로 가기 →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
