import { useMemo } from 'react';

import Chip from '../components/Chip';
import Seg from '../components/Seg';
import { copyText } from '../lib/ipc';
import type { Restaurant } from '../lib/types';
import { agoText, daysAgo, lastAt, topMenus, won } from '../lib/util';
import { useData } from '../store/dataStore';
import { useList } from '../store/listStore';
import { usePreview, useShowPrices } from '../store/settingsStore';
import { toast } from '../store/uiStore';
import {
  AC,
  CARD_RING,
  CATS,
  HAIRLINE,
  INK,
  LINE,
  MUTED,
  MUTED_2,
  MUTED_3,
  SOFT,
  STAR,
  catDot,
  catFg,
} from '../theme';
import ListDrawer from './ListDrawer';

const TABLE_COLS = '28px minmax(140px,1.3fr) 80px 130px minmax(200px,3fr)';

export default function ListScreen() {
  const restaurants = useData((s) => s.restaurants);
  const history = useData((s) => s.history);
  const updateRest = useData((s) => s.updateRest);

  const search = useList((s) => s.search);
  const setSearch = useList((s) => s.setSearch);
  const sort = useList((s) => s.sort);
  const setSort = useList((s) => s.setSort);
  const listMode = useList((s) => s.listMode);
  const setListMode = useList((s) => s.setListMode);
  const cat = useList((s) => s.cat);
  const setCat = useList((s) => s.setCat);
  const selId = useList((s) => s.selId);
  const openDetail = useList((s) => s.openDetail);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/-/g, '');
    const match = (r: Restaurant) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      (!!qd && r.phone.replace(/-/g, '').includes(qd)) ||
      r.menus.some((m) => m.name.toLowerCase().includes(q));
    const inCat = (r: Restaurant) =>
      cat === '전체' || (cat === '★' ? r.fav : r.category === cat);
    const list = restaurants.filter((r) => inCat(r) && match(r));
    return sort === 'name'
      ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      : list;
  }, [restaurants, search, cat, sort]);

  const q = search.trim();
  const subText = `${filtered.length}곳${
    cat !== '전체' || q ? ` / 전체 ${restaurants.length}곳` : ''
  } · 카드를 누르면 메뉴를 관리할 수 있어요`;

  const groups = useMemo(() => {
    if (sort !== 'cat') {
      return filtered.length
        ? [{ hasTitle: false, title: '', dot: '', count: 0, cards: filtered }]
        : [];
    }
    const favs = cat === '전체' ? filtered.filter((r) => r.fav) : [];
    const favSet = new Set(favs);
    const rest = filtered.filter((r) => !favSet.has(r));
    const out: { hasTitle: boolean; title: string; dot: string; count: number; cards: Restaurant[] }[] =
      [];
    if (favs.length) {
      out.push({ hasTitle: true, title: '자주 가는 곳', dot: STAR, count: favs.length, cards: favs });
    }
    for (const c of CATS) {
      const l = rest.filter((r) => r.category === c);
      if (l.length) out.push({ hasTitle: true, title: c, dot: catDot(c), count: l.length, cards: l });
    }
    return out;
  }, [filtered, sort, cat]);

  const padR = selId ? 428 : 28;
  const toggleFav = (r: Restaurant) => updateRest(r.id, (x) => ({ ...x, fav: !x.fav }));
  const copyPhone = (phone: string) => {
    void copyText(phone);
    toast(`${phone} 복사됨`);
  };

  const catChips = [
    { label: '전체', value: '전체', dot: 'oklch(0.7 0.01 60)', count: restaurants.length },
    {
      label: '자주 가는 곳',
      value: '★',
      dot: STAR,
      count: restaurants.filter((r) => r.fav).length,
    },
    ...CATS.map((c) => ({
      label: c,
      value: c as string,
      dot: catDot(c),
      count: restaurants.filter((r) => r.category === c).length,
    })),
  ];

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '22px 28px 14px',
          paddingRight: padR,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          flex: 'none',
          transition: 'padding .32s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em' }}>식당 목록</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{subText}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="inp-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="식당·메뉴·전화번호 검색"
              style={{
                height: 34,
                width: 230,
                border: '1px solid oklch(0.88 0.006 75)',
                borderRadius: 7,
                padding: '0 12px',
                font: 'inherit',
                fontSize: 13.5,
                background: 'white',
                outline: 'none',
                color: INK,
              }}
            />
            <Seg
              options={[
                { value: 'cat', label: '분류별' },
                { value: 'name', label: '가나다' },
              ]}
              value={sort}
              onChange={setSort}
            />
            <Seg
              options={[
                { value: 'card', label: '카드' },
                { value: 'table', label: '표' },
              ]}
              value={listMode}
              onChange={setListMode}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {catChips.map((c) => {
            const on = cat === c.value;
            return (
              <Chip
                key={c.value}
                label={c.label}
                count={String(c.count)}
                dot={c.dot}
                onClick={() => setCat(c.value)}
                bg={on ? INK : 'white'}
                color={on ? 'white' : 'oklch(0.32 0.012 60)'}
                border={on ? INK : LINE}
                weight={on ? 650 : 500}
              />
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '4px 28px 32px',
          paddingRight: padR,
          transition: 'padding .32s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {!filtered.length ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: MUTED, fontSize: 14 }}>
            조건에 맞는 식당이 없어요.
          </div>
        ) : listMode === 'card' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {groups.map((gr, gi) => (
              <div key={gr.title || gi} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {gr.hasTitle ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{ width: 10, height: 10, borderRadius: 3, background: gr.dot }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 750 }}>{gr.title}</span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: MUTED_2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {gr.count}
                    </span>
                    <div style={{ flex: 1, height: 1, background: HAIRLINE }} />
                  </div>
                ) : null}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
                    gap: 12,
                  }}
                >
                  {gr.cards.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      r={r}
                      selected={selId === r.id}
                      eaten={agoText(daysAgo(lastAt(history, r.id)))}
                      recent={(daysAgo(lastAt(history, r.id)) ?? 99) <= 3}
                      onOpen={() => openDetail(r.id)}
                      onFav={() => toggleFav(r)}
                      onCopy={() => copyPhone(r.phone)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: 'white',
              borderRadius: 10,
              boxShadow: `0 0 0 1px ${HAIRLINE}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: TABLE_COLS,
                gap: 12,
                alignItems: 'center',
                padding: '0 16px',
                height: 38,
                background: 'oklch(0.965 0.004 75)',
                fontSize: 12,
                fontWeight: 650,
                color: MUTED,
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              <span />
              <span>식당</span>
              <span>분류</span>
              <span>전화번호</span>
              <span>대표 메뉴</span>
            </div>
            {filtered.map((r) => (
              <TableRow
                key={r.id}
                r={r}
                selected={selId === r.id}
                onOpen={() => openDetail(r.id)}
                onFav={() => toggleFav(r)}
                onCopy={() => copyPhone(r.phone)}
              />
            ))}
          </div>
        )}
      </div>

      <ListDrawer />
    </div>
  );
}

// ---------------------------------------------------------------- 카드

type CardProps = {
  r: Restaurant;
  selected: boolean;
  eaten: string;
  recent: boolean;
  onOpen: () => void;
  onFav: () => void;
  onCopy: () => void;
};

function RestaurantCard({ r, selected, eaten, recent, onOpen, onFav, onCopy }: CardProps) {
  const preview = usePreview();
  const showPrices = useShowPrices();
  const tm = topMenus(r, preview);
  return (
    <div
      className="card-lift"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      style={{
        position: 'relative',
        background: 'white',
        borderRadius: 10,
        padding: '14px 14px 12px 17px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        boxShadow: selected ? `0 0 0 2px ${AC}` : CARD_RING,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: catDot(r.category),
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 720,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {r.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minHeight: 22 }}>
            <span
              style={{
                fontSize: 13.5,
                fontVariantNumeric: 'tabular-nums',
                color: r.phone ? 'oklch(0.36 0.012 60)' : MUTED_3,
              }}
            >
              {r.phone || '번호 없음'}
            </span>
            {r.phone ? (
              <button
                type="button"
                className="btn-soft"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
                }}
                style={{
                  height: 22,
                  padding: '0 7px',
                  border: `1px solid ${LINE}`,
                  borderRadius: 5,
                  background: 'white',
                  font: 'inherit',
                  fontSize: 11.5,
                  color: 'oklch(0.45 0.012 60)',
                  cursor: 'pointer',
                }}
              >
                복사
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          title="자주 가는 곳"
          onClick={(e) => {
            e.stopPropagation();
            onFav();
          }}
          style={{
            width: 28,
            height: 28,
            margin: '-4px -4px 0 0',
            border: 'none',
            background: 'transparent',
            fontSize: 17,
            color: r.fav ? STAR : 'oklch(0.78 0.01 60)',
            cursor: 'pointer',
          }}
        >
          {r.fav ? '★' : '☆'}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          borderTop: `1px dashed ${LINE}`,
          paddingTop: 9,
        }}
      >
        {tm.length ? (
          tm.map((m) => (
            <div
              key={m.id}
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13.5 }}
            >
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: m.fav ? 600 : 450,
                }}
              >
                {m.name}
              </span>
              <span
                style={{
                  flex: 1,
                  borderBottom: '1px dotted oklch(0.86 0.006 75)',
                  transform: 'translateY(-3px)',
                  minWidth: 10,
                }}
              />
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: 'oklch(0.45 0.012 60)',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                {showPrices ? won(m.price) || '—' : ''}
              </span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: MUTED_3 }}>등록된 메뉴 없음</div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: MUTED_2,
          minHeight: 16,
          gap: 8,
        }}
      >
        <span>{r.menus.length > preview ? `외 ${r.menus.length - preview}개 메뉴` : ''}</span>
        <span
          style={{
            color: recent && eaten ? 'oklch(0.45 0.14 40)' : MUTED_2,
            fontWeight: recent && eaten ? 650 : 450,
            whiteSpace: 'nowrap',
          }}
        >
          {eaten}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 표 행

type RowProps = {
  r: Restaurant;
  selected: boolean;
  onOpen: () => void;
  onFav: () => void;
  onCopy: () => void;
};

function TableRow({ r, selected, onOpen, onFav, onCopy }: RowProps) {
  const preview = usePreview();
  const showPrices = useShowPrices();
  const tm = topMenus(r, preview);
  const menuLine =
    tm
      .map((m) => m.name + (showPrices && m.price != null ? ` ${won(m.price)}` : ''))
      .join('  ·  ') || '—';
  return (
    <div
      className="row-hover"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        gap: 12,
        alignItems: 'center',
        padding: '0 16px',
        minHeight: 44,
        borderTop: '1px solid oklch(0.94 0.005 75)',
        cursor: 'pointer',
        background: selected ? SOFT : 'white',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFav();
        }}
        style={{
          width: 24,
          height: 24,
          border: 'none',
          background: 'transparent',
          fontSize: 15,
          color: r.fav ? STAR : 'oklch(0.78 0.01 60)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {r.fav ? '★' : '☆'}
      </button>
      <span
        style={{
          fontWeight: 680,
          fontSize: 14,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {r.name}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12.5,
          color: catFg(r.category),
        }}
      >
        <span
          style={{ width: 7, height: 7, borderRadius: '50%', background: catDot(r.category) }}
        />
        {r.category}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          color: r.phone ? undefined : MUTED_3,
        }}
      >
        {r.phone || '번호 없음'}
        {r.phone ? (
          <button
            type="button"
            className="btn-soft"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            style={{
              height: 20,
              padding: '0 6px',
              border: `1px solid ${LINE}`,
              borderRadius: 4,
              background: 'white',
              font: 'inherit',
              fontSize: 11,
              color: 'oklch(0.45 0.012 60)',
              cursor: 'pointer',
            }}
          >
            복사
          </button>
        ) : null}
      </span>
      <span
        style={{
          fontSize: 13,
          color: 'oklch(0.38 0.012 60)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {menuLine}
      </span>
    </div>
  );
}
