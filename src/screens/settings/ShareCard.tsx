/**
 * 설정 → 실시간 공유 서버 (시안: 같이 고르기.dc.html › 설정).
 * 내 이름 → 역할(호스트로 열기 / 호스트에 접속) → 서버 켜기·접속 단계 → 켜짐(레이더)·접속됨.
 */
import { useEffect, useState } from 'react';

import Toggle from '../../components/Toggle';
import { copyText } from '../../lib/ipc';
import type { ShareMode } from '../../lib/types';
import { cleanName, hashHue, LIMITS, shortName } from '../../share/protocol';
import { type HostInfo, localInfo } from '../../share/transport';
import { useSettings } from '../../store/settingsStore';
import { isLive, parsePort, useShare } from '../../store/shareStore';
import { toast, useUi } from '../../store/uiStore';
import { AC, INK, MUTED, MUTED_3, PANEL_RING } from '../../theme';
import {
  Avatar,
  AMBER,
  GRAY_DOT,
  IconCheck,
  IconCopy,
  IconCrown,
  IconPlay,
  IconServer,
  INPUT_BORDER,
  OK,
  btnAccent,
  btnSoft,
  shakeAnim,
} from '../together/parts';

const LABEL: React.CSSProperties = { fontSize: 13, fontWeight: 650, color: 'oklch(0.38 0.012 60)' };
const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px minmax(0,1fr)',
  gap: '14px 16px',
  alignItems: 'center',
  animation: 'lp-in .3s ease-out',
};
const ERR_RED = 'oklch(0.55 0.19 25)';
const ERR_TEXT = 'oklch(0.5 0.17 25)';

const input = (err: boolean): React.CSSProperties => ({
  height: 36,
  border: `1px solid ${err ? ERR_RED : INPUT_BORDER}`,
  borderRadius: 7,
  padding: '0 10px',
  font: 'inherit',
  fontSize: 14,
  outline: 'none',
  background: 'white',
  color: INK,
  fontVariantNumeric: 'tabular-nums',
});

