import { INK, MUTED } from '../theme';
import { usePick } from '../store/pickStore';
import PickPlay from './PickPlay';
import PickResult from './PickResult';
import PickSetup from './PickSetup';

const STEP_LABELS = ['후보 고르기', '줄이기', '결과'];
const STAGE_INDEX = { setup: 0, play: 1, result: 2 } as const;

export default function PickScreen() {
  const stage = usePick((s) => s.stage);
  const at = STAGE_INDEX[stage];

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            padding: '22px 28px 14px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            flex: 'none',
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em' }}>
              오늘 뭐 먹지?
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
              후보를 고르고, 원하는 방식으로 줄여보세요.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {STEP_LABELS.map((label, i) => {
              const cur = i === at;
              const past = i < at;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 30,
                      padding: '0 12px 0 6px',
                      borderRadius: 15,
                      background: cur ? INK : 'transparent',
                      color: cur ? 'white' : past ? 'oklch(0.4 0.012 60)' : 'oklch(0.6 0.01 60)',
                      fontSize: 12.5,
                      fontWeight: 650,
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        background: cur
                          ? 'white'
                          : past
                            ? 'oklch(0.85 0.01 60)'
                            : 'oklch(0.92 0.005 75)',
                        color: cur ? INK : 'oklch(0.4 0.012 60)',
                      }}
                    >
                      {i + 1}
                    </span>
                    {label}
                  </div>
                  {i < 2 ? (
                    <span style={{ color: 'oklch(0.75 0.01 60)', fontSize: 12 }}>›</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {stage === 'setup' ? <PickSetup /> : stage === 'play' ? <PickPlay /> : <PickResult />}
      </div>
    </div>
  );
}
