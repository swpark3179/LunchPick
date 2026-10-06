/**
 * 같이 고르기 화면에서 반복해서 쓰는 조각 — 아바타, 아이콘, 버튼 스타일, 애니메이션 훅.
 */
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useReducer, useRef } from 'react';

import type { Member, RoomState } from '../../share/protocol';
import { initial } from '../../share/protocol';
import { INK } from '../../theme';

export const avatarBg = (hue: number) => `oklch(0.64 0.14 ${hue})`;
export const avatarSoft = (hue: number) => `oklch(0.95 0.035 ${hue})`;
export const avatarInk = (hue: number) => `oklch(0.42 0.12 ${hue})`;

export const INPUT_BORDER = 'oklch(0.88 0.006 75)';

/** 받침에 따라 '로' / '으로' (ㄹ 받침은 '로') */
export const josaRo = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return '로';
  const jong = (c - 0xac00) % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
};

export const memberOf = (room: RoomState, id: string): Member | undefined =>
  room.members.find((m) => m.id === id);

export function Avatar({
  m,
  size = 26,
  ring,
  dim,
  title,
  className,
}: {
  m: Pick<Member, 'name' | 'hue'> | undefined;
  size?: number;
  /** 바깥 흰 링 (겹쳐 놓을 때) */
  ring?: boolean;
  dim?: boolean;
  title?: string;
  className?: string;
}) {
  const hue = m?.hue ?? 60;
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
        background: dim ? 'oklch(0.86 0.008 75)' : avatarBg(hue),
        color: 'white',
        fontSize: Math.round(size * 0.46),
        fontWeight: 750,
        lineHeight: 1,
        boxShadow: ring ? '0 0 0 2px white' : 'none',
        transition: 'background .3s',
      }}
    >
      {initial(m?.name ?? '?')}
    </span>
  );
}

/** 겹쳐 놓은 아바타 묶음 */
export function AvatarStack({
  members,
  size = 20,
  max = 4,
}: {
  members: (Member | undefined)[];
  size?: number;
  max?: number;
}) {
  const list = members.filter((m): m is Member => !!m);
  const shown = list.slice(0, max);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <span key={m.id} className="lp-pop" style={{ marginLeft: i ? -6 : 0, display: 'inline-flex' }}>
          <Avatar m={m} size={size} ring />
        </span>
      ))}
      {list.length > max ? (
        <span style={{ marginLeft: 4, fontSize: 11.5, color: 'oklch(0.5 0.012 60)', fontWeight: 650 }}>
          +{list.length - max}
        </span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------- 아이콘 (16px 기준 선 아이콘)

type IconProps = { size?: number; color?: string; stroke?: number };

function Svg({
  size = 16,
  color = 'currentColor',
  stroke = 1.8,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none', display: 'block' }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconThumbDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9A2 2 0 0 0 4.3 15H10z" />
    <path d="M17 2h2.7A2.3 2.3 0 0 1 22 4.3v6.4A2.3 2.3 0 0 1 19.7 13H17" />
  </Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconDice = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
    <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
    <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Svg>
);
export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
  </Svg>
);
export const IconLadder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3v18M17 3v18M7 8h10M7 13h10M7 18h10" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12l16-8-6 16-2.5-6.5z" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6.5 6.5 0 0 1 3 6" />
  </Svg>
);
export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);
export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </Svg>
);
export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 5.1 5.1l1.4-2.3L19 13.5V17a2 2 0 0 1-2 2A14 14 0 0 1 3 5a2 2 0 0 1 2-2z" />
  </Svg>
);
export const IconCrown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 17l-1-10 5 4 4-6 4 6 5-4-1 10z" />
    <path d="M5 20h14" />
  </Svg>
);
export const IconWifi = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" />
    <circle cx="12" cy="19.5" r="1" fill="currentColor" />
  </Svg>
);

// ---------------------------------------------------------------- 버튼 스타일

