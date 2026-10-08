import { useEffect, useRef, useState } from 'react';

import Seg from '../components/Seg';
import Toggle from '../components/Toggle';
import ShareCard from './settings/ShareCard';
import {
  ERR_NO_CREDS,
  SECRET_CLIENT_KEY,
  SECRET_OPENAPI_TOKEN,
  dataDirPath,
  fabrixModels,
  fabrixTest,
  pickOpenPath,
  pickSavePath,
  readTextFile,
  secretDelete,
  secretSet,
  writeTextFile,
} from '../lib/ipc';
import {
  buildCsv,
  buildShareJson,
  exportFileName,
  type ImportSummary,
  mergeRestaurants,
  parseShareJson,
  replaceRestaurants,
  summarizeImport,
} from '../lib/shareFormat';
import type { Restaurant } from '../lib/types';
import { useData } from '../store/dataStore';
import { FALLBACK_MODELS, useSettings } from '../store/settingsStore';
import { toast, toastError } from '../store/uiStore';
import {
  AC,
  DANGER,
  INK,
  MUTED,
  MUTED_2,
  MUTED_3,
  OK_BG,
  OK_FG,
  PANEL_RING,
} from '../theme';

const INPUT_BORDER = 'oklch(0.88 0.006 75)';
const JSON_FILTER = [{ name: '점심픽 식당 목록 (JSON)', extensions: ['json'] }];
const CSV_FILTER = [{ name: 'CSV', extensions: ['csv'] }];

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 12,
  boxShadow: PANEL_RING,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const rowLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 650,
  color: 'oklch(0.38 0.012 60)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px minmax(0,1fr)',
  gap: '14px 16px',
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
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

const btnSoft: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 7,
  background: 'white',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

/** Rust 에서 온 에러를 사용자 문구로 바꾼다. */
function humanize(e: unknown): string {
  const raw = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
  if (raw.includes(ERR_NO_CREDS)) return 'Client Key 와 OpenAPI Token 을 먼저 저장해 주세요.';
  return raw;
}

