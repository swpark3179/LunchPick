/**
 * 설정 → 실시간 공유 서버. 호스트로 서버를 열거나, 다른 PC 의 서버에 참여한다.
 * 내 이름·색은 같이 고르기에서 다른 사람에게 보이는 모습이다.
 */
import { useEffect, useRef, useState } from 'react';

import Toggle from '../../components/Toggle';
import { copyText } from '../../lib/ipc';
import type { ShareMode } from '../../lib/types';
import { AVATAR_HUES, cleanName } from '../../share/protocol';
import { type HostInfo, localInfo } from '../../share/transport';
import { useSettings } from '../../store/settingsStore';
import { parsePort, useShare } from '../../store/shareStore';
import { toast } from '../../store/uiStore';
import { DANGER, INK, MUTED, MUTED_2, OK_FG, PANEL_RING, SEG_TRACK } from '../../theme';
import {
  Avatar,
  AvatarStack,
  Dots,
  IconCopy,
  IconUsers,
  IconWifi,
  INPUT_BORDER,
  Spinner,
  avatarBg,
  btn,
  btnClass,
  useBumpKey,
} from '../together/parts';

const rowLabel: React.CSSProperties = { fontSize: 13, fontWeight: 650, color: 'oklch(0.38 0.012 60)' };
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px minmax(0,1fr)',
  gap: '14px 16px',
  alignItems: 'center',
};
const input: React.CSSProperties = {
  height: 36,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 7,
  padding: '0 10px',
  font: 'inherit',
  fontSize: 14,
  outline: 'none',
  background: 'white',
  color: INK,
};

const LIVE_BG = 'oklch(0.975 0.02 150)';
const LIVE_RING = '0 0 0 1px oklch(0.88 0.05 150)';
const LIVE_DOT = 'oklch(0.62 0.15 150)';
const WAIT_DOT = 'oklch(0.72 0.14 75)';

/** "192.168.0.12:8787" 처럼 붙여 넣어도 주소와 포트를 나눠 준다. */
function splitHostPort(raw: string): { host: string; port: string | null } {
  const t = raw
    .trim()
    .replace(/^(wss?|https?):\/\//, '')
    .replace(/\/+$/, '');
  const m = /^([^:[\]]+|\[[^\]]+\]):(\d{2,5})$/.exec(t);
  return m ? { host: m[1], port: m[2] } : { host: t, port: null };
}

