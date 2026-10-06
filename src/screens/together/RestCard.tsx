import type { Member } from '../../share/protocol';
import type { Restaurant } from '../../lib/types';
import { topMenus } from '../../lib/util';
import { AC, AINK, INK, MUTED, SOFT, catDot } from '../../theme';
import { Avatar, IconCheck, IconInfo, IconSpark, IconThumbDown } from './parts';

const SCAN_BG = 'oklch(0.96 0.03 250)';
const SCAN_RING = '0 0 0 2px oklch(0.6 0.15 250), 0 10px 26px oklch(0.6 0.15 250 / .22)';
const BASE_RING = '0 0 0 1px oklch(0.91 0.006 75)';

type Props = {
  r: Restaurant;
  /** 후보에 올린 사람 (없으면 후보 아님) */
  candBy: Member | undefined;
  isCand: boolean;
  reason?: string;
  flash: boolean;
  landed: boolean;
  busy: boolean;
  exiting: boolean;
  enterDelay: number;
  onToggle: () => void;
  onDislike: () => void;
  onInfo: () => void;
};

export default function RestCard({
  r,
  candBy,
  isCand,
  reason,
  flash,
  landed,
  busy,
  exiting,
  enterDelay,
  onToggle,
  onDislike,
  onInfo,
}: Props) {
  const menus = topMenus(r, 2)
    .map((m) => m.name)
    .join(' · ');
  return (
    <div
      data-flip={exiting ? undefined : r.id}
      role="button"
      tabIndex={0}
      aria-pressed={isCand}
      className={`tg-card ${isCand ? 'is-cand' : ''} ${busy ? 'is-busy' : ''} ${exiting ? 'lp-card-out' : 'lp-card-in'}`}
      onClick={() => !busy && onToggle()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        position: 'relative',
        background: flash ? SCAN_BG : isCand ? SOFT : 'white',
        borderRadius: 12,
        padding: '13px 14px 10px',
        boxShadow: flash ? SCAN_RING : isCand ? `0 0 0 2px ${AC}` : BASE_RING,
        transform: flash ? 'scale(1.045)' : undefined,
        cursor: busy ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 112,
        animationDelay: exiting ? undefined : `${enterDelay}ms`,
        zIndex: flash ? 2 : undefined,
      }}
    >
      {/* 무작위 뽑기에서 당첨된 순간 퍼지는 링 — 카드 자체의 등장 애니메이션은 건드리지 않는다 */}
      {landed ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            animation: 'lp-land .9s ease-out 2',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 후보 표시 */}
      {isCand ? (
        <span
          className="lp-pop"
          style={{
            position: 'absolute',
            top: -7,
            right: -7,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: AC,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 2px white',
          }}
        >
          <IconCheck size={13} stroke={2.8} />
        </span>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span
          style={{ width: 7, height: 7, borderRadius: '50%', background: catDot(r.category), flex: 'none' }}
        />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: INK,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {r.name}
        </span>
        <span style={{ fontSize: 11.5, color: MUTED, flex: 'none' }}>{r.category}</span>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: MUTED,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {menus || '메뉴 미등록'}
      </div>
      {reason ? (
        <div
          key={reason}
          className="lp-blur-in"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 5,
            fontSize: 12,
            color: AINK,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          <span style={{ marginTop: 1 }}>
            <IconSpark size={13} />
          </span>
          {reason}
        </div>
      ) : null}

      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        {isCand && candBy ? (
          <span
            className="lp-fade-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              color: AINK,
              fontWeight: 650,
            }}
          >
            <Avatar m={candBy} size={16} />
            {candBy.name}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'oklch(0.66 0.01 60)' }}>{busy ? '' : '눌러서 후보로'}</span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="tg-mini is-no"
          title="가기 싫어요"
          onClick={(e) => {
            e.stopPropagation();
            onDislike();
          }}
          style={miniBtn}
        >
          <IconThumbDown size={14} />
          싫어요
        </button>
        <button
          type="button"
          className="tg-mini"
          title="메뉴·전화번호 보기 (나만 보여요)"
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          style={miniBtn}
        >
          <IconInfo size={14} />
          정보
        </button>
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  height: 26,
  padding: '0 7px',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'oklch(0.42 0.012 60)',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
};
