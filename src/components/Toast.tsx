import { INK } from '../theme';
import { useUi } from '../store/uiStore';

export default function Toast() {
  const toast = useUi((s) => s.toast);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 24,
        transform: `translateX(-50%) translateY(${toast ? '0px' : '10px'})`,
        opacity: toast ? 1 : 0,
        transition: 'opacity .25s, transform .3s cubic-bezier(.2,.8,.2,1)',
        background: INK,
        color: 'white',
        fontSize: 13,
        fontWeight: 550,
        padding: '10px 16px',
        borderRadius: 9,
        boxShadow: '0 10px 26px rgba(0,0,0,.2)',
        pointerEvents: 'none',
        zIndex: 30,
        whiteSpace: 'pre-line',
        maxWidth: 520,
        textAlign: 'center',
      }}
    >
      {toast ?? ''}
    </div>
  );
}
