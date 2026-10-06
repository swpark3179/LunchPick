import Chip from '../../components/Chip';
import type { AiG } from '../../pick/engine';
import { MOODS } from '../../pick/modes';
import { usePick } from '../../store/pickStore';
import { AC, AINK, INK, LINE, MUTED, PANEL_RING, SOFT, catDot } from '../../theme';

const INPUT_BORDER = 'oklch(0.88 0.006 75)';
const SCAN_BG = 'oklch(0.96 0.03 250)';
const SCAN_RING = '0 0 0 2px oklch(0.6 0.15 250)';

export default function Ai({ g }: { g: AiG }) {
  const cands = usePick((s) => s.cands);
  const keep = usePick((s) => s.keep)();
  const setAiMood = usePick((s) => s.setAiMood);
  const setAiText = usePick((s) => s.setAiText);
  const askAI = usePick((s) => s.askAI);
  const endStep = usePick((s) => s.endStep);

  const picks = g.picks;
  const isPicked = (key: string) => !!picks && picks[key] !== undefined;
  const sorted = picks
    ? [...cands].sort((a, b) => (isPicked(b.key) ? 1 : 0) - (isPicked(a.key) ? 1 : 0))
    : cands;

  const note =
    g.error ||
    (picks
      ? '추천 이유를 확인하고 다음으로 넘어가세요.'
      : '조건을 고르지 않으면 다양하게 섞어서 추천해요.');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          boxShadow: PANEL_RING,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MOODS.map((m) => {
            const on = !!g.mood[m];
            return (
              <Chip
                key={m}
                label={m}
                onClick={() => setAiMood(m)}
                bg={on ? SOFT : 'white'}
                color={on ? AINK : 'oklch(0.35 0.012 60)'}
                border={on ? AC : LINE}
                weight={on ? 650 : 500}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="inp"
            value={g.text}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void askAI();
            }}
            placeholder="더 하고 싶은 말 (예: 오후에 회의 있어서 가볍게, 6명이에요)"
            style={{
              flex: 1,
              minWidth: 0,
              height: 38,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 8,
              padding: '0 12px',
              font: 'inherit',
              fontSize: 13.5,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void askAI()}
            style={{
              height: 38,
              padding: '0 16px',
              border: 'none',
              borderRadius: 8,
              background: INK,
              color: 'white',
              font: 'inherit',
              fontSize: 13.5,
              fontWeight: 650,
              cursor: 'pointer',
              opacity: g.loading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {g.loading ? 'AI가 고르는 중…' : picks ? '다시 물어보기' : `AI에게 ${keep}곳 추천받기`}
          </button>
          <button
            type="button"
            className="btn-accent"
            onClick={() => {
              if (!picks) return;
              endStep(
                cands
                  .filter((c) => picks[c.key] !== undefined)
                  .map((c) => ({ ...c, reason: picks[c.key] })),
              );
            }}
            style={{
              height: 38,
              padding: '0 16px',
              border: 'none',
              borderRadius: 8,
              background: AC,
              color: 'white',
              font: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: picks && !g.loading ? 'block' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            다음 →
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'oklch(0.52 0.012 60)' }}>{note}</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
          gap: 10,
        }}
      >
        {sorted.map((c) => {
          const pk = isPicked(c.key);
          const sc = g.scan === c.key;
          return (
            <div
              key={c.key}
              style={{
                background: sc ? SCAN_BG : pk ? SOFT : 'white',
                borderRadius: 10,
                padding: '13px 14px',
                boxShadow: sc ? SCAN_RING : pk ? `0 0 0 2px ${AC}` : '0 0 0 1px oklch(0.91 0.006 75)',
                opacity: picks ? (pk ? 1 : 0.35) : 1,
                transform: sc ? 'scale(1.04)' : pk ? 'translateY(-2px)' : 'none',
                transition: 'opacity .4s, transform .3s, box-shadow .2s, background .2s',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                minHeight: 76,
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
                <span style={{ fontSize: 15, fontWeight: 680 }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 12.5, color: MUTED }}>{c.sub}</div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'oklch(0.42 0.13 40)',
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                {pk ? picks![c.key] : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
