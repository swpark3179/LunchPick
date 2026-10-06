/** 디자인에 반복해서 나오는 알약형 토글 칩. 색은 호출하는 쪽이 정한다. */
type Props = {
  label: string;
  onClick: () => void;
  bg: string;
  color: string;
  border: string;
  dot?: string;
  count?: string;
  weight?: number;
  height?: number;
  padX?: number;
  fontSize?: number;
  dotSize?: number;
  gap?: number;
  strike?: boolean;
  title?: string;
};

export default function Chip({
  label,
  onClick,
  bg,
  color,
  border,
  dot,
  count,
  weight = 500,
  height = 30,
  padX = 12,
  fontSize = 13,
  dotSize = 8,
  gap = 7,
  strike = false,
  title,
}: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      style={{
        height,
        padding: `0 ${padX}px`,
        display: 'flex',
        alignItems: 'center',
        gap,
        borderRadius: height / 2,
        fontSize,
        cursor: 'pointer',
        background: bg,
        color,
        boxShadow: `inset 0 0 0 1px ${border}`,
        fontWeight: weight,
        textDecoration: strike ? 'line-through' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {dot ? (
        <span
          style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: dot, flex: 'none' }}
        />
      ) : null}
      <span>{label}</span>
      {count !== undefined ? (
        <span style={{ fontSize: fontSize - 1, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </span>
      ) : null}
    </div>
  );
}
