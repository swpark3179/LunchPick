import { type CupG, cupRoundLabel } from '../../pick/engine';
import type { PickItem } from '../../lib/types';
import { topMenus } from '../../lib/util';
import { useData } from '../../store/dataStore';
import { usePick } from '../../store/pickStore';
import { INK, MUTED, SOFT, catBg, catFg } from '../../theme';

export default function Cup({ g }: { g: CupG }) {
  const restaurants = useData((s) => s.restaurants);
  const cupPick = usePick((s) => s.cupPick);

  const size = g.round.length;
  const left = g.round[g.i];
  const right = g.round[g.i + 1];
  if (!left) return null;

  const menuLine = (c: PickItem) => {
    const r = restaurants.find((x) => x.id === c.restId);
    return r ? topMenus(r, 3).map((m) => m.name).join(' · ') || '메뉴 미등록' : '메뉴 미등록';
  };

  const sideStyle = (c: PickItem, sd: 'L' | 'R'): React.CSSProperties => {
    const mine = g.chosen === c.key;
    const other = !!g.chosen && !mine;
    return {
      flex: 1,
      minWidth: 0,
      background: 'white',
      borderRadius: 16,
      padding: '26px 24px',
      cursor: 'pointer',
      minHeight: 240,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: mine
        ? '0 0 0 3px oklch(0.56 0.16 40), 0 16px 40px oklch(0.56 0.16 40 / .25)'
        : '0 0 0 1px oklch(0.91 0.006 75), 0 6px 18px oklch(0.4 0.03 60 / .06)',
      opacity: g.enter ? 0 : other ? 0.25 : 1,
      transform: g.enter
        ? 'translateY(22px) scale(.97)'
        : mine
          ? 'scale(1.05)'
          : other
            ? `translateX(${sd === 'L' ? -36 : 36}px) scale(.92)`
            : 'none',
      transition: g.enter
        ? 'none'
        : 'opacity .35s, transform .5s cubic-bezier(.2,.9,.3,1.3), box-shadow .2s',
    };
  };

  const card = (c: PickItem, sd: 'L' | 'R') => (
    <div
      className="cup-card"
      role="button"
      tabIndex={0}
      onClick={() => cupPick(sd)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') cupPick(sd);
      }}
      style={sideStyle(c, sd)}
    >
      <span
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 24,
          padding: '0 10px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 650,
          background: catBg(c.cat),
          color: catFg(c.cat),
        }}
      >
        {c.cat}
      </span>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {c.title}
      </div>
      <div style={{ fontSize: 14, color: 'oklch(0.45 0.012 60)', lineHeight: 1.5 }}>
        {menuLine(c)}
      </div>
      <div style={{ flex: 1 }} />
      {/* 실시간 같이 고르기가 켜지면 여기에 투표 아바타가 들어온다 (이번 버전에서는 비어 있음) */}
      <div style={{ display: 'flex', gap: 4, minHeight: 26 }} />
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        paddingTop: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {cupRoundLabel(size)}
        </span>
        <span style={{ fontSize: 13, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
          {g.i / 2 + 1} / {Math.floor(size / 2)} 경기 · {g.roundNo}라운드
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 22,
          width: '100%',
          maxWidth: 820,
        }}
      >
        {card(left, 'L')}
        <div
          style={{
            alignSelf: 'center',
            width: 52,
            height: 52,
            flex: 'none',
            borderRadius: '50%',
            background: INK,
            color: 'white',
            fontWeight: 800,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: '0.04em',
          }}
        >
          VS
        </div>
        {card(right ?? left, 'R')}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 820,
        }}
      >
        <span style={{ fontSize: 12.5, color: MUTED }}>다음 라운드 진출</span>
        {g.next.map((t) => (
          <span
            key={t.key}
            style={{
              height: 22,
              padding: '0 9px',
              borderRadius: 11,
              background: SOFT,
              color: 'oklch(0.42 0.12 40)',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {t.title}
          </span>
        ))}
      </div>
    </div>
  );
}
