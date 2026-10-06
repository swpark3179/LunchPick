import type { SlotG } from '../../pick/engine';
import { short } from '../../lib/util';
import { usePick } from '../../store/pickStore';
import { AC, INK, LINE, catDot } from '../../theme';

const ROW_H = 56;

export default function Slot({ g }: { g: SlotG }) {
  const pull = usePick((s) => s.pull);
  const endStep = usePick((s) => s.endStep);
  const reelWidth = g.reels.length === 1 ? 280 : 190;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22,
        paddingTop: 10,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 'fit-content',
          background: INK,
          borderRadius: 18,
          padding: 18,
          display: 'flex',
          gap: 10,
          boxShadow:
            '0 20px 44px oklch(0.25 0.02 60 / .3), inset 0 0 0 1px oklch(0.35 0.012 60)',
        }}
      >
        {g.reels.map((r, ri) => (
          <div
            key={ri}
            style={{
              position: 'relative',
              flex: `1 1 ${reelWidth}px`,
              minWidth: 0,
              maxWidth: reelWidth,
              width: reelWidth,
              height: ROW_H * 3,
              borderRadius: 10,
              background: 'white',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                transform: `translateY(${-(r.pos - 1) * ROW_H}px)`,
                transition: r.anim ? `transform ${r.dur}ms cubic-bezier(.2,.7,.15,1)` : 'none',
              }}
            >
              {r.strip.map((c, si) => (
                <div
                  key={`${si}-${c?.key ?? 'x'}`}
                  style={{
                    height: ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    padding: '0 10px',
                    fontSize: 17,
                    fontWeight: 750,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: catDot(c?.cat ?? '기타'),
                      flex: 'none',
                    }}
                  />
                  {short(c?.title ?? '', 9)}
                </div>
              ))}
            </div>
            {/* 위아래 페이드 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(white, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 66%, white)',
                pointerEvents: 'none',
              }}
            />
            {/* 당첨 칸 테두리 */}
            <div
              style={{
                position: 'absolute',
                left: 4,
                right: 4,
                top: ROW_H,
                height: ROW_H,
                borderRadius: 8,
                boxShadow: `inset 0 0 0 2px ${g.pulled ? AC : 'oklch(0.88 0.006 75)'}`,
                pointerEvents: 'none',
                transition: 'box-shadow .3s',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={pull}
          style={{
            height: 46,
            padding: '0 26px',
            border: 'none',
            borderRadius: 10,
            background: g.pulled ? 'white' : INK,
            color: g.pulled ? INK : 'white',
            boxShadow: g.pulled ? `inset 0 0 0 1px ${LINE}` : 'none',
            font: 'inherit',
            fontSize: 15,
            fontWeight: 750,
            cursor: 'pointer',
            opacity: g.pulling ? 0.6 : 1,
          }}
        >
          {g.pulling ? '돌아가는 중…' : g.pulled ? '다시 돌리기' : '레버 당기기'}
        </button>
        <button
          type="button"
          className="btn-accent"
          onClick={() => endStep(g.winners)}
          style={{
            height: 46,
            padding: '0 22px',
            border: 'none',
            borderRadius: 10,
            background: AC,
            color: 'white',
            font: 'inherit',
            fontSize: 15,
            fontWeight: 750,
            cursor: 'pointer',
            display: g.pulled && !g.pulling ? 'block' : 'none',
          }}
        >
          이대로 확정 →
        </button>
      </div>
    </div>
  );
}
