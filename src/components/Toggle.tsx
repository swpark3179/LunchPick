import { AC } from '../theme';

/** 설정 화면의 스위치. 클릭은 감싸는 행이 받는다. */
export default function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 34,
        height: 20,
        borderRadius: 10,
        background: on ? AC : 'oklch(0.85 0.008 75)',
        position: 'relative',
        transition: 'background .2s',
        flex: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          transform: on ? 'translateX(14px)' : 'none',
          transition: 'transform .2s',
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        }}
      />
    </div>
  );
}