export const btn = (kind: 'accent' | 'ink' | 'soft' | 'ghost', h = 34): React.CSSProperties => ({
  height: h,
  padding: `0 ${h >= 34 ? 14 : 11}px`,
  border: kind === 'soft' ? `1px solid ${INPUT_BORDER}` : 'none',
  borderRadius: 8,
  background:
    kind === 'accent'
      ? 'oklch(0.56 0.16 40)'
      : kind === 'ink'
        ? INK
        : kind === 'soft'
          ? 'white'
          : 'transparent',
  color: kind === 'accent' || kind === 'ink' ? 'white' : INK,
  font: 'inherit',
  fontSize: h >= 34 ? 13.5 : 12.5,
  fontWeight: kind === 'accent' || kind === 'ink' ? 700 : 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  flex: 'none',
});

export const btnClass = (kind: 'accent' | 'ink' | 'soft' | 'ghost') =>
  kind === 'accent' ? 'btn-accent' : kind === 'soft' ? 'btn-soft' : kind === 'ghost' ? 'btn-ghost' : '';

// ---------------------------------------------------------------- 애니메이션 훅

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * FLIP — `data-flip` 이 붙은 자식들이 다시 그려질 때 이전 자리에서 새 자리로 미끄러지게 한다.
 * AI 정렬처럼 순서만 바뀌는 변화를 눈으로 따라갈 수 있게 해 준다.
 * `ref` 컨테이너는 position: relative 여야 한다.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, ms = 520) {
  const rects = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = new Map<string, { x: number; y: number }>();
    const skip = reducedMotion();
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((n) => {
      const k = n.dataset.flip!;
      // 레이아웃 좌표(offset)를 쓴다 — 무작위 뽑기의 scale·hover 같은 transform 이나
      // 스크롤에는 흔들리지 않고, 실제로 자리가 바뀐 경우만 움직인다.
      // (컨테이너가 position: relative 라 offsetParent 가 컨테이너다)
      const pos = { x: n.offsetLeft, y: n.offsetTop };
      next.set(k, pos);
      const p = rects.current.get(k);
      if (!p || skip) return;
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: ms,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      });
    });
    rects.current = next;
  });
}

/**
 * 목록에서 빠진 항목을 잠깐 더 그려서 퇴장 애니메이션을 보여준다.
 * 돌려주는 목록에는 원래 자리 근처에 `exiting: true` 인 항목이 끼어 있다.
 */
export function useExiting<T>(items: T[], keyOf: (t: T) => string, ms: number) {
  const prevRef = useRef<T[]>(items);
  const ghosts = useRef(new Map<string, { item: T; index: number; until: number }>());
  const [, force] = useReducer((x: number) => x + 1, 0);

  if (prevRef.current !== items) {
    const now = new Set(items.map(keyOf));
    prevRef.current.forEach((it, i) => {
      const k = keyOf(it);
      if (!now.has(k) && !ghosts.current.has(k))
        ghosts.current.set(k, { item: it, index: i, until: Date.now() + ms });
    });
    for (const k of [...ghosts.current.keys()]) if (now.has(k)) ghosts.current.delete(k);
    prevRef.current = items;
  }

  useEffect(() => {
    if (!ghosts.current.size) return;
    const soonest = Math.min(...[...ghosts.current.values()].map((g) => g.until));
    const t = setTimeout(
      () => {
        const n = Date.now();
        for (const [k, g] of ghosts.current) if (g.until <= n) ghosts.current.delete(k);
        force();
      },
      Math.max(0, soonest - Date.now()),
    );
    return () => clearTimeout(t);
  });

  const out = items.map((item) => ({ item, exiting: false }));
  [...ghosts.current.values()]
    .sort((a, b) => a.index - b.index)
    .forEach((g) => out.splice(Math.min(g.index, out.length), 0, { item: g.item, exiting: true }));
  return out;
}

/** 값이 바뀔 때마다 증가하는 키 — `key` 로 넘겨 애니메이션을 다시 재생할 때 쓴다. */
export function useBumpKey(value: unknown) {
  const ref = useRef({ value, n: 0 });
  if (ref.current.value !== value) ref.current = { value, n: ref.current.n + 1 };
  return ref.current.n;
}

// ---------------------------------------------------------------- 로딩 표시

export function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        borderRightColor: 'transparent',
        animation: 'lp-spin .7s linear infinite',
        flex: 'none',
        display: 'inline-block',
        opacity: 0.9,
      }}
    />
  );
}

export function Dots({ color = 'currentColor' }: { color?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: color,
            animation: `lp-dot 1.1s ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </span>
  );
}
