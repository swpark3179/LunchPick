import { type LadderG, ladderGeo, trace } from '../../pick/engine';
import { short } from '../../lib/util';
import { usePick } from '../../store/pickStore';
import { speedMul, useAnimSpeed } from '../../store/settingsStore';
import { AC, HUES, INK, MUTED, MUTED_3 } from '../../theme';

const RUNG_COLOR = 'oklch(0.86 0.008 75)';

export default function Ladder({ g }: { g: LadderG }) {
  const cands = usePick((s) => s.cands);
  const keep = usePick((s) => s.keep)();
  const ladderRun = usePick((s) => s.ladderRun);
  const ladderAll = usePick((s) => s.ladderAll);
  const endStep = usePick((s) => s.endStep);
  const dur = 1500 * speedMul(useAnimSpeed());

  const n = cands.length;
  const geo = ladderGeo(n);
  const traces = cands.map((_, i) => trace(g, i, geo));
  const col = (i: number) => `oklch(0.6 0.16 ${HUES[i % 12]})`;
  const gapPct = n > 1 ? ((geo.W - 2 * geo.pad) / (n - 1) / geo.W) * 100 : 60;
  const allRevealed = cands.every((_, i) => g.revealed[i]);

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        paddingTop: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, color: 'oklch(0.45 0.012 60)' }}>
          이름을 눌러 한 줄씩, 또는 한 번에 출발하세요. 당첨 {keep}칸
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn-soft"
            onClick={ladderAll}
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
            }}
          >
            전체 출발
          </button>
          <button
            type="button"
            className="btn-accent"
            onClick={() => {
              if (allRevealed) endStep(cands.filter((_, i) => g.slots[traces[i].end]));
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
              opacity: allRevealed ? 1 : 0.35,
            }}
          >
            다음 →
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', height: 40 }}>
        {cands.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => ladderRun(i)}
            style={{
              position: 'absolute',
              left: `${(geo.x(i) / geo.W) * 100}%`,
              top: 0,
              transform: 'translateX(-50%)',
              maxWidth: `${Math.max(gapPct - 1.5, 12)}%`,
              height: 38,
              padding: '0 12px',
              borderRadius: 19,
              border: `2px solid ${col(i)}`,
              background: g.drawn[i] ? col(i) : 'white',
              color: g.drawn[i] ? 'white' : INK,
              font: 'inherit',
              fontSize: 13,
              fontWeight: 680,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'pointer',
              transition: 'background .3s, color .3s',
            }}
          >
            {short(c.title, 7)}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${geo.W} ${geo.H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        {/* 세로줄 */}
        {cands.map((_, c) => (
          <line
            key={`v${c}`}
            x1={geo.x(c)}
            y1={0}
            x2={geo.x(c)}
            y2={geo.H}
            stroke={RUNG_COLOR}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        {/* 가로줄 */}
        {g.rungs.flatMap((row, r) =>
          row.map((on, c) =>
            on ? (
              <line
                key={`h${r}-${c}`}
                x1={geo.x(c)}
                y1={geo.y(r)}
                x2={geo.x(c + 1)}
                y2={geo.y(r)}
                stroke={RUNG_COLOR}
                strokeWidth={4}
                strokeLinecap="round"
              />
            ) : null,
          ),
        )}
        {/* 내려가는 경로 — pathLength=1 에 dasharray '1 2' 를 걸어 dashoffset 으로 그린다 */}
        {traces.map((t, i) => (
          <polyline
            key={`p${i}`}
            points={t.pts.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke={col(i)}
            strokeWidth={6}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 2"
            strokeDashoffset={g.drawn[i] ? 0 : 1}
            style={{
              transition: `stroke-dashoffset ${dur}ms ease-in-out`,
              opacity: g.drawn[i] ? 1 : 0,
            }}
          />
        ))}
      </svg>

      <div style={{ position: 'relative', height: 44 }}>
        {cands.map((_, slot) => {
          const from = traces.findIndex((t) => t.end === slot);
          const revealed = from >= 0 && !!g.revealed[from];
          const win = g.slots[slot];
          return (
            <div
              key={`b${slot}`}
              style={{
                position: 'absolute',
                left: `${(geo.x(slot) / geo.W) * 100}%`,
                top: 0,
                transform: `translateX(-50%) scale(${revealed && win ? 1.08 : 1})`,
                minWidth: 56,
                height: 38,
                padding: '0 12px',
                borderRadius: 9,
                background: revealed
                  ? win
                    ? AC
                    : 'oklch(0.9 0.005 75)'
                  : 'oklch(0.95 0.004 75)',
                color: revealed ? (win ? 'white' : MUTED) : MUTED_3,
                fontSize: 13,
                fontWeight: 750,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                transition: 'transform .35s cubic-bezier(.2,.9,.3,1.4), background .3s',
              }}
            >
              {revealed ? (win ? `당첨 · ${short(cands[from].title, 5)}` : '꽝') : '?'}
            </div>
          );
        })}
      </div>
    </div>
  );
}
