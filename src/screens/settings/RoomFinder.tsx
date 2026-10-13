/**
 * 설정 → 호스트에 접속 › 방 찾기. 한 번이라도 들어간 방을 기억해 두고, 지금 열려 있는지 확인해
 * 바로 입장하거나 더 쓰지 않는 주소를 지운다. 확인은 들어가지 않고 묻기만 한다(share/client.ts › probeRoom).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { daysAgo } from '../../lib/util';
import type { RecentHost } from '../../lib/types';
import { probeRoom, type RoomProbe } from '../../share/client';
import { PROTOCOL, shortName } from '../../share/protocol';
import { useSettings } from '../../store/settingsStore';
import { parseAddr, useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { MUTED, MUTED_3 } from '../../theme';
import { btnAccent, btnSoft, IconSync, IconX, INPUT_BORDER, Spinner, StatusDot } from '../together/parts';

/** 보고 있는 동안 다시 확인하는 간격 */
const REFRESH_MS = 20000;

const OPEN_FG = 'oklch(0.4 0.1 150)';
const WARN_FG = 'oklch(0.48 0.1 70)';

const lastText = (at?: number) => {
  if (!at) return '';
  const d = daysAgo(at);
  if (d === null) return '';
  if (d <= 0) return '오늘 들어감';
  if (d === 1) return '어제 들어감';
  const t = new Date(at);
  return d < 7 ? `${d}일 전 들어감` : `${t.getMonth() + 1}/${t.getDate()} 들어감`;
};

export default function RoomFinder() {
  const recents = useSettings((s) => s.recentHosts);
  const patch = useSettings((s) => s.patch);
  const join = useShare((s) => s.join);
  const clearError = useShare((s) => s.clearError);
  const removeRecent = useShare((s) => s.removeRecent);
  const [probes, setProbes] = useState<Record<string, RoomProbe>>({});
  /** [다시 찾기] 를 눌러 확인 중인 수 — 버튼에 Spinner 를 돌린다 */
  const [busy, setBusy] = useState(0);
  const alive = useRef(true);
  const known = useRef(new Set<string>());

  const check = useCallback((addrs: string[], loud: boolean) => {
    if (!addrs.length) return;
    addrs.forEach((a) => known.current.add(a));
    if (loud) setBusy((n) => n + 1);
    void Promise.all(
      addrs.map(async (a) => {
        const t = parseAddr(a);
        const r: RoomProbe = t ? await probeRoom(t.host, t.port) : { open: false };
        if (alive.current) setProbes((p) => ({ ...p, [a]: r }));
      }),
    ).finally(() => {
      if (loud && alive.current) setBusy((n) => n - 1);
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 처음 보일 때와 새 주소가 생겼을 때 확인한다.
  const addrKey = recents.map((r) => r.addr).join('|');
  useEffect(() => {
    check(
      addrKey.split('|').filter((a) => a && !known.current.has(a)),
      false,
    );
  }, [addrKey, check]);

  // 보고 있는 동안에는 가끔 다시 확인한다 (호스트가 서버를 켜기를 기다리는 동안).
  useEffect(() => {
    const iv = setInterval(() => {
      const all = useSettings.getState().recentHosts.map((r) => r.addr);
      check(all, false);
    }, REFRESH_MS);
    return () => clearInterval(iv);
  }, [check]);

  const pick = (addr: string) => {
    clearError();
    patch({ joinAddr: addr });
  };

  const remove = (r: RecentHost) => {
    removeRecent(r.addr);
    known.current.delete(r.addr);
    toast(`${r.addr} 을(를) 방 찾기에서 지웠어요`);
  };

  if (!recents.length)
    return <span style={{ fontSize: 12.5, color: MUTED_3 }}>아직 없어요. 한 번 접속하면 여기에 남아요.</span>;

  const openCount = recents.filter((r) => probes[r.addr]?.open).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45, flex: '1 1 220px' }}>
          한 번 들어간 방을 기억해 두고 지금 열려 있는지 확인해요
          {openCount ? ` · 열린 방 ${openCount}곳` : ''}
        </span>
        <button
          type="button"
          className="tg-soft"
          disabled={busy > 0}
          onClick={() =>
            check(
              recents.map((r) => r.addr),
              true,
            )
          }
          style={{ ...btnSoft(28, 10), fontSize: 12, borderRadius: 7, opacity: busy ? 0.75 : 1 }}
        >
          {busy ? <Spinner size={12} /> : <IconSync size={13} />}
          다시 찾기
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recents.map((r) => (
          <RoomRow
            key={r.addr}
            r={r}
            probe={probes[r.addr]}
            onPick={() => pick(r.addr)}
            onJoin={() => {
              // 접속하지 못하면 그 주소 옆에 이유가 뜨도록 주소 칸도 채운다.
              pick(r.addr);
              void join(r.addr);
            }}
            onRemove={() => remove(r)}
          />
        ))}
      </div>
    </div>
  );
}

