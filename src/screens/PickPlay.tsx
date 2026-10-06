import { MODES, playHint } from '../pick/modes';
import { usePick } from '../store/pickStore';
import { AC, AINK, INK, MUTED, MUTED_2, PANEL_RING } from '../theme';
import Ai from './play/Ai';
import Cup from './play/Cup';
import Elim from './play/Elim';
import Ladder from './play/Ladder';
import Roulette from './play/Roulette';
import Slot from './play/Slot';

export default function PickPlay() {
  const plan = usePick((s) => s.plan);
  const stepIdx = usePick((s) => s.stepIdx);
  const curMode = usePick((s) => s.curMode);
  const g = usePick((s) => s.g);
  const inter = usePick((s) => s.inter);
  const interShow = usePick((s) => s.interShow);
  const quit = usePick((s) => s.quit);
  const keep = usePick((s) => s.keep)();

  return (
    <div
      className="keep-motion"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '0 28px 24px',
        gap: 14,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'white',
          borderRadius: 12,
          boxShadow: PANEL_RING,
          padding: '12px 16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {plan.map((st, i) => {
            const cur = i === stepIdx;
            const past = i < stepIdx;
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    height: 26,
                    padding: '0 10px',
                    borderRadius: 13,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 12.5,
                    fontWeight: 650,
                    background: cur ? AC : past ? 'oklch(0.94 0.005 75)' : 'white',
                    color: cur ? 'white' : past ? MUTED_2 : 'oklch(0.4 0.012 60)',
                    textDecoration: past ? 'line-through' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {i + 1}. {MODES[st.mode].name} → {st.keep}곳
                </span>
                {i < plan.length - 1 ? (
                  <span style={{ color: 'oklch(0.7 0.01 60)' }}>→</span>
                ) : null}
              </span>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 160, fontSize: 13, color: 'oklch(0.45 0.012 60)' }}>
          {playHint(curMode, keep)}
        </div>
        <button
          type="button"
          className="btn-soft"
          onClick={quit}
          style={{
            height: 30,
            padding: '0 12px',
            border: '1px solid oklch(0.88 0.006 75)',
            borderRadius: 7,
            background: 'white',
            font: 'inherit',
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          그만두기
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>
        {g?.kind === 'elim' ? (
          <Elim g={g} />
        ) : g?.kind === 'cup' ? (
          <Cup g={g} />
        ) : g?.kind === 'ladder' ? (
          <Ladder g={g} />
        ) : g?.kind === 'roulette' ? (
          <Roulette g={g} />
        ) : g?.kind === 'slot' ? (
          <Slot g={g} />
        ) : g?.kind === 'ai' ? (
          <Ai g={g} />
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: inter ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'oklch(0.975 0.004 75 / .82)',
          zIndex: 5,
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: '28px 36px',
            boxShadow: '0 20px 50px oklch(0.3 0.02 60 / .18)',
            textAlign: 'center',
            transform: interShow ? 'scale(1)' : 'scale(.9)',
            opacity: interShow ? 1 : 0,
            transition: 'transform .45s cubic-bezier(.2,.9,.3,1.3), opacity .3s',
          }}
        >
          <div style={{ fontSize: 13, color: AINK, fontWeight: 700 }}>{inter?.head ?? ''}</div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              marginTop: 6,
              letterSpacing: '-0.02em',
              color: INK,
            }}
          >
            {inter?.main ?? ''}
          </div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 8 }}>{inter?.next ?? ''}</div>
        </div>
      </div>
    </div>
  );
}
