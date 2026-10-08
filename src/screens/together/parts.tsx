/**
 * 같이 고르기 화면에서 반복해서 쓰는 조각 — 아바타, 아이콘(시안의 SVG), 버튼 스타일.
 */
import { type ReactNode, useRef } from 'react';

import type { Member, RoomState } from '../../share/protocol';
import { initials, shortName } from '../../share/protocol';
import { AC, INK } from '../../theme';

/** 시안의 avBg — 이름에서 정해진 hue 로 칠한다 */
export const avBg = (hue: number) => `oklch(0.58 0.14 ${hue})`;

export const INPUT_BORDER = 'oklch(0.88 0.006 75)';
export const OK = 'oklch(0.62 0.15 150)';
export const AMBER = 'oklch(0.75 0.14 75)';
export const GRAY_DOT = 'oklch(0.75 0.01 60)';

export const memberOf = (room: RoomState, id: string): Member | undefined =>
  room.members.find((m) => m.id === id);

/** 채팅·태그에 쓰는 짧은 이름. 내 이름이면 '나'. */
export const whoShort = (room: RoomState, me: string, id: string) =>
  id === me ? '나' : shortName(memberOf(room, id)?.name ?? '누군가');

export function Avatar({
  m,
  size = 26,
  ring,
  ringColor = 'white',
  dim,
  title,
  className,
  style,
}: {
  m: Pick<Member, 'name' | 'hue'> | undefined;
  size?: number;
  /** 바깥 링 두께 (겹쳐 놓을 때) */
  ring?: number;
  ringColor?: string;
  dim?: boolean;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      title={title ?? m?.name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: dim ? 'oklch(0.84 0.008 75)' : avBg(m?.hue ?? 60),
        color: 'white',
        fontSize: Math.max(7.5, Math.round(size * 0.36 * 10) / 10),
        fontWeight: 750,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        boxShadow: ring ? `0 0 0 ${ring}px ${ringColor}` : 'none',
        transition: 'background .4s',
        ...style,
      }}
    >
      {initials(m?.name ?? '?')}
    </span>
  );
}

