import { copyText } from '../lib/ipc';
import type { PickItem, Restaurant } from '../lib/types';
import { topMenus, won } from '../lib/util';
import { useData } from '../store/dataStore';
import { useList } from '../store/listStore';
import { usePick } from '../store/pickStore';
import { useShowPrices } from '../store/settingsStore';
import { toast, useUi } from '../store/uiStore';
import { AC, AINK, INK, LINE, MUTED, PANEL_RING, catBg, catFg } from '../theme';

const EMPTY: Restaurant = {
  id: '',
  name: '',
  category: '기타',
  phone: '',
  memo: '',
  fav: false,
  menus: [],
};

export default function PickResult() {
  const restaurants = useData((s) => s.restaurants);
  const results = usePick((s) => s.results);
  const resEnter = usePick((s) => s.resEnter);
  const restart = usePick((s) => s.restart);
  const narrow = usePick((s) => s.narrow);
  const decide = usePick((s) => s.decide);
  const setView = useUi((s) => s.setView);
  const openDetail = useList((s) => s.openDetail);
  const showPrices = useShowPrices();

  const restOf = (it: PickItem) => restaurants.find((r) => r.id === it.restId) ?? EMPTY;
  const copy = (text: string) => {
    if (!text) return;
    void copyText(text);
    toast(`${text} 복사됨`);
  };
  const openInfo = (it: PickItem) => {
    setView('list');
    openDetail(it.restId);
  };

  const enterStyle = {
    opacity: resEnter ? 0 : 1,
    transform: resEnter ? 'translateY(18px) scale(.96)' : 'none',
  };

  if (!results.length) return null;

  if (results.length === 1) {
    const it = results[0];
    const r = restOf(it);
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 28px 28px' }}>
        <div
          style={{
            maxWidth: 560,
            margin: '8px auto 0',
            background: 'white',
            borderRadius: 16,
            boxShadow: `${PANEL_RING}, 0 18px 44px oklch(0.35 0.03 60 / .12)`,
            padding: '30px 32px',
            ...enterStyle,
            transition: 'opacity .5s, transform .6s cubic-bezier(.2,.9,.25,1.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 750, color: AINK }}>오늘의 점심</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 24,
                padding: '0 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 650,
                background: catBg(it.cat),
                color: catFg(it.cat),
              }}
            >
              {it.cat}
            </span>
          </div>

          <div
            style={{ fontSize: 40, fontWeight: 850, letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            {it.title}
          </div>

          {it.reason ? (
            <div style={{ fontSize: 14, color: 'oklch(0.42 0.13 40)', fontWeight: 600 }}>
              {it.reason}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: INK,
              color: 'white',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.75 }}>예약 전화</span>
            <span
              style={{
                flex: 1,
                fontSize: 24,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.phone}
            </span>
            <button
              type="button"
              onClick={() => copy(r.phone)}
              style={{
                height: 32,
                padding: '0 14px',
                border: 'none',
                borderRadius: 7,
                background: 'white',
                color: INK,
                font: 'inherit',
                fontSize: 13,
                fontWeight: 650,
                cursor: 'pointer',
              }}
            >
              번호 복사
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topMenus(r, 3).map((m) => (
              <div
                key={m.id}
                style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14.5 }}
              >
                <span>{m.name}</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1px dotted oklch(0.86 0.006 75)',
                    transform: 'translateY(-3px)',
                  }}
                />
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    color: 'oklch(0.45 0.012 60)',
                  }}
                >
                  {showPrices ? won(m.price) || '—' : ''}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-soft"
              onClick={() => openInfo(it)}
              style={{
                height: 38,
                padding: '0 14px',
                border: '1px solid oklch(0.88 0.006 75)',
                borderRadius: 8,
                background: 'white',
                font: 'inherit',
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              식당 정보
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn-ghost"
              onClick={restart}
              style={{
                height: 38,
                padding: '0 14px',
                border: 'none',
                borderRadius: 8,
                background: 'transparent',
                font: 'inherit',
                fontSize: 13.5,
                color: 'oklch(0.45 0.012 60)',
                cursor: 'pointer',
              }}
            >
              처음부터 다시
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 28px 28px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {results.length}곳으로 추렸어요
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
              마음에 드는 곳을 직접 고르거나, 이 후보로 한 번 더 줄여보세요.
            </div>
          </div>
          <button
            type="button"
            onClick={narrow}
            style={{
              height: 38,
              padding: '0 16px',
              border: 'none',
              borderRadius: 8,
              background: INK,
              color: 'white',
              font: 'inherit',
              fontSize: 13.5,
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            이 후보로 다시 줄이기
          </button>
          <button
            type="button"
            className="btn-soft"
            onClick={restart}
            style={{
              height: 38,
              padding: '0 14px',
              border: '1px solid oklch(0.88 0.006 75)',
              borderRadius: 8,
              background: 'white',
              font: 'inherit',
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            처음부터
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
            gap: 12,
          }}
        >
          {results.map((it, i) => {
            const r = restOf(it);
            const menuLine =
              topMenus(r, 3)
                .map((m) => m.name + (m.price != null ? ` ${won(m.price)}` : ''))
                .join(' · ') || '메뉴 미등록';
            return (
              <div
                key={it.key}
                style={{
                  background: 'white',
                  borderRadius: 14,
                  boxShadow: `${PANEL_RING}, 0 10px 26px oklch(0.35 0.03 60 / .07)`,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  ...enterStyle,
                  transition: 'opacity .45s, transform .55s cubic-bezier(.2,.9,.25,1.25)',
                  transitionDelay: `${i * 90}ms`,
                }}
              >
                <span
                  style={{
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 22,
                    padding: '0 9px',
                    borderRadius: 11,
                    fontSize: 11.5,
                    fontWeight: 650,
                    background: catBg(it.cat),
                    color: catFg(it.cat),
                  }}
                >
                  {it.cat}
                </span>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {it.title}
                </div>
                {it.reason ? (
                  <div
                    style={{ fontSize: 12.5, color: 'oklch(0.42 0.13 40)', fontWeight: 600 }}
                  >
                    {it.reason}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: 13.5,
                    color: 'oklch(0.42 0.012 60)',
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {menuLine}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    fontWeight: 650,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {r.phone}
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={() => copy(r.phone)}
                    style={{
                      height: 24,
                      padding: '0 8px',
                      border: `1px solid ${LINE}`,
                      borderRadius: 5,
                      background: 'white',
                      font: 'inherit',
                      fontSize: 11.5,
                      cursor: 'pointer',
                    }}
                  >
                    복사
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-accent"
                  onClick={() => decide(it)}
                  style={{
                    height: 36,
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
                  여기로 결정
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
