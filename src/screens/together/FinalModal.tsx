/**
 * 최종 확정 (시안: 최종 확정) — 누구든 확정하면 모두의 화면에 색종이와 함께 뜬다.
 * 닫는 건 각자 한다. '다시 고르기' 는 모두에게 확정을 푼다. 닫으면 메뉴 고르기(OrderPanel)로 이어진다.
 */
import { useMemo } from 'react';

import { copyText } from '../../lib/ipc';
import { hhmm } from '../../lib/util';
import { type RoomState, shortName } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, CH, HUES } from '../../theme';
import { Avatar, INPUT_BORDER } from './parts';

const PIECES = 90;

export default function FinalModal({
  room,
  me,
  onClose,
}: {
  room: RoomState;
  me: string;
  onClose: () => void;
}) {
  const act = useShare((s) => s.act);
  const f = room.final!;
  const r = room.restaurants.find((x) => x.id === f.restId);
  const ppl = room.members.filter((m) => m.online);
  const hue = r ? (CH[r.category] ?? 300) : 300;
  const byText = `${f.by === me ? '내가' : `${shortName(room.members.find((m) => m.id === f.by)?.name ?? '누군가')}님이`} ${hhmm(f.at)}에 확정`;

  // 확정마다 새로 뿌리는 색종이 (시안: 90조각, lp-fall)
  const confetti = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: Math.random() * 100,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 9,
        round: Math.random() < 0.3,
        light: (0.66 + Math.random() * 0.14).toFixed(2),
        hue: HUES[i % 12],
        dur: (2.2 + Math.random() * 1.8).toFixed(2),
        delay: (Math.random() * 0.7).toFixed(2),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.at],
  );

  if (!r) return null;
  const menus = r.menus.length
    ? r.menus
        .slice(0, 3)
        .map((m) => `${m.name} ${m.price ? m.price.toLocaleString('ko-KR') : ''}`.trim())
        .join(' · ')
    : '메뉴 미등록';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'oklch(0.22 0.012 60 / .5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'lp-in .3s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {confetti.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              top: -20,
              width: p.w,
              height: p.h,
              borderRadius: p.round ? '50%' : 2,
              background: `oklch(${p.light} 0.16 ${p.hue})`,
              animation: `lp-fall ${p.dur}s ${p.delay}s cubic-bezier(.25,.6,.4,1) forwards`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'relative',
          width: 440,
          maxWidth: '100%',
          background: 'white',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 30px 80px oklch(0.2 0.02 60 / .4)',
          animation: 'lp-rise .6s cubic-bezier(.2,.9,.3,1.25)',
        }}
      >
        <div
          style={{
            padding: '26px 26px 20px',
            background: 'oklch(0.965 0.025 50)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            textAlign: 'center',
          }}
        >
          <span
            style={{ fontSize: 12.5, fontWeight: 750, color: 'oklch(0.45 0.14 40)', letterSpacing: '.04em' }}
          >
            오늘 점심, 확정!
          </span>
          <span
            style={{
              fontSize: 34,
              fontWeight: 820,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              animation: 'lp-pop .6s .15s cubic-bezier(.2,.9,.3,1.4) both',
            }}
          >
            {r.name}
          </span>
          <span
            style={{
              height: 24,
              padding: '0 10px',
              borderRadius: 12,
              background: `oklch(0.95 0.035 ${hue})`,
              color: `oklch(0.42 0.11 ${hue})`,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {r.category}
          </span>
        </div>
        <div style={{ padding: '18px 26px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'oklch(0.55 0.012 60)', width: 52 }}>전화</span>
            <span style={{ fontSize: 17, fontWeight: 750, fontVariantNumeric: 'tabular-nums', flex: 1 }}>
              {r.phone || '번호 없음'}
            </span>
            {r.phone ? (
              <button
                type="button"
                className="tg-soft"
                onClick={() => {
                  void copyText(r.phone);
                  toast('전화번호를 복사했어요');
                }}
                style={{
                  height: 30,
                  padding: '0 11px',
                  border: `1px solid ${INPUT_BORDER}`,
                  borderRadius: 7,
                  background: 'white',
                  font: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                번호 복사
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'oklch(0.55 0.012 60)', width: 52, paddingTop: 2 }}>
              메뉴
            </span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, flex: 1 }}>{menus}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'oklch(0.55 0.012 60)', width: 52 }}>함께</span>
            <div style={{ display: 'flex' }}>
              {ppl.map((p, i) => (
                <Avatar
                  key={p.id}
                  m={p}
                  size={26}
                  ring={2}
                  style={{ marginRight: -6, animation: `lp-pop .4s ${0.3 + i * 0.08}s ease-out both` }}
                />
              ))}
            </div>
            <span style={{ fontSize: 12.5, color: 'oklch(0.5 0.012 60)', paddingLeft: 8 }}>{byText}</span>
          </div>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              padding: '9px 12px',
              borderRadius: 8,
              background: 'oklch(0.975 0.004 75)',
              color: 'oklch(0.42 0.012 60)',
            }}
          >
            이제 각자 먹을 메뉴를 골라요. 예약한 사람이 ‘예약 완료’를 누르면 모두에게 알려져요.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              className="tg-soft"
              onClick={() => act({ type: 'unfinal' })}
              style={{
                height: 40,
                padding: '0 16px',
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 8,
                background: 'white',
                font: 'inherit',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              다시 고르기
            </button>
            <button
              type="button"
              className="tg-accent"
              onClick={onClose}
              style={{
                flex: 1,
                height: 40,
                border: 'none',
                borderRadius: 8,
                background: AC,
                color: 'white',
                font: 'inherit',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              메뉴 고르러 가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
