/** 같이 고르기가 끝났을 때(호스트 종료·내보냄·연결 끊김) 한 번 알려준다. */
import { useShare } from '../../store/shareStore';
import { btnAccent } from './parts';

export default function EndedDialog() {
  const reason = useShare((s) => s.ended);
  const dismiss = useShare((s) => s.dismissEnded);
  if (!reason) return null;
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
        animation: 'lp-in .2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
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
          animation: 'lp-rise .45s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 780 }}>같이 고르기가 끝났어요</div>
        <div style={{ fontSize: 13.5, color: 'oklch(0.35 0.012 60)', lineHeight: 1.6 }}>{reason}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="tg-accent" onClick={dismiss} style={btnAccent(36, 16)}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