/** 겹쳐 놓은 아바타 묶음 */
export function AvatarStack({
  members,
  size = 20,
  overlap = 5,
  ringColor = 'white',
  max = 5,
}: {
  members: (Member | undefined)[];
  size?: number;
  overlap?: number;
  ringColor?: string;
  max?: number;
}) {
  const list = members.filter((m): m is Member => !!m);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {list.slice(0, max).map((m, i) => (
        <Avatar
          key={m.id}
          m={m}
          size={size}
          ring={2}
          ringColor={ringColor}
          style={{ marginLeft: i ? -overlap : 0, animation: 'lp-pop .35s ease-out both' }}
        />
      ))}
      {list.length > max ? (
        <span style={{ marginLeft: 4, fontSize: 11.5, color: 'oklch(0.5 0.012 60)', fontWeight: 650 }}>
          +{list.length - max}
        </span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------- 아이콘 (시안의 SVG 그대로)

type IconProps = { size?: number; color?: string; stroke?: number; style?: React.CSSProperties };

function Svg({
  size = 16,
  color = 'currentColor',
  stroke = 2,
  fill = 'none',
  style,
  children,
}: IconProps & { fill?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === 'none' ? color : 'none'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none', display: 'block', ...style }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconX = (p: IconProps) => (
  <Svg stroke={2.4} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
/** ⊘ 가기 싫어요 */
export const IconBan = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6 6l12 12" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 7.5v.01" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg stroke={2.6} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconDice = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <circle cx="9" cy="9" r="1.3" fill="currentColor" />
    <circle cx="15" cy="15" r="1.3" fill="currentColor" />
    <circle cx="15" cy="9" r="1.3" fill="currentColor" />
    <circle cx="9" cy="15" r="1.3" fill="currentColor" />
  </Svg>
);
/** 채워진 반짝임 (AI) */
export const IconSpark = ({ size = 17, color = AC, style }: IconProps) => (
  <Svg size={size} fill={color} style={style}>
    <path d="M12 2.5l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
  </Svg>
);
export const IconLadder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3v18M17 3v18M7 8h10M7 13.5h10M7 19h10" />
  </Svg>
);
export const IconBack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12l16-8-6 16-2.5-6.5z" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Svg>
);
export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.2M6.6 6.6C4.4 8.1 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1" />
  </Svg>
);
export const IconCrown = ({ size = 16, color = 'oklch(0.72 0.15 75)', style }: IconProps) => (
  <Svg size={size} fill={color} style={style}>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
  </Svg>
);
export const IconPlay = ({ size = 14, style }: IconProps) => (
  <Svg size={size} fill="currentColor" style={style}>
    <path d="M7 4.5v15l12-7.5z" />
  </Svg>
);
export const IconServer = ({ size = 20, style }: IconProps) => (
  <Svg size={size} stroke={1.8} style={style}>
    <rect x="4" y="4" width="16" height="7" rx="2" />
    <rect x="4" y="13" width="16" height="7" rx="2" />
    <path d="M8 7.5h.01M8 16.5h.01" />
  </Svg>
);
/** 식당 정보 동기화 — 맞물려 도는 두 화살표 */
export const IconSync = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 10.5A7.5 7.5 0 0 0 6.2 7.2L4.5 9" />
    <path d="M4.5 4.5V9H9" />
    <path d="M4.5 13.5a7.5 7.5 0 0 0 13.3 3.3l1.7-1.8" />
    <path d="M19.5 19.5V15H15" />
  </Svg>
);
/** 다른 사람이 보고 있는 카드에 붙는 이름표의 화살표 */
export const IconCursor = ({ size = 10, style }: IconProps) => (
  <Svg size={size} fill="currentColor" style={style}>
    <path d="M4 2l16 8-7 2-3 7z" />
  </Svg>
);

// ---------------------------------------------------------------- 버튼 스타일 (시안 값)

export const btnAccent = (h = 38, px = 18): React.CSSProperties => ({
  height: h,
  padding: `0 ${px}px`,
  border: 'none',
  borderRadius: 8,
  background: AC,
  color: 'white',
  font: 'inherit',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  whiteSpace: 'nowrap',
  flex: 'none',
});

export const btnSoft = (h = 38, px = 14): React.CSSProperties => ({
  height: h,
  padding: `0 ${px}px`,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 8,
  background: 'white',
  color: INK,
  font: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  flex: 'none',
});

/** 값이 바뀔 때마다 증가하는 키 — `key` 로 넘겨 애니메이션을 다시 재생할 때 쓴다. */
export function useBumpKey(value: unknown) {
  const ref = useRef({ value, n: 0 });
  if (ref.current.value !== value) ref.current = { value, n: ref.current.n + 1 };
  return ref.current.n;
}

/** 시안의 shakeAnim — 오류가 날 때마다 두 키프레임을 번갈아 재생한다 */
export const shakeAnim = (n: number) => (n ? `${n % 2 ? 'lp-shake' : 'lp-shake2'} .4s ease-out` : 'none');

/** 상태 점 — 연결됨은 초록 숨쉬기, 연결 중은 노랑 깜빡임 */
export function StatusDot({ tone, size = 8 }: { tone: 'live' | 'wait' | 'off'; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'inline-block',
        background: tone === 'live' ? OK : tone === 'wait' ? AMBER : GRAY_DOT,
        animation:
          tone === 'live' ? 'lp-breathe 2s infinite' : tone === 'wait' ? 'lp-blink 1s infinite' : 'none',
      }}
    />
  );
}

export function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        borderRightColor: 'transparent',
        animation: 'lp-spin .8s linear infinite',
        flex: 'none',
        display: 'inline-block',
      }}
    />
  );
}
