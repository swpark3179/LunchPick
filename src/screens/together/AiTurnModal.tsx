/**
 * AI 큐 칩을 누르면 뜨는 팝업 — 그 요청이 매긴 1~5위를 다시 보고, 요청 하나만 지울 수 있다.
 * 원문은 보낸 사람 화면에서만 보인다. 다른 사람이 그 요청을 지우면 저절로 닫힌다.
 */
import { useEffect } from 'react';

import { hhmm } from '../../lib/util';
import type { RoomState } from '../../share/protocol';
import { useShare } from '../../store/shareStore';
import { AINK, CH, DANGER, MUTED, MUTED_3, SOFT } from '../../theme';
import { aiTurnText, myPromptOf } from './Board';
import { Avatar, IconX, btnAccent, btnSoft, memberOf, whoShort } from './parts';

export default function AiTurnModal({
  room,
  me,
  turnId,
  onClose,
}: {
  room: RoomState;
  me: string;
  turnId: string;
  onClose: () => void;
}) {
  const act = useShare((s) => s.act);
  const t = room.ai.find((x) => x.id === turnId);

  useEffect(() => {
    if (!t) onClose();
  }, [t, onClose]);
  if (!t) return null;

  const m = memberOf(room, t.by);
  const pending = room.ai.filter((x) => x.status === 'queued' || x.status === 'running');
  const { kw, st } = aiTurnText(
    t,
    pending.findIndex((p) => p.id === t.id),
  );
  const raw = t.by === me ? myPromptOf(t.ref) : undefined;
  const done = t.status === 'done';
  const waiting = t.status === 'queued' || t.status === 'running';
  const title = done && t.no ? `AI 정렬 ${t.no}차` : waiting ? 'AI 정렬 요청' : 'AI 정렬';
  const top = t.top ?? [];

  const remove = () => {
    act({ type: 'aiRemove', id: t.id });
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={`${title} 결과`}
        style={{
          width: 420,
          maxWidth: 'calc(100% - 40px)',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'lp-rise .45s cubic-bezier(.2,.8,.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* 머리 — 누가 · 언제 · 키워드 · 결과 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '18px 14px 14px 20px' }}>
          <Avatar m={m} size={32} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 780, letterSpacing: '-0.01em' }}>{title}</span>
              <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                {whoShort(room, me, t.by)} · {hhmm(t.at)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
              <span style={{ fontWeight: 700, color: t.keywords.length ? AINK : MUTED_3 }}>{kw}</span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 650,
                  color: done ? 'oklch(0.45 0.1 150)' : waiting ? AINK : MUTED_3,
                }}
              >
                {st}
              </span>
            </div>
            {raw ? (
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                내 원문(나만 보임) · {raw}
              </div>
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

        {/* 본문 — 1~5위 */}
        <div
          style={{
            padding: '4px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderTop: '1px solid oklch(0.94 0.005 75)',
          }}
        >
          {done && top.length ? (
            top.map((e, i) => {
              const r = room.restaurants.find((x) => x.id === e.id);
              const now = !r
                ? ['지워진 식당', 'oklch(0.955 0.005 75)', MUTED]
                : room.final?.restId === e.id
                  ? ['확정', 'oklch(0.95 0.04 150)', 'oklch(0.4 0.1 150)']
                  : room.dislikes[e.id]?.length
                    ? ['가기 싫은 곳', 'oklch(0.95 0.03 25)', 'oklch(0.48 0.15 25)']
                    : room.cands[e.id]
                      ? ['후보', SOFT, AINK]
                      : null;
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '10px 0',
                    borderBottom: i < top.length - 1 ? '1px solid oklch(0.95 0.005 75)' : 'none',
                    opacity: r ? 1 : 0.55,
                    animation: `lp-in .3s ${i * 0.05}s ease-out both`,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: i === 0 ? 'oklch(0.56 0.16 40)' : SOFT,
                      color: i === 0 ? 'white' : AINK,
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {r ? (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: `oklch(0.62 0.15 ${CH[r.category] ?? 300})`,
                            flex: 'none',
                          }}
                        />
                      ) : null}
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 720,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textDecoration: r ? 'none' : 'line-through',
                        }}
                      >
                        {r?.name ?? e.name}
                      </span>
                      {r ? (
                        <span style={{ fontSize: 11.5, color: MUTED_3, flex: 'none' }}>{r.category}</span>
                      ) : null}
                    </div>
                    {e.why ? (
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{e.why}</div>
                    ) : null}
                  </div>
                  {now ? (
                    <span
                      style={{
                        height: 20,
                        padding: '0 7px',
                        borderRadius: 6,
                        background: now[1],
                        color: now[2],
                        fontSize: 11,
                        fontWeight: 750,
                        display: 'flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                        flex: 'none',
                      }}
                    >
                      {now[0]}
                    </span>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, padding: '14px 0 4px' }}>
              {waiting
                ? '정렬이 끝나면 이 요청의 1~5위가 여기에 보여요.'
                : t.note || (done ? '이 요청으로 매긴 순위가 없어요.' : '이 요청은 정렬하지 못했어요.')}
            </div>
          )}
          {done && top.length > 0 && t.note ? (
            <div style={{ fontSize: 11.5, color: MUTED_3, lineHeight: 1.45, paddingTop: 8 }}>{t.note}</div>
          ) : null}
        </div>

        {/* 아래 — 지우기 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px 16px',
            borderTop: '1px solid oklch(0.94 0.005 75)',
            background: 'oklch(0.985 0.003 75)',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: MUTED, lineHeight: 1.45 }}>
            {done
              ? '지우면 다음 AI 정렬에서 빠지고, 마지막 정렬이었다면 그 전 순서로 돌아가요.'
              : waiting
                ? '취소하면 이 요청은 정렬에 반영되지 않아요.'
                : '큐에서 이 요청을 지워요.'}
          </span>
          <button
            type="button"
            className="tg-danger"
            onClick={remove}
            style={{ ...btnSoft(34, 12), color: DANGER }}
          >
            {waiting ? '요청 취소' : '이 요청 지우기'}
          </button>
          <button type="button" className="tg-accent" onClick={onClose} style={btnAccent(34, 14)}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
