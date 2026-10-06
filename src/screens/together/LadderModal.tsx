/**
 * 사다리 (시안: 사다리) — 모두에게 같은 사다리가 보이고, 누구든 이름을 눌러 한 줄씩
 * 또는 '전체 출발'로 한 번에 내려보낼 수 있다. 모든 줄이 도착하면 '결과 적용'.
 */
import { LADDER_PATH_MS } from '../../share/anim';
import { LH, LW, lx, ly, traceLadder } from '../../share/ladder';
import type { RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AC, HUES, INK, MUTED, MUTED_3 } from '../../theme';
import { IconX, INPUT_BORDER } from './parts';

const RUNG = 'oklch(0.86 0.008 75)';

export default function LadderModal({ room }: { room: RoomState; me: string }) {
  const act = useShare((s) => s.act);
  const L = room.ladder!;
  const n = L.cands.length;
  const col = (i: number) => `oklch(0.6 0.16 ${HUES[i % 12]})`;
  const gapPct = n > 1 ? (540 / (n - 1) / LW) * 100 : 60;
  const traces = L.cands.map((_, i) => traceLadder(L.rungs, n, i));
  const allRev = L.revealed.every(Boolean);
  const name = (id: string) => room.restaurants.find((r) => r.id === id)?.name ?? '';
  const winners = L.cands.filter((_, i) => L.slots[traces[i].end]);
  const dur = LADDER_PATH_MS * L.speed;

  return (
    <div
      className="keep-motion"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'oklch(0.25 0.012 60 / .38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'lp-in .25s ease-out',
      }}
    >
      <div
        style={{
          width: 900,
          maxWidth: 'min(100%, max(560px, calc((100vh - 290px) * 2.13 + 52px)))',
          maxHeight: '100%',
          overflow: 'auto',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          padding: '22px 26px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'lp-rise .45s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 18, fontWeight: 780 }}>사다리 타기</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
              후보 {n}곳 중 {L.keep}곳만 남겨요. 이름을 눌러 한 줄씩, 또는 한 번에 출발하세요.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 14,
              background: 'oklch(0.955 0.005 75)',
              fontSize: 12,
              fontWeight: 650,
              color: 'oklch(0.42 0.012 60)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'oklch(0.62 0.15 150)',
                animation: 'lp-breathe 2s infinite',
              }}
            />
            모두에게 같이 보이는 중
          </div>
          <button
            type="button"
            className="tg-soft"
            onClick={() => act({ type: 'ladderAll' })}
            style={{
              height: 36,
              padding: '0 14px',
              border: `1px solid ${INPUT_BORDER}`,
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
            className={allRev ? 'tg-accent' : ''}
            onClick={() => allRev && act({ type: 'ladderApply' })}
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
              cursor: allRev ? 'pointer' : 'default',
              opacity: allRev ? 1 : 0.35,
              transition: 'opacity .3s',
            }}
          >
            결과 적용 →
          </button>
          <button
            type="button"
            title="닫기 (모두의 화면에서 닫혀요)"
            className="tg-act"
            onClick={() => act({ type: 'ladderClose' })}
            style={{
              width: 36,
              height: 36,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              cursor: 'pointer',
              color: 'oklch(0.42 0.012 60)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconX size={15} stroke={2.2} />
          </button>
        </div>

        <div style={{ position: 'relative', height: 40 }}>
          {L.cands.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => act({ type: 'ladderRun', i })}
              style={{
                position: 'absolute',
                left: `${(lx(n, i) / LW) * 100}%`,
                top: 0,
                transform: 'translateX(-50%)',
                maxWidth: `${Math.max(gapPct - 1.5, 12)}%`,
                height: 38,
                padding: '0 12px',
                borderRadius: 19,
                border: `2px solid ${col(i)}`,
                background: L.drawn[i] ? col(i) : 'white',
                color: L.drawn[i] ? 'white' : INK,
                font: 'inherit',
                fontSize: 13,
                fontWeight: 680,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                cursor: L.drawn[i] ? 'default' : 'pointer',
                transition: 'background .3s, color .3s',
              }}
            >
              {name(id)}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${LW} ${LH}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          {L.cands.map((_, c) => (
            <line
              key={`v${c}`}
              x1={lx(n, c)}
              y1={0}
              x2={lx(n, c)}
              y2={LH}
              stroke={RUNG}
              strokeWidth={4}
              strokeLinecap="round"
            />
          ))}
          {L.rungs.flatMap((row, r) =>
            row.map((on, c) =>
              on ? (
                <line
                  key={`h${r}-${c}`}
                  x1={lx(n, c)}
                  y1={ly(r)}
                  x2={lx(n, c + 1)}
                  y2={ly(r)}
                  stroke={RUNG}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              ) : null,
            ),
          )}
          {traces.map((t, i) => (
            <polyline
              key={`p${i}`}
              points={t.pts}
              fill="none"
              stroke={col(i)}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 2"
              strokeDashoffset={L.drawn[i] ? 0 : 1}
              style={{ transition: `stroke-dashoffset ${dur}ms ease-in-out`, opacity: L.drawn[i] ? 1 : 0 }}
            />
          ))}
        </svg>

        <div style={{ position: 'relative', height: 44 }}>
          {L.cands.map((_, slot) => {
            const from = traces.findIndex((t) => t.end === slot);
            const rev = from >= 0 && L.revealed[from];
            const win = L.slots[slot];
            return (
              <div
                key={`b${slot}`}
                style={{
                  position: 'absolute',
                  left: `${(lx(n, slot) / LW) * 100}%`,
                  top: 0,
                  transform: `translateX(-50%) scale(${rev && win ? 1.08 : 1})`,
                  minWidth: 56,
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 9,
                  background: rev ? (win ? AC : 'oklch(0.9 0.005 75)') : 'oklch(0.95 0.004 75)',
                  color: rev ? (win ? 'white' : MUTED) : MUTED_3,
                  fontSize: 13,
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  transition: 'transform .4s cubic-bezier(.2,.9,.3,1.4), background .3s, color .3s',
                }}
              >
                {rev ? (win ? `당첨 · ${name(L.cands[from]).slice(0, 5)}` : '꽝') : '?'}
              </div>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'oklch(0.42 0.012 60)',
            textAlign: 'center',
            minHeight: 20,
            marginTop: 4,
          }}
        >
          {allRev ? `${winners.map(name).join(', ')} — ‘결과 적용’을 누르면 후보가 이렇게 추려져요` : ''}
        </div>
      </div>
    </div>
  );
}
