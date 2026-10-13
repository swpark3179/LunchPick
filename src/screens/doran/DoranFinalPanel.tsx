/**
 * 도란식사 — 확정된 뒤의 가운데. 확정된 선택지(식당 · 메뉴 구성 · 합계 · 예산 비교)를 크게 보여 주고,
 * 식당에 예약한 사람이 '예약하기'에서 실제로 예약한 메뉴를 적어 모두에게 알린다 (점심과 같은 예약 흐름).
 * 누군가 예약 화면을 열어 두면 '○○님이 예약하는 중'이 보이고, 그때 누르면 한 번 더 묻는다.
 */
import { useState } from 'react';

import { copyText } from '../../lib/ipc';
import { hhmm } from '../../lib/util';
import { budgetFit, choiceName, choiceOf, moneyText } from '../../share/doran';
import type { RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AINK, CH, INK, MUTED, MUTED_3, SOFT } from '../../theme';
import { itemOf } from '../together/items';
import { ItemTable, NoteBox, ReservationCard } from '../together/OrderPanel';
import { btnAccent, btnSoft, IconCheck, IconPhone, whoShort } from '../together/parts';
import { CodeBadge, FitBadge } from './ui';

const AMBER_FG = 'oklch(0.45 0.1 70)';

export default function DoranFinalPanel({
  room,
  me,
  host,
  onReserve,
  onInfo,
}: {
  room: RoomState;
  me: string;
  host: boolean;
  onReserve: () => void;
  onInfo: (restId: string) => void;
}) {
  const act = useShare((s) => s.act);
  const [confirmFor, setConfirmFor] = useState<number | null>(null);
  const f = room.final!;
  const c = f.choiceId ? choiceOf(room, f.choiceId) : undefined;
  const r = room.restaurants.find((x) => x.id === f.restId);
  if (!c || !r) return null;
  const it = itemOf(room, c.id)!;
  const v = room.reservation;
  const fit = budgetFit(c.items, room.budget);
  const busy = room.reserving && room.reserving.by !== me ? room.reserving : null;
  const confirmBusy = !!busy && confirmFor === busy.at;
  const canEdit = !!v && (v.by === me || host);
  const byText = `${f.by === me ? '내가' : `${whoShort(room, me, f.by)}님이`} ${hhmm(f.at)}에 확정`;

  const openReserve = () => {
    if (busy && !confirmBusy) {
      setConfirmFor(busy.at);
      return;
    }
    setConfirmFor(null);
    onReserve();
  };

  return (
    <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 18px 18px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              background: 'white',
              borderRadius: 14,
              boxShadow: '0 0 0 1.5px oklch(0.82 0.06 150), 0 10px 28px oklch(0.55 0.13 150 / .12)',
              overflow: 'hidden',
              animation: 'lp-pop .45s cubic-bezier(.2,.9,.3,1.3)',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                background: 'oklch(0.95 0.04 150)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'oklch(0.55 0.13 150)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                <IconCheck size={15} stroke={3} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 750, color: 'oklch(0.4 0.1 150)' }}>
                  도란식사 확정
                </div>
                <div style={{ fontSize: 11.5, color: 'oklch(0.45 0.08 150)' }}>{byText}</div>
              </div>
              <button
                type="button"
                className="tg-soft"
                disabled={!!v}
                title={v ? '예약을 취소한 뒤에 다시 고를 수 있어요' : '모두에게서 확정을 풀어요'}
                onClick={() => act({ type: 'unfinal' })}
                style={{ ...btnSoft(30, 11), opacity: v ? 0.45 : 1 }}
              >
                다시 고르기
              </button>
            </div>
            <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <CodeBadge code={choiceName(c)} hue={it.hue} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 820, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {c.label || r.name}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onInfo(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onInfo(r.id);
                    }}
                    title="식당 정보"
                    style={{ fontSize: 12.5, color: MUTED, marginTop: 2, cursor: 'pointer' }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: `oklch(0.62 0.15 ${CH[r.category] ?? 300})`,
                        marginRight: 6,
                      }}
                    />
                    {c.label ? `${r.name} · ` : ''}
                    {r.category}
                    {r.memo ? ` · ${r.memo}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconPhone size={15} color="oklch(0.56 0.16 40)" />
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 760,
                    fontVariantNumeric: 'tabular-nums',
                    color: r.phone ? INK : MUTED_3,
                  }}
                >
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
                    style={btnSoft(28, 10)}
                  >
                    번호 복사
                  </button>
                ) : null}
              </div>
              <ItemTable items={c.items} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 9,
                  background: SOFT,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 750, color: AINK }}>선택지 합계</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {moneyText(c.items)}
                </span>
                <FitBadge fit={fit} />
                <span style={{ flex: 1 }} />
                {room.budget ? (
                  <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                    총사용금액 {room.budget.toLocaleString('ko-KR')}원
                  </span>
                ) : null}
              </div>
              {c.note ? <NoteBox note={c.note} /> : null}
            </div>
          </div>

          {v ? (
            <ReservationCard
              room={room}
              me={me}
              v={v}
              r={r}
              all={[]}
              canEdit={canEdit}
              onEdit={openReserve}
            />
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------ 아래: 예약하기 */}
      <div
        style={{
          flex: 'none',
          borderTop: '1px solid oklch(0.91 0.006 75)',
          background: 'white',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {confirmBusy && busy ? (
          <>
            <span style={{ flex: 1, minWidth: 200, fontSize: 13, fontWeight: 650, color: AMBER_FG }}>
              {whoShort(room, me, busy.by)}님이 예약하는 중이에요. 그래도 할까요?
            </span>
            <button type="button" className="tg-soft" onClick={() => setConfirmFor(null)} style={btnSoft(38)}>
              취소
            </button>
            <button type="button" className="tg-accent" onClick={openReserve} style={btnAccent(38)}>
              그래도 예약하기
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>
              {busy
                ? `${whoShort(room, me, busy.by)}님이 예약하는 중이에요`
                : v
                  ? canEdit
                    ? '예약을 다시 했다면 ‘예약 수정’으로 모두에게 알려 주세요'
                    : `예약은 ${whoShort(room, me, v.by)}님이 했어요 · 고치는 건 예약한 사람과 호스트만 할 수 있어요`
                  : '식당에 예약한 사람이 ‘예약하기’에서 예약한 메뉴를 적고 모두에게 알려요'}
            </span>
            {!v ? (
              <button type="button" className="tg-accent" onClick={openReserve} style={btnAccent(38)}>
                <IconPhone size={15} />
                예약하기
              </button>
            ) : canEdit ? (
              <button type="button" className="tg-soft" onClick={openReserve} style={btnSoft(38)}>
                예약 수정
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