export default function ShareCard() {
  const s = useSettings();
  const sh = useShare();
  const [preview, setPreview] = useState<HostInfo | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [localErr, setLocalErr] = useState('');

  const active = sh.role !== 'none';
  const mode: ShareMode = sh.role === 'host' ? 'host' : sh.role === 'client' ? 'join' : s.shareMode;
  const err = localErr || sh.error;
  const errKey = useBumpKey(err);
  const avatarKey = useBumpKey(`${s.name}|${s.hue}`);

  useEffect(() => {
    const port = parsePort(s.port) ?? 8787;
    localInfo(port)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [s.port]);

  const needName = () => {
    if (cleanName(s.name)) return false;
    setLocalErr('같이 고르기에서 보일 이름을 먼저 정해 주세요.');
    nameRef.current?.focus();
    return true;
  };

  const start = () => {
    setLocalErr('');
    if (needName()) return;
    void sh.startHost().then((ok) => {
      if (ok) toast('공유 서버를 열었어요 — 동료에게 주소를 알려주세요');
    });
  };

  const join = (hostRaw = s.joinHost, portRaw = s.joinPort) => {
    setLocalErr('');
    if (needName()) return;
    const hp = splitHostPort(hostRaw);
    const port = parsePort(hp.port ?? portRaw);
    if (!hp.host) {
      setLocalErr('호스트 주소를 입력해 주세요.');
      return;
    }
    if (port === null) {
      setLocalErr('포트는 1024 ~ 65535 사이의 숫자예요.');
      return;
    }
    s.patch({ joinHost: hp.host, joinPort: String(port) });
    void sh.join(hp.host, port);
  };

  const copy = (t: string) => {
    void copyText(t);
    toast(`${t} 복사됨`);
  };

  const online = sh.room?.members.filter((m) => m.online) ?? [];
  const hostMember = sh.room?.members.find((m) => m.host);

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: active
          ? `0 0 0 1px oklch(0.86 0.05 150), 0 10px 30px oklch(0.5 0.08 150 / .08)`
          : PANEL_RING,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'box-shadow .4s',
      }}
    >
      {/* ------------------------------------------------ 머리 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 750 }}>실시간 공유 서버</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>
            같은 사내망의 동료와 한 화면을 보며 점심을 같이 정해요. 한 사람이 호스트로 서버를 열고, 다른
            사람은 각자의 점심픽에서 그 주소로 참여하면 됩니다.
          </div>
        </div>
        <StatusPill status={sh.status} count={online.length} />
      </div>

      {/* ------------------------------------------------ 프로필 */}
      <div style={grid}>
        <span style={rowLabel}>내 이름</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span key={avatarKey} className="lp-pop" style={{ display: 'inline-flex' }}>
            <Avatar m={{ name: s.name || '?', hue: s.hue }} size={34} />
          </span>
          <input
            ref={nameRef}
            className="inp"
            value={s.name}
            maxLength={16}
            onChange={(e) => {
              setLocalErr('');
              s.patch({ name: e.target.value });
            }}
            placeholder="다른 사람에게 보일 이름"
            style={{ ...input, width: 200 }}
          />
          <div style={{ display: 'flex', gap: 5 }} role="radiogroup" aria-label="내 색">
            {AVATAR_HUES.map((h) => {
              const on = s.hue === h;
              return (
                <div
                  key={h}
                  role="radio"
                  aria-checked={on}
                  tabIndex={0}
                  title="이 색으로"
                  onClick={() => s.patch({ hue: h })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') s.patch({ hue: h });
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: avatarBg(h),
                    cursor: 'pointer',
                    boxShadow: on ? `0 0 0 2px white, 0 0 0 4px ${avatarBg(h)}` : 'none',
                    transform: on ? 'scale(1.05)' : 'scale(.86)',
                    transition: 'transform .2s cubic-bezier(.2,.9,.3,1.4), box-shadow .2s',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ 탭 */}
      <ModeSwitch
        value={mode}
        locked={active}
        onChange={(v) => {
          setLocalErr('');
          sh.clearError();
          s.patch({ shareMode: v });
        }}
      />

      {/* ------------------------------------------------ 호스트 */}
      {mode === 'host' ? (
        sh.role === 'host' && sh.status === 'hosting' && sh.info ? (
          <div
            key="live"
            className="lp-fade-up"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                background: LIVE_BG,
                boxShadow: LIVE_RING,
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <Radar />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: OK_FG }}>
                  서버가 열려 있어요 — 동료에게 이 주소를 알려주세요
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...sh.info.addrs, sh.info.pcName].filter(Boolean).map((a, i) => (
                    <button
                      key={a}
                      type="button"
                      className="btn-soft lp-pop"
                      onClick={() => copy(`${a}:${sh.info!.port}`)}
                      title="눌러서 복사"
                      style={{
                        ...btn('soft', 32),
                        animationDelay: `${i * 70}ms`,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                      }}
                    >
                      {a}
                      <span style={{ color: MUTED_2, fontWeight: 600 }}>:{sh.info!.port}</span>
                      <IconCopy size={14} color={MUTED_2} />
                    </button>
                  ))}
                  {!sh.info.addrs.length ? (
                    <span style={{ fontSize: 12.5, color: MUTED }}>
                      사내망 주소를 찾지 못했어요. 네트워크 연결을 확인해 주세요.
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: MUTED }}>
                  <AvatarStack members={online} size={22} max={6} />
                  {online.length > 1 ? `${online.length}명이 함께하고 있어요` : '아직 나 혼자예요'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className={btnClass('accent')}
                onClick={sh.openPanel}
                style={btn('accent')}
              >
                같이 고르기 열기
              </button>
              <button
                type="button"
                className="btn-soft"
                onClick={() => void sh.stopHost().then(() => toast('공유 서버를 껐어요'))}
                style={{ ...btn('soft'), color: DANGER }}
              >
                서버 끄기
              </button>
              <AutoStart />
            </div>
          </div>
        ) : (
          <div
            key="host-off"
            className="lp-fade-up"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={grid}>
              <span style={rowLabel}>포트</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <input
                  className="inp"
                  value={s.port}
                  inputMode="numeric"
                  maxLength={5}
                  onChange={(e) => {
                    sh.clearError();
                    s.patch({ port: e.target.value.replace(/\D/g, '') });
                  }}
                  style={{ ...input, width: 110, fontVariantNumeric: 'tabular-nums' }}
                />
                {preview?.addrs.length ? (
                  <span style={{ fontSize: 12.5, color: MUTED }}>
                    이 PC 주소 ·{' '}
                    <b style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{preview.addrs[0]}</b>
                    {preview.pcName ? ` · ${preview.pcName}` : ''}
                  </span>
                ) : null}
              </div>
              <span style={rowLabel}>자동 시작</span>
              <AutoStart />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={btnClass('accent')}
                onClick={start}
                style={{ ...btn('accent'), opacity: sh.status === 'starting' ? 0.7 : 1 }}
              >
                {sh.status === 'starting' ? <Spinner /> : <IconWifi size={15} />}
                {sh.status === 'starting' ? '여는 중…' : '서버 켜기'}
              </button>
              <span style={{ fontSize: 12, color: MUTED_2, lineHeight: 1.5 }}>
                처음 켤 때 Windows 방화벽 창이 뜨면 &lsquo;액세스 허용&rsquo;을 눌러 주세요.
              </span>
            </div>
          </div>
        )
      ) : null}

      {/* ------------------------------------------------ 참여 */}
      {mode === 'join' ? (
        sh.role === 'client' && (sh.status === 'connected' || sh.status === 'reconnecting') ? (
          <div
            key="joined"
            className="lp-fade-up"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: sh.status === 'connected' ? LIVE_BG : 'oklch(0.975 0.025 80)',
                boxShadow: sh.status === 'connected' ? LIVE_RING : '0 0 0 1px oklch(0.88 0.06 80)',
                borderRadius: 12,
                padding: '14px 16px',
                transition: 'background .3s, box-shadow .3s',
              }}
            >
              <Avatar m={hostMember} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 720 }}>
                  {hostMember?.name ?? '호스트'}님의 방에 참여 중
                </div>
                <div
                  style={{ fontSize: 12.5, color: MUTED, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}
                >
                  {sh.status === 'reconnecting'
                    ? '연결이 잠깐 끊겨 다시 붙는 중이에요…'
                    : `${sh.target?.host}:${sh.target?.port} · ${online.length}명 접속 중`}
                </div>
              </div>
              <AvatarStack members={online} size={22} max={5} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={btnClass('accent')}
                onClick={sh.openPanel}
                style={btn('accent')}
              >
                같이 고르기 열기
              </button>
              <button
                type="button"
                className="btn-soft"
                onClick={sh.leave}
                style={{ ...btn('soft'), color: DANGER }}
              >
                나가기
              </button>
            </div>
          </div>
        ) : (
          <div
            key="join-off"
            className="lp-fade-up"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={grid}>
              <span style={rowLabel}>호스트 주소</span>
              <input
                className="inp"
                value={s.joinHost}
                disabled={sh.status === 'connecting'}
                onChange={(e) => {
                  setLocalErr('');
                  sh.clearError();
                  const hp = splitHostPort(e.target.value);
                  // 주소:포트 를 통째로 붙여 넣으면 포트 칸으로 나눠 준다.
                  if (hp.port) s.patch({ joinHost: hp.host, joinPort: hp.port });
                  else s.patch({ joinHost: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') join();
                }}
                placeholder="호스트 화면에 보이는 IP 주소 또는 PC 이름"
                style={{ ...input, maxWidth: 340 }}
              />
              <span style={rowLabel}>포트</span>
              <input
                className="inp"
                value={s.joinPort}
                inputMode="numeric"
                maxLength={5}
                disabled={sh.status === 'connecting'}
                onChange={(e) => s.patch({ joinPort: e.target.value.replace(/\D/g, '') })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') join();
                }}
                style={{ ...input, width: 110, fontVariantNumeric: 'tabular-nums' }}
              />
              {s.recentHosts.length ? (
                <>
                  <span style={rowLabel}>최근 접속</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.recentHosts.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className="tg-recent"
                        onClick={() => {
                          const hp = splitHostPort(h);
                          join(hp.host, hp.port ?? s.joinPort);
                        }}
                        disabled={sh.status === 'connecting'}
                        style={{
                          height: 28,
                          padding: '0 12px',
                          border: 'none',
                          borderRadius: 14,
                          background: 'oklch(0.965 0.012 50)',
                          color: 'oklch(0.42 0.1 40)',
                          font: 'inherit',
                          fontSize: 12.5,
                          fontWeight: 650,
                          cursor: 'pointer',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {sh.status === 'connecting' ? (
                <>
                  <div
                    style={{
                      ...btn('ink'),
                      cursor: 'default',
                      background: 'oklch(0.32 0.012 60)',
                    }}
                  >
                    <Spinner />
                    접속 중
                    <Dots />
                  </div>
                  <button type="button" className="btn-soft" onClick={sh.cancelJoin} style={btn('soft')}>
                    취소
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={btnClass('accent')}
                  onClick={() => join()}
                  style={btn('accent')}
                >
                  <IconUsers size={15} />
                  접속하기
                </button>
              )}
            </div>
          </div>
        )
      ) : null}

      {err ? (
        <div
          key={errKey}
          className="lp-shake"
          style={{
            fontSize: 12.5,
            color: DANGER,
            background: 'oklch(0.97 0.02 25)',
            borderRadius: 8,
            padding: '9px 12px',
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          {err}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- 조각

function AutoStart() {
  const autoStart = useSettings((s) => s.autoStart);
  const patch = useSettings((s) => s.patch);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => patch({ autoStart: !autoStart })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') patch({ autoStart: !autoStart });
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
    >
      <Toggle on={autoStart} />
      앱을 켜면 공유 서버도 함께 시작
    </div>
  );
}

function ModeSwitch({
  value,
  locked,
  onChange,
}: {
  value: ShareMode;
  locked: boolean;
  onChange: (v: ShareMode) => void;
}) {
  const opts: { v: ShareMode; label: string; icon: React.ReactNode }[] = [
    { v: 'host', label: '호스트로 열기', icon: <IconWifi size={15} /> },
    { v: 'join', label: '다른 PC에 참여', icon: <IconUsers size={15} /> },
  ];
  const idx = opts.findIndex((o) => o.v === value);
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: SEG_TRACK,
        borderRadius: 10,
        padding: 3,
        maxWidth: 380,
      }}
    >
      {/* 미끄러지는 손잡이 */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: 3,
          width: 'calc(50% - 3px)',
          borderRadius: 8,
          background: 'white',
          boxShadow: '0 1px 3px oklch(0.4 0.02 60 / .18)',
          transform: `translateX(${idx * 100}%)`,
          transition: 'transform .34s cubic-bezier(.2,.9,.3,1.15)',
        }}
      />
      {opts.map((o) => {
        const on = o.v === value;
        const disabled = locked && !on;
        return (
          <div
            key={o.v}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={on}
            title={disabled ? '지금 연결을 먼저 끝내야 바꿀 수 있어요' : undefined}
            onClick={() => !disabled && onChange(o.v)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === 'Enter' || e.key === ' ')) onChange(o.v);
            }}
            style={{
              position: 'relative',
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 13.5,
              fontWeight: on ? 700 : 550,
              color: on ? INK : disabled ? 'oklch(0.7 0.008 60)' : 'oklch(0.45 0.012 60)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'color .2s',
            }}
          >
            {o.icon}
            {o.label}
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({
  status,
  count,
}: {
  status: ReturnType<typeof useShare.getState>['status'];
  count: number;
}) {
  const map = {
    idle: {
      label: '꺼짐',
      dot: 'oklch(0.75 0.01 60)',
      bg: 'oklch(0.95 0.004 75)',
      fg: 'oklch(0.45 0.012 60)',
    },
    starting: { label: '여는 중…', dot: WAIT_DOT, bg: 'oklch(0.96 0.03 80)', fg: 'oklch(0.45 0.09 70)' },
    hosting: { label: `호스트 · ${count}명`, dot: LIVE_DOT, bg: 'oklch(0.95 0.04 150)', fg: OK_FG },
    connecting: { label: '접속 중…', dot: WAIT_DOT, bg: 'oklch(0.96 0.03 80)', fg: 'oklch(0.45 0.09 70)' },
    connected: { label: `참여 중 · ${count}명`, dot: LIVE_DOT, bg: 'oklch(0.95 0.04 150)', fg: OK_FG },
    reconnecting: {
      label: '다시 연결 중…',
      dot: WAIT_DOT,
      bg: 'oklch(0.96 0.03 80)',
      fg: 'oklch(0.45 0.09 70)',
    },
  } as const;
  const v = map[status];
  const live = status === 'hosting' || status === 'connected';
  return (
    <div
      key={status}
      className="lp-pop"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 28,
        padding: '0 12px',
        borderRadius: 14,
        background: v.bg,
        color: v.fg,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      <span style={{ position: 'relative', width: 8, height: 8, flex: 'none' }}>
        {live ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: v.dot,
              animation: 'lp-ping 1.6s cubic-bezier(0,.6,.4,1) infinite',
            }}
          />
        ) : null}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: v.dot,
            animation:
              status === 'reconnecting' || status === 'connecting' ? 'lp-breathe 1s infinite' : 'none',
          }}
        />
      </span>
      {v.label}
    </div>
  );
}

/** 서버가 켜져 있는 동안 퍼져 나가는 레이더 */
function Radar() {
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flex: 'none' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            inset: 14,
            borderRadius: '50%',
            border: `2px solid ${LIVE_DOT}`,
            animation: `lp-ping 2.4s cubic-bezier(0,.55,.45,1) ${i * 0.8}s infinite`,
          }}
        />
      ))}
      <span
        style={{
          position: 'absolute',
          inset: 12,
          borderRadius: '50%',
          background: LIVE_DOT,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px oklch(0.6 0.15 150 / .35)',
        }}
      >
        <IconWifi size={17} stroke={2.2} />
      </span>
    </div>
  );
}
