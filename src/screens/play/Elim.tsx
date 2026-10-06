import type { ElimG } from '../../pick/engine';
import { usePick } from '../../store/pickStore';
import { AC, AINK, MUTED, SOFT, catDot } from '../../theme';

export default function Elim({ g }: { g: ElimG }) {
  const cands = usePick((s) => s.cands);
  const keep = usePick((s) => s.keep)();
  const elimToggle = usePick((s) => s.elimToggle);
  const elimRandom = usePick((s) => s.elimRandom);
  const endStep = usePick((s) => s.endStep);

  const alive = cands.filter((c) => !g.out[c.key]);
  const done = alive.length <= keep;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 34,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {alive.length}
          </span>
          <span style={{ fontSize: 13, color: MUTED }}>곳 남음</span>
        </div>
        <div style={{ fontSize: 13.5, color: AINK, fontWeight: 650 }}>
          {done ? '다 줄였어요!' : `${alive.length - keep}곳 더 지우면 끝`}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn-soft"
          onClick={elimRandom}
          style={{
            height: 36,
            padding: '0 14px',
            border: '1px solid oklch(0.88 0.006 75)',
            borderRadius: 8,
            background: 'white',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: g.busy || done ? 0.4 : 1,
          }}
        >
          무작위로 하나 지우기
        </button>
        <button
          type="button"
          className="btn-accent"
          onClick={() => {
            if (done && !g.busy) endStep(alive);
          }}
          style={{
            height: 36,
            padding: '0 16px',
            border: 'none',
            borderRadius: 8,
            background: AC,
            color: 'white',
            font: 'inherit',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
            opacity: done ? 1 : 0.35,
          }}
        >
          다음 →
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
          gap: 10,
        }}
      >
        {cands.map((c) => {
          const out = !!g.out[c.key];
          const fl = g.flash === c.key;
          return (
            <div
              key={c.key}
              role="button"
              tabIndex={0}
              onClick={() => elimToggle(c.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') elimToggle(c.key);
              }}
              style={{
                position: 'relative',
                background: fl ? SOFT : out ? 'oklch(0.97 0.003 75)' : 'white',
                borderRadius: 10,
                padding: '13px 14px 12px',
                cursor: 'pointer',
                boxShadow: fl
                  ? `0 0 0 3px ${AC}, 0 10px 26px oklch(0.56 0.16 40 / .25)`
                  : '0 0 0 1px oklch(0.91 0.006 75)',
                opacity: out ? 0.38 : 1,
                transform: fl ? 'scale(1.05)' : out ? 'scale(0.95)' : 'scale(1)',
                filter: out ? 'grayscale(1)' : 'none',
                transition:
                  'opacity .3s, transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .15s, filter .3s',
                minHeight: 80,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: catDot(c.cat),
                    flex: 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 680,
                    textDecoration: out ? 'line-through' : 'none',
                  }}
                >
                  {c.title}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.4 }}>{c.sub}</div>
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  fontSize: 11,
                  fontWeight: 750,
                  color: 'oklch(0.5 0.18 25)',
                }}
              >
                {out ? '탈락' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
