/**
 * 저장한 식당 불러오기 — 내 PC 의 식당 보관함(식당마다 파일 하나)에서 몇 곳만 골라 방에 올린다.
 * 이미 방에 있는 식당(같은 식당·같은 이름)은 고를 수 없다. 더 쓰지 않는 식당은 보관함에서 지운다.
 */
import { useEffect, useMemo, useState } from 'react';

import { nameKey } from '../../lib/shareFormat';
import { priceRange } from '../../share/doran';
import { LIMITS, type RoomState } from '../../share/protocol';
import { useDoran } from '../../store/doranStore';
import { useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { AC, CH, MUTED, MUTED_3 } from '../../theme';
import { btnAccent, btnSoft, IconCheck, IconX, INPUT_BORDER, Spinner } from '../together/parts';
import { fieldStyle, Modal } from './ui';

const dateText = (t: number) => {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

export default function DoranLibraryModal({ room, onClose }: { room: RoomState; onClose: () => void }) {
  const act = useShare((s) => s.act);
  const entries = useDoran((s) => s.entries);
  const loading = useDoran((s) => s.loading);
  const loaded = useDoran((s) => s.loaded);
  const load = useDoran((s) => s.load);
  const forget = useDoran((s) => s.forget);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<string[]>([]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // 열 때마다 디스크에서 다시 읽는다 (다른 방에서 저장한 식당도 보이게).
  useEffect(() => {
    void load(true);
  }, [load]);

  const inRoom = useMemo(() => {
    const ids = new Set(room.restaurants.map((r) => r.id));
    const names = new Set(room.restaurants.map((r) => nameKey(r.name)));
    return (id: string, name: string) => ids.has(id) || names.has(nameKey(name));
  }, [room.restaurants]);

  const room0 = LIMITS.doranRests - room.restaurants.length;
  const shown = entries.filter((e) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    const r = e.restaurant;
    return (
      r.name.toLowerCase().includes(t) ||
      r.category.includes(t) ||
      r.menus.some((m) => m.name.toLowerCase().includes(t))
    );
  });
  const picked = entries.filter(
    (e) => pick.includes(e.restaurant.id) && !inRoom(e.restaurant.id, e.restaurant.name),
  );

  const toggle = (id: string) =>
    setPick((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= room0) {
        toast(`방에는 식당을 ${LIMITS.doranRests}곳까지 올릴 수 있어요`);
        return p;
      }
      return [...p, id];
    });

  const submit = () => {
    if (!picked.length) return;
    act({ type: 'dRestLoad', restaurants: picked.map((e) => e.restaurant) });
    toast(`식당 ${picked.length}곳을 불러왔어요`);
    onClose();
  };

  return (
    <Modal
      kicker="내 PC의 식당 보관함"
      title="저장한 식당 불러오기"
      sub="도란식사 방에 올라왔던 식당은 각자 PC에 저장돼요. 이번에 쓸 식당만 골라 올려요."
      width={560}
      onClose={onClose}
      foot={
        <>
          <span style={{ flex: 1, fontSize: 12.5, color: MUTED }}>
            {entries.length ? `보관함 ${entries.length}곳 · ${picked.length}곳 고름` : ''}
          </span>
          <button type="button" className="tg-soft" onClick={onClose} style={btnSoft(40, 14)}>
            취소
          </button>
          <button
            type="button"
            className={picked.length ? 'tg-accent' : ''}
            disabled={!picked.length}
            onClick={submit}
            style={{ ...btnAccent(40, 16), opacity: picked.length ? 1 : 0.45 }}
          >
            {picked.length ? `${picked.length}곳 불러오기` : '불러올 식당을 골라요'}
          </button>
        </>
      }
    >
      <input
        className="tg-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="식당·메뉴 이름으로 찾기"
        style={fieldStyle('100%')}
      />
      {!loaded && loading ? (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MUTED, padding: 8 }}
        >
          <Spinner size={13} /> 보관함을 읽는 중…
        </div>
      ) : !entries.length ? (
        <div
          style={{
            border: '1.5px dashed oklch(0.86 0.01 60)',
            borderRadius: 10,
            padding: '20px 14px',
            fontSize: 12.5,
            color: MUTED,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          아직 저장한 식당이 없어요.
          <br />
          도란식사 방에 식당을 올리면 여기에 저절로 쌓여요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map(({ restaurant: r, savedAt }) => {
            const there = inRoom(r.id, r.name);
            const on = pick.includes(r.id) && !there;
            const del = confirmDel === r.id;
            return (
              <div
                key={r.id}
                role="checkbox"
                aria-checked={on}
                aria-disabled={there}
                tabIndex={there ? -1 : 0}
                onClick={() => !there && toggle(r.id)}
                onKeyDown={(e) => {
                  if (!there && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    toggle(r.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 8px 9px 12px',
                  borderRadius: 10,
                  cursor: there ? 'default' : 'pointer',
                  background: on ? 'oklch(0.985 0.014 50)' : 'white',
                  boxShadow: on ? `inset 0 0 0 1.5px ${AC}` : `inset 0 0 0 1px ${INPUT_BORDER}`,
                  opacity: there ? 0.55 : 1,
                  transition: 'background .2s, box-shadow .2s',
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    flex: 'none',
                    background: on ? AC : 'white',
                    boxShadow: on ? 'none' : 'inset 0 0 0 1.5px oklch(0.8 0.01 60)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? <IconCheck size={11} stroke={3} /> : null}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: `oklch(0.62 0.15 ${CH[r.category] ?? 300})`,
                        flex: 'none',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.name}
                    </span>
                    {there ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: MUTED_3, flex: 'none' }}>
                        방에 있음
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: MUTED,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {[
                      r.category,
                      r.menus.length ? `메뉴 ${r.menus.length}개` : '메뉴 없음',
                      priceRange(r),
                      dateText(savedAt) ? `${dateText(savedAt)} 저장` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="tg-danger"
                  title="보관함에서 지우기 (방에 올라간 식당은 그대로예요)"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!del) {
                      setConfirmDel(r.id);
                      return;
                    }
                    setConfirmDel(null);
                    setPick((p) => p.filter((x) => x !== r.id));
                    void forget(r.id);
                  }}
                  onBlur={() => setConfirmDel((c) => (c === r.id ? null : c))}
                  style={{
                    height: 28,
                    padding: del ? '0 10px' : 0,
                    width: del ? undefined : 28,
                    border: 'none',
                    borderRadius: 7,
                    background: del ? 'oklch(0.55 0.19 25)' : 'transparent',
                    color: del ? 'white' : 'oklch(0.5 0.17 25)',
                    font: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  {del ? '지우기' : <IconX size={12} />}
                </button>
              </div>
            );
          })}
          {!shown.length ? (
            <div style={{ fontSize: 12.5, color: MUTED_3, padding: '6px 2px' }}>
              ‘{q.trim()}’ 와 맞는 식당이 없어요
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