export default function ShareCard() {
  const s = useSettings();
  const sh = useShare();
  const setView = useUi((u) => u.setView);
  const [local, setLocal] = useState<HostInfo | null>(null);

  const busy = sh.role !== 'none';
  const host: boolean = sh.role === 'host' ? true : sh.role === 'client' ? false : s.shareMode === 'host';
  const live = isLive(sh);
  const name = cleanName(s.name);
  const me = { name: name || '나', hue: hashHue(name || '나') };
  const online = sh.room?.members.filter((m) => m.online) ?? [];
  const n = sh.room?.restaurants.length ?? 0;

  useEffect(() => {
    localInfo(parsePort(s.port) ?? 8787)
      .then(setLocal)
      .catch(() => setLocal(null));
  }, [s.port]);

  const info = sh.info ?? local;
  const myAddr = info
    ? `${info.addrs[0] ?? (info.pcName || '127.0.0.1')}:${sh.info?.port ?? s.port}`
    : `…:${s.port}`;

  const pickRole = (r: ShareMode) => {
    if ((r === 'host') === host) return;
    if (busy) {
      toast('연결을 끊은 뒤 바꿀 수 있어요');
      return;
    }
    sh.clearError();
    s.patch({ shareMode: r });
  };

  const copy = (t: string, msg: string) => {
    void copyText(t);
    toast(msg);
  };

  // ------------------------------------------------ 상태 알약
  const pill = host
    ? sh.status === 'hosting'
      ? {
          text: `운영 중 · ${online.length}명`,
          bg: 'oklch(0.95 0.04 150)',
          fg: 'oklch(0.4 0.1 150)',
          dot: OK,
          live: true,
        }
      : sh.status === 'starting'
        ? { text: '시작 중', bg: 'oklch(0.96 0.04 75)', fg: 'oklch(0.48 0.1 70)', dot: AMBER, live: false }
        : { text: '꺼짐', bg: 'oklch(0.95 0.004 75)', fg: 'oklch(0.45 0.012 60)', dot: GRAY_DOT, live: false }
    : sh.status === 'connected'
      ? {
          text: `접속됨 · ${online.length}명`,
          bg: 'oklch(0.95 0.04 150)',
          fg: 'oklch(0.4 0.1 150)',
          dot: OK,
          live: true,
        }
      : sh.status === 'connecting'
        ? { text: '접속 중', bg: 'oklch(0.96 0.04 75)', fg: 'oklch(0.48 0.1 70)', dot: AMBER, live: false }
        : sh.status === 'reconnecting'
          ? {
              text: '다시 연결 중',
              bg: 'oklch(0.96 0.04 75)',
              fg: 'oklch(0.48 0.1 70)',
              dot: AMBER,
              live: false,
            }
          : {
              text: '연결 안 됨',
              bg: 'oklch(0.95 0.004 75)',
              fg: 'oklch(0.45 0.012 60)',
              dot: GRAY_DOT,
              live: false,
            };

  // ------------------------------------------------ 단계
  const steps: string[] =
    host && sh.status === 'starting'
      ? [`포트 ${s.port} 확인`, '로컬 서버 시작', `식당 ${n}곳 공유 준비`]
      : !host && sh.status === 'connecting'
        ? ['호스트 찾는 중', '연결 확인', `식당 정보 받는 중${n ? ` ${sh.sync}/${n}` : ''}`, '입장 준비']
        : [];
  const stepTarget = host ? myAddr : sh.target ? `${sh.target.host}:${sh.target.port}` : s.joinAddr;

  const portErr = sh.errField === 'port' ? sh.error : '';
  const addrErr = sh.errField === 'addr' ? sh.error : '';

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: PANEL_RING,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {/* ------------------------------------------------ 머리 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 750 }}>실시간 공유 서버</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.5, textWrap: 'pretty' }}>
            같은 사내망에서 점심픽을 켠 동료와 한 화면을 같이 봐요. 식당 목록과 AI 정렬은 호스트 PC
            기준이에요.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 28,
            padding: '0 12px',
            borderRadius: 14,
            background: pill.bg,
            color: pill.fg,
            fontSize: 12.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            flex: 'none',
            transition: 'background .3s, color .3s',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: pill.dot,
              animation: pill.live ? 'lp-breathe 2s infinite' : 'none',
            }}
          />
          {pill.text}
        </div>
      </div>

      {/* ------------------------------------------------ 내 이름 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 16px',
          borderRadius: 10,
          background: 'oklch(0.975 0.004 75)',
          flexWrap: 'wrap',
        }}
      >
        <Avatar m={me} size={44} ring={3} />
        <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={LABEL}>내 이름</span>
          <input
            className="tg-input-ring"
            value={s.name}
            maxLength={LIMITS.name}
            onChange={(e) => s.patch({ name: e.target.value })}
            placeholder="동료에게 보일 이름"
            style={{ ...input(false), width: '100%', maxWidth: 260 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
          <span style={{ fontSize: 11.5, color: 'oklch(0.55 0.012 60)' }}>동료 화면에는 이렇게 보여요</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <Avatar m={me} size={24} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 650, color: 'oklch(0.42 0.012 60)' }}>{me.name}</span>
              <span
                style={{
                  fontSize: 12.5,
                  background: 'white',
                  boxShadow: '0 0 0 1px oklch(0.91 0.006 75)',
                  padding: '6px 10px',
                  borderRadius: '4px 10px 10px 10px',
                }}
              >
                오늘 국물 어때요?
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ 역할 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        <RoleTile
          on={host}
          dim={busy && !host}
          title="호스트로 열기"
          desc="내 PC에서 서버를 켜요. 내 식당 목록과 AI로 방을 엽니다."
          onClick={() => pickRole('host')}
        />
        <RoleTile
          on={!host}
          dim={busy && host}
          title="호스트에 접속"
          desc="동료가 연 방의 주소로 들어가 같이 고릅니다."
          onClick={() => pickRole('join')}
        />
      </div>
      {busy ? (
        <div style={{ fontSize: 12, color: 'oklch(0.55 0.012 60)', marginTop: -8 }}>
          연결된 동안에는 역할을 바꿀 수 없어요. 서버를 끄거나 연결을 끊으면 바꿀 수 있어요.
        </div>
      ) : null}

      {/* ------------------------------------------------ 호스트: 꺼짐 */}
      {host && sh.role === 'none' ? (
        <div style={GRID}>
          <span style={LABEL}>포트</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              animation: portErr ? shakeAnim(sh.errKey) : 'none',
            }}
          >
            <input
              className="tg-input"
              value={s.port}
              inputMode="numeric"
              onChange={(e) => {
                sh.clearError();
                s.patch({ port: e.target.value.replace(/[^\d]/g, '').slice(0, 5) });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void sh.startHost();
              }}
              style={{ ...input(!!portErr), width: 110 }}
            />
            <span style={{ fontSize: 12.5, color: ERR_TEXT, fontWeight: 600, lineHeight: 1.45 }}>
              {portErr}
            </span>
          </div>
          <span style={LABEL}>자동 시작</span>
          <div
            role="button"
            tabIndex={0}
            onClick={() => s.patch({ autoStart: !s.autoStart })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') s.patch({ autoStart: !s.autoStart });
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}
          >
            <Toggle on={s.autoStart} />
            앱을 켜면 공유 서버도 함께 시작
          </div>
          <span />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="tg-accent"
              onClick={() => void sh.startHost()}
              style={btnAccent()}
            >
              <IconPlay />
              서버 켜기
            </button>
            <span style={{ fontSize: 12, color: 'oklch(0.55 0.012 60)' }}>
              Windows 방화벽 창이 뜨면 ‘허용’을 눌러 주세요
            </span>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------ 시작 중 / 접속 중 */}
      {steps.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)',
            gap: 24,
            alignItems: 'center',
            padding: 18,
            borderRadius: 10,
            background: 'oklch(0.975 0.004 75)',
            animation: 'lp-in .3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <Avatar m={me} size={42} ring={3} />
            <div
              style={{
                position: 'relative',
                flex: 1,
                height: 2,
                backgroundImage:
                  'repeating-linear-gradient(90deg, oklch(0.8 0.01 60) 0 6px, transparent 6px 12px)',
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    top: -3,
                    width: 8,
                    height: 8,
                    marginLeft: -4,
                    borderRadius: '50%',
                    background: AC,
                    animation: `lp-flow 1.4s ${i * 0.45}s linear infinite`,
                  }}
                />
              ))}
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 'none' }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  background: INK,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconServer />
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: MUTED,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {stepTarget}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((label, i) => (
              <StepRow key={i} label={label} done={i < sh.step} run={i === sh.step} />
            ))}
          </div>
          {!host ? (
            <div style={{ gridColumn: '1 / -1', marginTop: -6 }}>
              <button type="button" className="tg-soft" onClick={sh.cancelJoin} style={btnSoft(30, 12)}>
                취소
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------ 호스트: 켜짐 */}
      {host && sh.status === 'hosting' ? (
        <div
          style={{
            display: 'flex',
            gap: 28,
            alignItems: 'center',
            flexWrap: 'wrap',
            animation: 'lp-in .35s ease-out',
          }}
        >
          <Radar me={me} peers={online.filter((m) => !m.host)} />
          <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: MUTED }}>접속 주소</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 780,
                    letterSpacing: '-0.01em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {myAddr}
                </span>
                <button
                  type="button"
                  className="tg-soft"
                  onClick={() => copy(myAddr, '접속 주소를 복사했어요')}
                  style={{ ...btnSoft(30, 11), borderRadius: 7, fontSize: 12.5 }}
                >
                  <IconCopy size={13} />
                  복사
                </button>
              </div>
              <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, textWrap: 'pretty' }}>
                동료가 설정 › 실시간 공유 서버에서 ‘호스트에 접속’을 고르고 이 주소를 넣으면 들어와요.
              </span>
              <OtherAddrs info={sh.info} onCopy={(t) => copy(t, `${t} 복사됨`)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'oklch(0.38 0.012 60)' }}>
                참여자 {online.length}명
              </span>
              {online.map((m) => (
                <span
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 24,
                    padding: '0 9px 0 3px',
                    borderRadius: 12,
                    background: 'oklch(0.965 0.005 75)',
                    fontSize: 12,
                    fontWeight: 600,
                    animation: 'lp-pop .4s ease-out both',
                  }}
                >
                  <Avatar m={m} size={18} />
                  {m.host ? `${shortName(m.name)} (나)` : shortName(m.name)}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="tg-accent"
                onClick={sh.enterRoom}
                style={{ ...btnAccent(), animation: online.length > 1 ? 'lp-glow 1.8s infinite' : 'none' }}
              >
                같이 고르기 열기 →
              </button>
              <button
                type="button"
                className="tg-danger"
                onClick={() => void sh.stopHost().then(() => toast('서버를 껐어요'))}
                style={{ ...btnSoft(38, 14), color: ERR_TEXT }}
              >
                서버 끄기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------ 참여: 대기 */}
      {!host && sh.role === 'none' ? (
        <div style={GRID}>
          <span style={LABEL}>호스트 주소</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              animation: addrErr ? shakeAnim(sh.errKey) : 'none',
            }}
          >
            <input
              className="tg-input"
              value={s.joinAddr}
              onChange={(e) => {
                sh.clearError();
                s.patch({ joinAddr: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void sh.join(s.joinAddr);
              }}
              placeholder="192.168.0.31:8787"
              style={{ ...input(!!addrErr), width: 220 }}
            />
            <button
              type="button"
              className="tg-accent"
              onClick={() => void sh.join(s.joinAddr)}
              style={btnAccent(36)}
            >
              접속
            </button>
            <span
              style={{
                fontSize: 12.5,
                color: ERR_TEXT,
                fontWeight: 600,
                lineHeight: 1.45,
                flex: '1 1 200px',
              }}
            >
              {addrErr}
            </span>
          </div>
          <span style={LABEL}>최근 접속</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {s.recentHosts.length ? (
              s.recentHosts.map((r) => (
                <div
                  key={r.addr}
                  role="button"
                  tabIndex={0}
                  className="tg-soft"
                  onClick={() => {
                    sh.clearError();
                    s.patch({ joinAddr: r.addr });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') s.patch({ joinAddr: r.addr });
                  }}
                  style={{
                    height: 28,
                    padding: '0 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 14,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    background: 'white',
                    boxShadow: `inset 0 0 0 1px ${INPUT_BORDER}`,
                  }}
                >
                  {r.name ? <b style={{ fontWeight: 650 }}>{r.name}</b> : null}
                  <span style={{ color: 'oklch(0.55 0.012 60)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.addr}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12.5, color: MUTED_3 }}>
                아직 없어요. 한 번 접속하면 여기에 남아요.
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------ 참여: 접속됨 */}
      {!host && live ? (
        <ClientOn
          reconnecting={sh.status === 'reconnecting'}
          hostName={shortName(sh.room?.members.find((m) => m.host)?.name ?? '호스트')}
          n={n}
          members={online}
          onOpen={sh.enterRoom}
          onLeave={() => {
            sh.leave();
            setView('settings');
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- 조각

function RoleTile({
  on,
  dim,
  title,
  desc,
  onClick,
}: {
  on: boolean;
  dim: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      style={{
        position: 'relative',
        padding: '14px 16px',
        borderRadius: 10,
        cursor: 'pointer',
        background: on ? 'oklch(0.985 0.012 50)' : 'white',
        boxShadow: on ? `0 0 0 2px ${AC}` : `0 0 0 1px ${INPUT_BORDER}`,
        opacity: dim ? 0.45 : 1,
        transition: 'box-shadow .2s, background .2s, opacity .2s',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          flex: 'none',
          marginTop: 1,
          boxShadow: `inset 0 0 0 ${on ? 5 : 0}px ${AC}, inset 0 0 0 1.5px oklch(0.8 0.01 60)`,
          transition: 'box-shadow .2s',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 720 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{desc}</span>
      </div>
    </div>
  );
}

function StepRow({ label, done, run }: { label: string; done: boolean; run: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        color: done || run ? INK : MUTED_3,
        fontWeight: run ? 700 : 500,
        transition: 'color .3s',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          flex: 'none',
          position: 'relative',
          background: done ? OK : run ? 'white' : 'oklch(0.93 0.005 75)',
          boxShadow: run ? 'inset 0 0 0 1.5px oklch(0.88 0.04 50)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          transition: 'background .3s',
        }}
      >
        {done ? <IconCheck size={12} stroke={3} style={{ animation: 'lp-pop .3s ease-out' }} /> : null}
        {run ? (
          <div
            style={{
              position: 'absolute',
              inset: -1,
              borderRadius: '50%',
              border: `2px solid ${AC}`,
              borderRightColor: 'transparent',
              animation: 'lp-spin .8s linear infinite',
            }}
          />
        ) : null}
      </div>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{label}</span>
    </div>
  );
}

/** 서버가 켜져 있는 동안 — 가운데 나, 둘레에 들어온 동료가 하나씩 떠오른다. */
function Radar({
  me,
  peers,
}: {
  me: { name: string; hue: number };
  peers: { id: string; name: string; hue: number }[];
}) {
  // 시안은 -90°, 30°, 150° 세 자리. 그보다 많으면 고르게 나눠 앉힌다.
  const angles = peers.length <= 3 ? [-90, 30, 150] : peers.map((_, i) => -90 + (i * 360) / peers.length);
  return (
    <div
      style={{
        position: 'relative',
        width: 200,
        height: 200,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 80,
              height: 80,
              marginLeft: -40,
              marginTop: -40,
              borderRadius: '50%',
              border: '1.5px solid oklch(0.56 0.16 40 / .5)',
              background: 'oklch(0.56 0.16 40 / .05)',
              animation: `lp-ping 3s ${i}s cubic-bezier(.2,.6,.3,1) infinite`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 26,
          top: 26,
          width: 148,
          height: 148,
          borderRadius: '50%',
          border: '1.5px dashed oklch(0.86 0.01 60)',
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Avatar
          m={me}
          size={56}
          style={{ boxShadow: '0 0 0 4px white, 0 8px 20px oklch(0.4 0.03 60 / .22)' }}
        />
        <IconCrown style={{ position: 'absolute', top: -13, left: 20 }} />
      </div>
      {peers.map((p, i) => {
        const a = (angles[i] * Math.PI) / 180;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: 100 + 74 * Math.cos(a) - 20,
              top: 100 + 74 * Math.sin(a) - 18,
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              width: 40,
              animation: 'lp-pop .55s cubic-bezier(.2,.9,.3,1.4) both',
            }}
          >
            <Avatar
              m={p}
              size={36}
              style={{ boxShadow: '0 0 0 3px white, 0 4px 10px oklch(0.4 0.03 60 / .18)' }}
            />
          </div>
        );
      })}
    </div>
  );
}

function OtherAddrs({ info, onCopy }: { info: HostInfo | null; onCopy: (t: string) => void }) {
  if (!info) return null;
  const rest = [...info.addrs.slice(1), info.pcName].filter(Boolean).map((a) => `${a}:${info.port}`);
  if (!rest.length) return null;
  return (
    <span
      style={{
        fontSize: 12,
        color: MUTED_3,
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      다른 주소
      {rest.map((a) => (
        <span
          key={a}
          role="button"
          tabIndex={0}
          title="복사"
          onClick={() => onCopy(a)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCopy(a);
          }}
          style={{ color: MUTED, fontWeight: 650, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}
        >
          {a}
        </span>
      ))}
    </span>
  );
}

function ClientOn({
  reconnecting,
  hostName,
  n,
  members,
  onOpen,
  onLeave,
}: {
  reconnecting: boolean;
  hostName: string;
  n: number;
  members: { id: string; name: string; hue: number }[];
  onOpen: () => void;
  onLeave: () => void;
}) {
  const bg = reconnecting ? 'oklch(0.96 0.04 75)' : 'oklch(0.95 0.04 150)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        borderRadius: 10,
        background: bg,
        flexWrap: 'wrap',
        animation: 'lp-in .35s ease-out',
        transition: 'background .3s',
      }}
    >
      <div style={{ display: 'flex' }}>
        {members.map((m) => (
          <Avatar
            key={m.id}
            m={m}
            size={34}
            ring={2.5}
            ringColor={bg}
            style={{ marginRight: -8, animation: 'lp-pop .45s cubic-bezier(.2,.9,.3,1.4) both' }}
          />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 180, paddingLeft: 8 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 720,
            color: reconnecting ? 'oklch(0.42 0.1 70)' : 'oklch(0.32 0.08 150)',
          }}
        >
          {reconnecting ? '연결이 잠깐 끊겼어요' : `${hostName}님의 방에 연결됐어요`}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: reconnecting ? 'oklch(0.48 0.1 70)' : 'oklch(0.4 0.1 150)',
            marginTop: 2,
          }}
        >
          {reconnecting
            ? '같은 사람으로 다시 붙는 중이에요…'
            : `식당 ${n}곳을 받아왔어요 · 곧 같이 고르기 화면으로 이동해요`}
        </div>
      </div>
      <button type="button" className="tg-accent" onClick={onOpen} style={btnAccent(36, 16)}>
        같이 고르기 들어가기 →
      </button>
      <button
        type="button"
        className="tg-danger"
        onClick={onLeave}
        style={{ ...btnSoft(36, 14), border: '1px solid oklch(0.85 0.04 150)', color: ERR_TEXT }}
      >
        연결 끊기
      </button>
    </div>
  );
}
