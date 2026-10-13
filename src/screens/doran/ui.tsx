/**
 * 도란식사 화면 조각 — 모달 틀, 입력칸 모양, 선택지 코드 배지, 예산 배지.
 */
import { useEffect } from 'react';

import type { Fit } from '../../share/doran';
import { INK } from '../../theme';
import { IconX, INPUT_BORDER } from '../together/parts';

export const fieldStyle = (w?: number | string): React.CSSProperties => ({
  width: w,
  height: 36,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 8,
  padding: '0 10px',
  font: 'inherit',
  fontSize: 13.5,
  outline: 'none',
  background: 'white',
  color: INK,
  minWidth: 0,
});

export const LABEL: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'oklch(0.38 0.012 60)' };

/** 금액 입력 — 숫자만 남기고 천 단위로 쉼표 ('300000' → '300,000') */
export const moneyInput = (raw: string, maxDigits = 8) => {
  const d = raw.replace(/[^\d]/g, '').replace(/^0+/, '').slice(0, maxDigits);
  return d ? Number(d).toLocaleString('ko-KR') : '';
};

export const moneyValue = (text: string) => {
  const n = parseInt(text.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** 방 안에 뜨는 모달 — 머리(제목·부제·✕) · 본문(스크롤) · 아래(버튼). Esc 로 닫는다. */
export function Modal({
  title,
  kicker,
  sub,
  width = 520,
  onClose,
  foot,
  children,
}: {
  title: React.ReactNode;
  kicker?: string;
  sub?: React.ReactNode;
  width?: number;
  onClose: () => void;
  foot?: React.ReactNode;
  children: React.ReactNode;
}) {
  // 방의 Esc(확정 화면·정보 닫기)보다 먼저 받아 이 창만 닫는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: 'oklch(0.25 0.012 60 / .32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'lp-in .2s ease-out',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={kicker ?? (typeof title === 'string' ? title : undefined)}
        style={{
          width,
          maxWidth: 'calc(100% - 40px)',
          maxHeight: 'calc(100% - 40px)',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'lp-rise .45s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '18px 14px 14px 20px',
            borderBottom: '1px solid oklch(0.93 0.005 75)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {kicker ? (
              <span style={{ fontSize: 12, fontWeight: 750, color: 'oklch(0.56 0.16 40)' }}>{kicker}</span>
            ) : null}
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</span>
            {sub ? (
              <span style={{ fontSize: 12.5, color: 'oklch(0.5 0.012 60)', lineHeight: 1.5 }}>{sub}</span>
            ) : null}
          </div>
          <div
            role="button"
            tabIndex={0}
            title="닫기"
            className="tg-act"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onClose();
            }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'oklch(0.42 0.012 60)',
              flex: 'none',
            }}
          >
            <IconX size={15} stroke={2.2} />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '14px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {children}
        </div>
        {foot ? (
          <div
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px 16px',
              borderTop: '1px solid oklch(0.93 0.005 75)',
            }}
          >
            {foot}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 'A안' 배지 — 선택지마다 번호로 색을 돌린다 */
export function CodeBadge({ code, hue, size = 'md' }: { code: string; hue: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 20 : 24;
  return (
    <span
      style={{
        height: h,
        minWidth: h + 8,
        padding: '0 7px',
        borderRadius: 7,
        background: `oklch(0.94 0.045 ${hue})`,
        color: `oklch(0.4 0.12 ${hue})`,
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {code}
    </span>
  );
}

const FIT_COLORS: Record<Fit['tone'], [string, string]> = {
  under: ['oklch(0.95 0.04 150)', 'oklch(0.4 0.1 150)'],
  exact: ['oklch(0.55 0.13 150)', 'white'],
  over: ['oklch(0.95 0.035 25)', 'oklch(0.48 0.16 25)'],
  maybe: ['oklch(0.96 0.045 85)', 'oklch(0.45 0.1 70)'],
};

/** 총사용금액과 비교한 결과 — 남음(초록) · 딱 맞음(진한 초록) · 초과(빨강) · +α 라 모름(노랑) */
export function FitBadge({ fit }: { fit: Fit | null }) {
  if (!fit) return null;
  const [bg, fg] = FIT_COLORS[fit.tone];
  return (
    <span
      key={fit.text}
      style={{
        height: 22,
        padding: '0 8px',
        borderRadius: 11,
        background: bg,
        color: fg,
        fontSize: 11.5,
        fontWeight: 750,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        animation: 'lp-pop .35s ease-out',
      }}
    >
      {fit.text}
    </span>
  );
}
