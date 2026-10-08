/**
 * 예약 알림 — 누군가 '예약 완료'(또는 예약 수정)를 누르면 나머지 모두의 화면에 뜬다.
 * 예약한 메뉴 × 수량 · 합계 · 특이사항을 보여주고, 내가 고른 메뉴도 한 줄로 같이 보여준다.
 * 닫는 건 각자 한다. 머리의 '오늘은 … · 예약 완료'를 누르면 다시 열린다.
 */
import { copyText } from '../../lib/ipc';
import { hhmm } from '../../lib/util';
import { itemsText, reservationText } from '../../share/order';
import { type RoomState, reservationAuthor } from '../../share/protocol';
import { toast } from '../../store/uiStore';
import { AC, MUTED, OK_FG } from '../../theme';
import { ItemTable, NoteBox } from './OrderPanel';
import { Avatar, IconCheck, IconCopy, INPUT_BORDER, memberOf, whoShort } from './parts';

export default function ReservedModal({
  room,
  me,
  onClose,
}: {
  room: RoomState;
  me: string;
  onClose: () => void;
}) {
  const v = room.reservation;
  const r = v ? room.restaurants.find((x) => x.id === v.restId) : undefined;
  if (!v || !r) return null;
  const author = reservationAuthor(v);
  const mine = room.picks[me]?.items ?? [];
  const who = (id: string) => (id === me ? '내가' : `${whoShort(room, me, id)}님이`);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'oklch(0.22 0.012 60 / .45)',
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
      <div
        role="dialog"
        aria-label="예약 완료"
        style={{
          position: 'relative',
          width: 440,
          maxWidth: '100%',
          maxHeight: '100%',
          background: 'white',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 30px 80px oklch(0.2 0.02 60 / .4)',
          animation: 'lp-rise .6s cubic-bezier(.2,.9,.3,1.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 'none',
            padding: '24px 26px 18px',
            background: 'oklch(0.95 0.04 150)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'oklch(0.55 0.13 150)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'lp-pop .6s .1s cubic-bezier(.2,.9,.3,1.4) both',
            }}
          >
            <IconCheck size={22} stroke={3} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 750, color: OK_FG, letterSpacing: '.04em' }}>
            {v.editedBy ? '예약 내용이 바뀌었어요' : '예약 완료!'}
          </span>
          <span style={{ fontSize: 28, fontWeight: 820, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            {r.name}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: OK_FG }}>
            <Avatar m={memberOf(room, author)} size={20} />
            {v.editedBy
              ? `${who(author)} ${hhmm(v.at)}에 고쳤어요`
              : `${who(v.by)} ${hhmm(v.at)}에 예약했어요`}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '16px 26px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <ItemTable items={v.items} />
          {v.note ? <NoteBox note={v.note} /> : null}
          <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
            내가 고른 메뉴 · {mine.length ? itemsText(mine) : '없음'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              className="tg-soft"
              onClick={() => {
                void copyText(reservationText(room));
                toast('예약 내용을 복사했어요');
              }}
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
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconCopy size={14} />
              내용 복사
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
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