export default function SettingsScreen() {
  const restaurants = useData((s) => s.restaurants);
  const apply = useData((s) => s.apply);
  const reset = useData((s) => s.reset);
  const clear = useData((s) => s.clear);
  const s = useSettings();

  const [dir, setDir] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [token, setToken] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [testOk, setTestOk] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  /** 두 번 눌러야 하는 버튼 중 한 번 누른 것 */
  const [confirm, setConfirm] = useState<'seed' | 'clear' | null>(null);
  const [pending, setPending] = useState<{
    restaurants: Restaurant[];
    summary: ImportSummary;
  } | null>(null);

  useEffect(() => {
    dataDirPath()
      .then(setDir)
      .catch(() => setDir(''));
  }, []);

  const models = s.fabrixModels.length ? s.fabrixModels : FALLBACK_MODELS;
  const menuCount = restaurants.reduce((a, r) => a + r.menus.length, 0);

  // ------------------------------------------------ AI

  const saveKeys = async () => {
    try {
      if (clientKey.trim()) await secretSet(SECRET_CLIENT_KEY, clientKey.trim());
      if (token.trim()) await secretSet(SECRET_OPENAPI_TOKEN, token.trim());
      setClientKey('');
      setToken('');
      await s.refreshSecrets();
      setTestMsg('');
      toast('AI 설정을 저장했어요');
    } catch (e) {
      toastError(e, '저장 실패');
    }
  };

  const deleteKeys = async () => {
    try {
      await Promise.all([secretDelete(SECRET_CLIENT_KEY), secretDelete(SECRET_OPENAPI_TOKEN)]);
      await s.refreshSecrets();
      setTestMsg('');
      setTestOk(false);
      toast('저장된 키를 삭제했어요');
    } catch (e) {
      toastError(e, '삭제 실패');
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestMsg('');
    try {
      const msg = await fabrixTest(s.fabrix);
      setTestOk(true);
      setTestMsg(msg);
    } catch (e) {
      setTestOk(false);
      setTestMsg(humanize(e));
    } finally {
      setTesting(false);
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const list = await fabrixModels(s.fabrix);
      s.patch({ fabrixModels: list });
      toast(`모델 ${list.length}개를 불러왔어요`);
    } catch (e) {
      toast(humanize(e));
    } finally {
      setLoadingModels(false);
    }
  };

  // ------------------------------------------------ 데이터

  const exportJson = async () => {
    try {
      const path = await pickSavePath(exportFileName('json'), JSON_FILTER);
      if (!path) return;
      await writeTextFile(path, buildShareJson(restaurants));
      toast(`식당 ${restaurants.length}곳을 내보냈어요`);
    } catch (e) {
      toastError(e, '내보내기 실패');
    }
  };

  const exportCsv = async () => {
    try {
      const path = await pickSavePath(exportFileName('csv'), CSV_FILTER);
      if (!path) return;
      await writeTextFile(path, buildCsv(restaurants));
      toast('CSV 파일을 저장했어요');
    } catch (e) {
      toastError(e, '내보내기 실패');
    }
  };

  const startImport = async () => {
    try {
      const path = await pickOpenPath(JSON_FILTER);
      if (!path) return;
      const text = await readTextFile(path);
      const incoming = parseShareJson(text);
      setPending({ restaurants: incoming, summary: summarizeImport(incoming, restaurants) });
    } catch (e) {
      toastError(e);
    }
  };

  const doMerge = () => {
    if (!pending) return;
    const { summary } = pending;
    apply((d) => ({ ...d, restaurants: mergeRestaurants(d.restaurants, pending.restaurants) }));
    setPending(null);
    toast(`식당 ${summary.added}곳 · 메뉴 ${summary.addedMenus}개를 추가했어요`);
  };

  const doReplace = () => {
    if (!pending) return;
    const next = replaceRestaurants(pending.restaurants);
    const keep = new Set(next.map((r) => r.id));
    apply((d) => ({
      ...d,
      restaurants: next,
      // 사라진 식당의 먹은 기록은 함께 정리한다.
      history: d.history.filter((h) => keep.has(h.restId)),
    }));
    setPending(null);
    toast(`식당 목록을 ${next.length}곳으로 교체했어요`);
  };

  /** 한 번 누르면 3초 동안 확인을 기다리고, 그 안에 한 번 더 누르면 실행한다. */
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);
  const twice = (what: 'seed' | 'clear', run: () => void) => {
    clearTimeout(confirmTimer.current);
    if (confirm !== what) {
      setConfirm(what);
      confirmTimer.current = setTimeout(() => setConfirm(null), 3000);
      return;
    }
    setConfirm(null);
    run();
  };

  const onReset = () =>
    twice('seed', () => {
      reset();
      toast('초기화했어요');
    });

  const onClear = () =>
    twice('clear', () => {
      clear();
      toast('식당 목록을 비웠어요');
    });

  return (
    <div style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}>
      <div
        style={{
          maxWidth: 800,
          padding: '22px 28px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em' }}>설정</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            동료와 같이 고를 서버를 켜거나, 동료의 방에 접속할 수 있어요. AI 키와 식당 목록 파일도 여기서
            관리해요.
          </div>
        </div>

        {/* -------------------------------------------- 실시간 공유 서버 */}
        <ShareCard />

        {/* -------------------------------------------- AI (FabriX) */}
        <div style={cardStyle}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 750 }}>AI 추천 (FabriX)</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>
              FabriX 포털에서 &lsquo;LLM Serving APIs&rsquo; 를 신청하면 받는 값이에요. 키는 Windows
              자격 증명 관리자에 저장되고, 호출은 앱 내부에서만 이뤄집니다. 같이 고르기의 AI 정렬은 호스트
              PC의 이 설정으로 처리돼요. 접속한 동료에게 키는 전달되지 않아요.
            </div>
          </div>

          <div style={gridStyle}>
            <span style={rowLabel}>Endpoint URL</span>
            <input
              className="inp"
              value={s.fabrix.endpointUrl}
              onChange={(e) => s.patchFabrix({ endpointUrl: e.target.value })}
              placeholder="https://nsds-api.fabrix-s.samsungsds.com/sds/trial/api-llm"
              style={inputStyle}
            />

            <span style={rowLabel}>경로</span>
            <input
              className="inp"
              value={s.fabrix.prefixPath}
              onChange={(e) => s.patchFabrix({ prefixPath: e.target.value })}
              placeholder="openapi/llm"
              style={{ ...inputStyle, width: 220 }}
            />

            <span style={rowLabel}>Client Key</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="inp"
                type={showKeys ? 'text' : 'password'}
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
                placeholder={s.hasClientKey ? '••••••••  (저장됨 · 바꿀 때만 입력)' : 'x-fabrix-client 값'}
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
              />
              {s.hasClientKey ? <SavedBadge /> : null}
            </div>

            <span style={rowLabel}>OpenAPI Token</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="inp"
                type={showKeys ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  s.hasOpenapiToken ? '••••••••  (저장됨 · 바꿀 때만 입력)' : 'x-openapi-token 값'
                }
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
              />
              {s.hasOpenapiToken ? <SavedBadge /> : null}
            </div>

            <span />
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowKeys((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setShowKeys((v) => !v);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: MUTED,
                cursor: 'pointer',
              }}
            >
              <Toggle on={showKeys} />
              입력한 키 보기 · &lsquo;Bearer &rsquo; 접두사는 없어도 자동으로 붙습니다
            </div>

            <span style={rowLabel}>모델</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={s.fabrix.modelId}
                onChange={(e) => s.patchFabrix({ modelId: e.target.value })}
                style={{ ...inputStyle, minWidth: 280, cursor: 'pointer' }}
              >
                {models.map((m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.modelId} · {m.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-soft" onClick={() => void loadModels()} style={btnSoft}>
                {loadingModels ? '불러오는 중…' : '모델 불러오기'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-accent"
              onClick={() => void saveKeys()}
              style={{
                ...btnSoft,
                border: 'none',
                background: AC,
                color: 'white',
                fontWeight: 700,
              }}
            >
              저장
            </button>
            <button type="button" className="btn-soft" onClick={() => void runTest()} style={btnSoft}>
              {testing ? '확인 중…' : '연결 테스트'}
            </button>
            <button
              type="button"
              className="btn-soft"
              onClick={() => void deleteKeys()}
              style={{ ...btnSoft, color: DANGER }}
            >
              키 삭제
            </button>
            {testMsg ? (
              testOk ? (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 14,
                    background: OK_BG,
                    color: OK_FG,
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  {testMsg}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 12.5,
                    color: DANGER,
                    whiteSpace: 'pre-line',
                    lineHeight: 1.45,
                    flex: 1,
                    minWidth: 240,
                  }}
                >
                  {testMsg}
                </span>
              )
            ) : null}
          </div>
        </div>

        {/* -------------------------------------------- 표시 / 동작 */}
        <div style={{ ...cardStyle, gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 750 }}>표시 / 동작</div>
          <div style={gridStyle}>
            <span style={rowLabel}>애니메이션 속도</span>
            <Seg
              size="md"
              options={[
                { value: '느리게', label: '느리게' },
                { value: '보통', label: '보통' },
                { value: '빠르게', label: '빠르게' },
              ]}
              value={s.animSpeed}
              onChange={(v) => s.patch({ animSpeed: v })}
            />
            <span style={rowLabel}>메뉴 미리보기</span>
            <Seg
              size="md"
              options={[
                { value: 2, label: '2개' },
                { value: 3, label: '3개' },
              ]}
              value={s.menuPreview}
              onChange={(v) => s.patch({ menuPreview: v as 2 | 3 })}
            />
            <span style={rowLabel}>가격 표시</span>
            <div
              role="button"
              tabIndex={0}
              onClick={() => s.patch({ showPrices: !s.showPrices })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') s.patch({ showPrices: !s.showPrices });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Toggle on={s.showPrices} />
              목록과 결과에 메뉴 가격을 함께 보여주기
            </div>
          </div>
        </div>

        {/* -------------------------------------------- 데이터 */}
        <div style={{ ...cardStyle, gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 750 }}>데이터</div>
          <div style={{ fontSize: 12.5, color: MUTED }}>
            식당 {restaurants.length}곳 · 메뉴 {menuCount}개
          </div>
          <div style={{ fontSize: 12.5, color: MUTED_2, lineHeight: 1.5 }}>
            JSON으로 내보낸 파일을 동료에게 주면, 같은 양식 그대로 가져올 수 있어요.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-soft" onClick={() => void exportJson()} style={btnSoft}>
              식당 목록 JSON으로 내보내기
            </button>
            <button type="button" className="btn-soft" onClick={() => void startImport()} style={btnSoft}>
              JSON 파일에서 가져오기
            </button>
            <button type="button" className="btn-soft" onClick={() => void exportCsv()} style={btnSoft}>
              엑셀용 CSV로 내보내기
            </button>
          </div>
          {/* 확인 문구를 버튼 안에 넣으면 버튼 폭이 늘어나 행이 줄바꿈되고,
              두 번째 클릭이 엉뚱한 곳으로 간다. 문구는 버튼 옆에 따로 둔다. */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-soft"
              onClick={onReset}
              style={{ ...btnSoft, color: DANGER, fontWeight: 500 }}
            >
              샘플 데이터로 초기화
            </button>
            <button
              type="button"
              className="btn-soft"
              onClick={onClear}
              style={{ ...btnSoft, color: DANGER, fontWeight: 500 }}
            >
              식당 목록 모두 지우기
            </button>
            {confirm === 'seed' ? (
              <span style={{ fontSize: 12.5, color: DANGER, fontWeight: 600 }}>
                한 번 더 누르면 지금 목록이 샘플 데이터로 바뀝니다.
              </span>
            ) : confirm === 'clear' ? (
              <span style={{ fontSize: 12.5, color: DANGER, fontWeight: 600 }}>
                한 번 더 누르면 식당 {restaurants.length}곳과 먹은 기록이 모두 지워집니다 (샘플 데이터 포함).
              </span>
            ) : null}
          </div>
          {dir ? (
            <div style={{ fontSize: 11.5, color: MUTED_3, lineHeight: 1.5 }}>
              저장 위치: {dir}
            </div>
          ) : null}
        </div>
      </div>

      {pending ? (
        <ImportDialog
          summary={pending.summary}
          onMerge={doMerge}
          onReplace={doReplace}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- 조각

function SavedBadge() {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 12,
        background: OK_BG,
        color: OK_FG,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      저장됨
    </span>
  );
}

type ImportDialogProps = {
  summary: ImportSummary;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
};

function ImportDialog({ summary, onMerge, onReplace, onCancel }: ImportDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'oklch(0.25 0.012 60 / .32)',
        zIndex: 25,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: 460,
          maxWidth: 'calc(100% - 40px)',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 24px 60px oklch(0.2 0.02 60 / .3)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 780 }}>식당 목록 가져오기</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'oklch(0.32 0.012 60)' }}>
          파일에 식당 <b>{summary.total}곳</b>이 담겨 있어요.
          {summary.overlap ? (
            <>
              {' '}
              이 중 <b>{summary.overlap}곳</b>은 이름이 기존 목록과 겹칩니다.
            </>
          ) : (
            ' 겹치는 이름은 없어요.'
          )}
        </div>
        <div
          style={{
            background: 'oklch(0.975 0.004 75)',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 12.5,
            color: MUTED,
            lineHeight: 1.6,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div>
            <b style={{ color: INK }}>합치기</b> — 새 식당 {summary.added}곳을 추가하고, 겹치는
            식당에는 없는 메뉴 {summary.addedMenus}개만 더합니다. 기존 전화번호·메모·★는 그대로
            둡니다.
          </div>
          <div>
            <b style={{ color: INK }}>전체 교체</b> — 지금 목록을 지우고 파일 내용으로 바꿉니다.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-soft" onClick={onCancel} style={{ ...btnSoft, height: 38 }}>
            취소
          </button>
          <button
            type="button"
            className="btn-soft"
            onClick={onReplace}
            style={{ ...btnSoft, height: 38, color: DANGER }}
          >
            전체 교체
          </button>
          <button
            type="button"
            className="btn-accent"
            onClick={onMerge}
            style={{
              ...btnSoft,
              height: 38,
              border: 'none',
              background: AC,
              color: 'white',
              fontWeight: 700,
            }}
          >
            합치기
          </button>
        </div>
      </div>
    </div>
  );
}
