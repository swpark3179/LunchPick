/**
 * '늘 먹는' 알약 — 이 식당에서 늘 먹는 메뉴를 표시한다 (내 PC 에만 저장, 공유·내보내기 안 됨).
 * ★(대표 메뉴)는 식당 정보라 공유되지만, 이건 나만의 표시라 모양을 다르게 둔다.
 * 같이 고르기에서 이 식당이 확정되면 표시한 메뉴가 내 메뉴로 자동으로 골라진다.
 */
import { useState } from 'react';

import { isMyMenu } from '../lib/myMenus';
import { useData } from '../store/dataStore';
import { AC, AINK, SOFT } from '../theme';

export default function MyMenuPill({
  restName,
  menuName,
  size = 'md',
}: {
  restName: string;
  menuName: string;
  size?: 'sm' | 'md';
}) {
  const on = useData((s) => isMyMenu(s.myMenus, restName, menuName));
  const toggle = useData((s) => s.toggleMyMenu);
  // 처음 그릴 때는 가만히 있고, 누를 때만 튀어오른다.
  const [bump, setBump] = useState(0);
  const h = size === 'sm' ? 20 : 22;
  return (
    <button
      type="button"
      aria-pressed={on}
      title={
        on
          ? '늘 먹는 메뉴 해제 · 나만 보여요'
          : '늘 먹는 메뉴로 표시 — 같이 고르기에서 확정되면 자동으로 골라져요 · 나만 보여요(공유·내보내기 안 돼요)'
      }
      onClick={(e) => {
        e.stopPropagation();
        toggle(restName, menuName);
        setBump((b) => b + 1);
      }}
      className={on ? '' : 'btn-soft'}
      style={{
        flex: 'none',
        height: h,
        padding: '0 8px',
        borderRadius: h / 2,
        border: on ? `1px solid ${AC}` : '1px dashed oklch(0.82 0.01 60)',
        background: on ? SOFT : 'transparent',
        color: on ? AINK : 'oklch(0.6 0.01 60)',
        font: 'inherit',
        fontSize: size === 'sm' ? 11 : 11.5,
        fontWeight: on ? 720 : 560,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        transition: 'background .2s, color .2s, border-color .2s',
      }}
    >
      {/* 글자만 다시 그려 튀어오르게 한다 — 버튼을 다시 만들면 키보드 포커스를 잃는다. */}
      <span
        key={bump}
        style={{
          display: 'inline-block',
          animation: bump ? 'lp-pop .35s cubic-bezier(.2,.9,.3,1.4)' : 'none',
        }}
      >
        {on ? '✓ 늘 먹는' : '늘 먹는'}
      </span>
    </button>
  );
}
