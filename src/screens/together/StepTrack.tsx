/**
 * 방 머리의 진행 표시 — 단계 이름과 옆의 숫자. 지금 단계는 은은하게 빛나고 지나간 단계는 체크가 된다.
 * compact 면 지나간 단계를 체크 동그라미로 줄인다 (이름은 툴팁). 점심 방과 도란식사 방이 같이 쓴다.
 */
import { AC, AINK, MUTED } from '../../theme';
import { IconCheck } from './parts';

export default function StepTrack({
  steps,
  at,
  shown,
  compact,
}: {
  /** [이름, 옆에 붙는 숫자·글] */
  steps: [string, string][];
  /** 지금 단계 번호 */
  at: number;
  /** 보여 줄 단계 번호들 (머리 폭에 맞게 일부만) */
  shown: number[];
  compact: boolean;
}) {
  const last = steps.length - 1;
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 0,
        flexWrap: 'wrap',
      }}
    >
      {shown.map((i, k) => {
        const [label, count] = steps[i];
        const done = i < at;
        const cur = i === at;
        const mini = compact && done;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              title={mini ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 30,
                padding: mini ? '0 5px' : '0 12px 0 5px',
                borderRadius: 15,
                background: cur ? AC : done ? 'oklch(0.965 0.025 50)' : 'oklch(0.955 0.005 75)',
                color: cur ? 'white' : done ? AINK : MUTED,
                fontSize: 12.5,
                fontWeight: 650,
                whiteSpace: 'nowrap',
                transition: 'background .4s, color .4s',
                animation: cur && i < last ? 'lp-glow 2.2s infinite' : 'none',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: cur ? 'oklch(1 0 0 / .22)' : done ? 'oklch(0.9 0.05 50)' : 'white',
                  color: cur ? 'white' : done ? AINK : MUTED,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background .4s',
                }}
              >
                {done ? <IconCheck size={11} stroke={3} /> : i + 1}
              </span>
              {mini ? null : label}
              {count && !mini ? (
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>{count}</span>
              ) : null}
            </div>
            {k < shown.length - 1 ? (
              <div
                style={{
                  width: 16,
                  height: 2,
                  borderRadius: 2,
                  background: done ? 'oklch(0.8 0.08 50)' : 'oklch(0.9 0.006 75)',
                  transition: 'background .4s',
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
