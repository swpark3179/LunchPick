/**
 * 예약하기 — 식당에 예약하는 사람 화면에서만 열린다. 열려 있는 동안 다른 사람들에게는
 * '○○님이 예약하는 중'이 보인다. 각자 고른 메뉴를 합쳐 채워 두고, 실제로 예약한 대로 고친 뒤
 * '예약 완료'를 누르면 모두에게 알려진다. 특이사항은 글로 적는다.
 */
import { useEffect, useRef, useState } from 'react';

import { copyText } from '../../lib/ipc';
import { choiceName, choiceOf, reserveBase } from '../../share/doran';
import { cleanItems, totalText } from '../../share/order';
import { LIMITS, type OrderItem, type RoomState, reservationAuthor } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, INK, MUTED, MUTED_3 } from '../../theme';
import ItemsEditor from './ItemsEditor';
import { IconPhone, IconX, INPUT_BORDER, btnAccent, btnSoft, whoShort } from './parts';

const AMBER_BG = 'oklch(0.97 0.04 85)';
const AMBER_FG = 'oklch(0.45 0.1 70)';

export default function ReserveModal({
  room,
  me,
  host,
  onClose,
}: {
  room: RoomState;
  me: string;
  host: boolean;
  onClose: () => void;
}) {
  const act = useShare((s) => s.act);
  const r = room.final ? room.restaurants.find((x) => x.id === room.final!.restId) : undefined;
  const v = room.reservation;
  const doran = room.kind === 'doran';
  const choice = doran && room.final?.choiceId ? choiceOf(room, room.final.choiceId) : undefined;
  // 처음 채울 메뉴 — 점심은 모두가 고른 메뉴의 합, 도란식사는 확정된 선택지의 메뉴
  const sumNow = () => reserveBase(room, r);

  // 고치는 중이면 예약 내용으로, 처음이면 모두가 고른 메뉴로 채운다.
  const [rows, setRows] = useState<OrderItem[]>(() => (v ? v.items : sumNow()));
  const [note, setNote] = useState(v?.note ?? '');
  /** 열 때 있던 예약 — 그사이 다른 사람이 예약했는지 알아보는 데 쓴다 */
  const startAt = useRef(v?.at ?? null);

  // 열려 있는 동안 모두에게 '예약하는 중'을 알린다.
  useEffect(() => {
    act({ type: 'reserving', on: true });
    return () => act({ type: 'reserving', on: false });
  }, [act]);

  if (!r) return null;

  // 열어 둔 사이에 다른 사람이 예약했다 — 고칠 수 없는 사람이면 보내지 못하게 막는다.
  const late = v && v.at !== startAt.current && reservationAuthor(v) !== me ? v : null;
  const blocked = !!late && !host && late.by !== me;
  // 고칠 수 없는 사람에게는 '예약 수정'으로 바꿔 보이지 않는다 (위 안내로 알린다).
  const editing = !!v && !blocked;
  const live = rows.filter((it) => it.qty > 0);
  const hasPicks = doran ? !!choice?.items.length : Object.values(room.picks).some((p) => p.items.length);

  const submit = () => {
    if (blocked) return;
    const items = cleanItems(live, r, LIMITS.reserveQty);
    const n = note.trim();
    if (!items.length && !n) {
      toast('예약한 메뉴나 특이사항을 적어 주세요');
      return;
    }
    act({ type: 'reserve', items, note: n });
    toast(editing ? '고친 예약 내용을 모두에게 알렸어요' : '예약 내용을 모두에게 알렸어요');
    onClose();
  };

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
    >
      <div
        role="dialog"
        aria-label="예약하기"
        style={{
          width: 500,
          maxWidth: 'calc(100% - 40px)',
          maxHeight: 'calc(100% - 40px)',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'lp-rise .45s cubic-bezier(.2,.8,.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* 머리 — 식당 · 전화 */}
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
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: AC }}>
              {editing ? '예약 수정' : '예약하기'}
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {choice ? `${r.name} · ${choiceName(choice)}` : r.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconPhone size={14} color={AC} />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 750,
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
                  style={btnSoft(26, 9)}
                >
                  복사
                </button>
              ) : null}
            </div>
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

        {/* 본문 — 예약한 메뉴 · 특이사항 */}
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
          {late ? (
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.5,
                padding: '9px 12px',
                borderRadius: 8,
                background: AMBER_BG,
                color: AMBER_FG,
                fontWeight: 600,
              }}
            >
              {whoShort(room, me, reservationAuthor(late))}님이 방금{' '}
              {late.editedBy ? '예약 내용을 고쳤어요' : '예약을 마쳤어요'}.{' '}
              {blocked
                ? '예약을 고치는 건 예약한 사람과 호스트만 할 수 있어요.'
                : '보내면 그 예약 내용을 고쳐요.'}
            </div>
          ) : null}
          <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
            {/* 채워 둔 내용은 연 때 기준이다 (그사이 다른 사람이 예약했으면 위 안내가 따로 뜬다) */}
            {startAt.current !== null
              ? '지금 예약 내용이에요. 다시 예약한 대로 고친 뒤 알려 주세요.'
              : hasPicks
                ? doran
                  ? '선택지의 메뉴로 채워 뒀어요. 실제로 예약한 대로 고쳐 주세요.'
                  : '모두가 고른 메뉴로 채워 뒀어요. 실제로 예약한 대로 고쳐 주세요.'
                : doran
                  ? '선택지에 정한 메뉴가 없어요. 예약한 메뉴를 담아 주세요.'
                  : '아직 고른 메뉴가 없어요. 예약한 메뉴를 담아 주세요.'}
            {hasPicks ? (
              <span
                role="button"
                tabIndex={0}
                onClick={() => setRows(sumNow())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setRows(sumNow());
                }}
                style={{ marginLeft: 6, color: AC, fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {doran ? '선택지 메뉴로 다시 채우기' : '모두가 고른 메뉴로 다시 채우기'}
              </span>
            ) : null}
          </div>

          <ItemsEditor rows={rows} setRows={setRows} rest={r} maxQty={LIMITS.reserveQty} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.38 0.012 60)' }}>특이사항</span>
            <textarea
              className="tg-input"
              value={note}
              maxLength={LIMITS.reserveNote}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="예: 12:10 도착 · 6명 · 김치찌개 하나는 덜 맵게"
              style={{
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 8,
                padding: '9px 10px',
                font: 'inherit',
                fontSize: 13.5,
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5,
                color: INK,
              }}
            />
          </div>
        </div>

        {/* 아래 — 합계 · 알리기 */}
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
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: live.length ? INK : MUTED_3,
            }}
          >
            {live.length ? `총 ${totalText(live)}` : '메뉴 없음'}
          </span>
          <button type="button" className="tg-soft" onClick={onClose} style={btnSoft(40, 16)}>
            취소
          </button>
          <button
            type="button"
            className={blocked ? '' : 'tg-accent'}
            disabled={blocked}
            onClick={submit}
            style={{
              ...btnAccent(40, 16),
              opacity: blocked ? 0.45 : 1,
              cursor: blocked ? 'default' : 'pointer',
            }}
          >
            {editing ? '고친 내용 알리기' : '예약 완료 · 모두에게 알리기'}
          </button>
        </div>
      </div>
    </div>
  );
}
