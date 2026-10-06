import { INK, SEG_TRACK } from '../theme';

/** 디자인의 segItem() 과 동일한 선택 세그먼트 컨트롤. */
export type SegOption<T> = { value: T; label: string };

type Props<T> = {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** 디자인에 쓰인 네 가지 크기 */
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: { h: 28, padX: 10, font: 12.5, itemR: 6, boxR: 8 },
  md: { h: 30, padX: 14, font: 13, itemR: 6, boxR: 8 },
  lg: { h: 32, padX: 16, font: 13.5, itemR: 7, boxR: 9 },
} as const;

export default function Seg<T extends string | number>({
  options,
  value,
  onChange,
  size = 'sm',
}: Props<T>) {
  const s = SIZES[size];
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: SEG_TRACK,
        borderRadius: s.boxR,
        padding: 3,
        // 코스/방식 탭만 좌측 정렬 — 나머지는 부모의 세로 중앙 정렬을 따른다.
        alignSelf: size === 'lg' ? 'flex-start' : undefined,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <div
            key={String(o.value)}
            role="button"
            tabIndex={0}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onChange(o.value);
            }}
            style={{
              height: s.h,
              padding: `0 ${s.padX}px`,
              display: 'flex',
              alignItems: 'center',
              borderRadius: s.itemR,
              fontSize: s.font,
              cursor: 'pointer',
              background: on ? 'white' : 'transparent',
              boxShadow: on ? '0 1px 2px oklch(0.4 0.02 60 / .15)' : 'none',
              fontWeight: on ? 650 : 500,
              color: on ? INK : 'oklch(0.45 0.012 60)',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </div>
        );
      })}
    </div>
  );
}
