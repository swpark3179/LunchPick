import type { RouletteG } from '../../pick/engine';
import { short } from '../../lib/util';
import { usePick } from '../../store/pickStore';
import { speedMul, useAnimSpeed } from '../../store/settingsStore';
import { AC, AINK, HUES, INK, LINE, MUTED, MUTED_3 } from '../../theme';

export default function Roulette({ g }: { g: RouletteG }) {
  const keep = usePick((s) => s.keep)();
  const spin = usePick((s) => s.spin);
  const endStep = usePick((s) => s.endStep);
  const speed = speedMul(useAnimSpeed());

  const w = g.wheel;
  const seg = w.length ? 360 / w.length : 360;
  const done = g.winners.length >= keep;

  const wheelBg = w.length
    ? `conic-gradient(${w
        .map(
          (_, i) =>
            `oklch(0.9 0.06 ${HUES[(i * 5) % 12]}) ${i * seg}deg ${(i + 1) * seg}deg`,
        )
        .join(',')})`
    : 'oklch(0.93 0.005 75)';

  return (
    <div
      style={{
        display: 'flex',
        gap: 44,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '8px 0',
      }}
    >
      <div style={{ position: 'relative', width: 400, height: 400, flex: 'none' }}>
        {/* 상단 포인터 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -2,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: `26px solid ${INK}`,
            zIndex: 3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 12,
            borderRadius: '50%',
            background: wheelBg,
            transform: `rotate(${g.rot}deg)`,
            transition: g.noAnim
              ? 'none'
              : `transform ${4200 * speed}ms cubic-bezier(.12,.72,.1,1)`,
            boxShadow:
              '0 0 0 6px white, 0 0 0 7px oklch(0.88 0.006 75), 0 18px 40px oklch(0.35 0.03 60 / .18)',
            overflow: 'hidden',
          }}
        >
          {w.map((c, i) => (
            <div
              key={c.key}
              style={{ position: 'absolute', inset: 0, transform: `rotate(${(i + 0.5) * seg}deg)` }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 16,
                  transform: 'translateX(-50%)',
                  writingMode: 'vertical-rl',
                  fontSize: w.length > 9 ? 13 : 15,
                  fontWeight: 720,
                  color: 'oklch(0.28 0.03 60)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                }}
              >
                {short(c.title, 7)}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={spin}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 86,
            height: 86,
            borderRadius: '50%',
            border: 'none',
            background: INK,
            color: 'white',
            font: 'inherit',
            fontSize: 14,
            fontWeight: 750,
            cursor: 'pointer',
            boxShadow: '0 0 0 5px white, 0 6px 16px rgba(0,0,0,.25)',
            zIndex: 2,
            opacity: g.spinning || done ? 0.7 : 1,
          }}
        >
          {g.spinning ? '…' : done ? '완료' : g.winners.length ? '한 번 더' : '돌리기'}
        </button>
      </div>

      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            height: 64,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            opacity: g.last ? 1 : 0,
            transform: g.last ? 'scale(1)' : 'scale(.8)',
            transition: 'opacity .3s, transform .45s cubic-bezier(.2,.9,.3,1.4)',
          }}
        >
          <div style={{ fontSize: 12, color: AINK, fontWeight: 700 }}>당첨!</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {g.last?.title ?? ''}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 650 }}>뽑힌 곳</div>
        {Array.from({ length: keep }, (_, i) => {
          const x = g.winners[i];
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 44,
                padding: '0 12px',
                borderRadius: 9,
                background: x ? 'white' : 'transparent',
                boxShadow: `inset 0 0 0 1px ${x ? AC : LINE}`,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: x ? AC : 'oklch(0.93 0.005 75)',
                  color: x ? 'white' : MUTED,
                  fontSize: 11,
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 14, fontWeight: 650, color: x ? INK : MUTED_3 }}>
                {x ? x.title : '—'}
              </span>
            </div>
          );
        })}

        <button
          type="button"
          className="btn-accent"
          onClick={() => {
            if (done && !g.spinning) endStep(g.winners);
          }}
          style={{
            marginTop: 6,
            height: 40,
            border: 'none',
            borderRadius: 8,
            background: AC,
            color: 'white',
            font: 'inherit',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            opacity: done && !g.spinning ? 1 : 0.35,
          }}
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