function RoomRow({
  r,
  probe,
  onPick,
  onJoin,
  onRemove,
}: {
  r: RecentHost;
  probe: RoomProbe | undefined;
  onPick: () => void;
  onJoin: () => void;
  onRemove: () => void;
}) {
  const open = probe?.open === true;
  const info = probe && probe.open ? probe : null;
  const oldVer = !!info && info.v !== undefined && info.v !== PROTOCOL;
  const name = info?.host ? shortName(info.host) : r.name;
  const last = lastText(r.at);

  const status = !probe
    ? { text: '확인 중…', fg: MUTED }
    : !open
      ? { text: '닫혀 있어요', fg: MUTED_3 }
      : oldVer
        ? { text: '점심픽 버전이 달라요', fg: WARN_FG }
        : { text: info?.online ? `${info.online}명 접속 중` : '열려 있어요', fg: OPEN_FG };

  return (
    <div
      role="button"
      tabIndex={0}
      title="주소 칸에 넣기"
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onPick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        padding: '6px 8px 6px 12px',
        borderRadius: 9,
        cursor: 'pointer',
        background: open && !oldVer ? 'oklch(0.985 0.012 150)' : 'white',
        boxShadow: `inset 0 0 0 1px ${open && !oldVer ? 'oklch(0.88 0.05 150)' : INPUT_BORDER}`,
        transition: 'background .3s, box-shadow .3s',
        animation: 'lp-in .3s ease-out both',
      }}
    >
      {!probe ? (
        <Spinner size={10} color={MUTED_3} />
      ) : (
        <StatusDot tone={open ? (oldVer ? 'wait' : 'live') : 'off'} size={9} />
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 680,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name ? `${name}님의 ${info?.kind === 'doran' ? '도란식사 ' : ''}방` : r.addr}
        </span>
        <span
          style={{
            fontSize: 11.5,
            color: MUTED_3,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name ? r.addr : ''}
          {name && last ? ' · ' : ''}
          {last}
        </span>
      </div>
      <span
        key={status.text}
        style={{
          fontSize: 12,
          fontWeight: 650,
          color: status.fg,
          whiteSpace: 'nowrap',
          flex: 'none',
          animation: 'lp-in .25s ease-out',
        }}
      >
        {status.text}
      </span>
      <button
        type="button"
        className={open && !oldVer ? 'tg-accent' : ''}
        disabled={!open || oldVer}
        title={
          open
            ? oldVer
              ? '호스트와 같은 버전으로 맞춰야 들어갈 수 있어요'
              : '바로 들어가기'
            : '열려 있을 때 들어갈 수 있어요'
        }
        onClick={(e) => {
          e.stopPropagation();
          onJoin();
        }}
        style={{
          ...btnAccent(30, 13),
          fontSize: 12.5,
          borderRadius: 7,
          ...(open && !oldVer
            ? {}
            : { background: 'oklch(0.93 0.005 75)', color: MUTED_3, cursor: 'default' }),
        }}
      >
        입장
      </button>
      <button
        type="button"
        className="tg-danger"
        title="방 찾기에서 지우기"
        aria-label={`${r.addr} 지우기`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          width: 28,
          height: 28,
          border: 'none',
          borderRadius: 7,
          background: 'transparent',
          color: 'oklch(0.55 0.012 60)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <IconX size={13} />
      </button>
    </div>
  );
}
