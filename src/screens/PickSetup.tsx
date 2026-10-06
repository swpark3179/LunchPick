import Chip from '../components/Chip';
import Seg from '../components/Seg';
import { topMenus } from '../lib/util';
import type { ModeId } from '../lib/types';
import { MIDS, MODES, PRESETS, stepErr, validatePlan } from '../pick/modes';
import { useData } from '../store/dataStore';
import { usePick } from '../store/pickStore';
import {
  AC,
  AINK,
  CATS,
  DANGER,
  INK,
  LINE,
  MUTED,
  MUTED_2,
  PANEL_RING,
  SOFT,
  catDot,
} from '../theme';

const INPUT_BORDER = 'oklch(0.88 0.006 75)';

export default function PickSetup() {
  const s = usePick();
  // basePool() 은 데이터 스토어를 getState() 로 읽는다 — 구독해 두지 않으면
  // 식당이 추가/삭제돼도 이 화면이 다시 그려지지 않는다.
  useData((d) => d.restaurants);
  const base = s.basePool();
  const items = s.pickedItems();
  const picked = new Set(items.map((i) => i.key));
  const n = items.length;

  const plan = s.currentPlan();
  const errs = validatePlan(plan, n);
  const firstErr = errs.find(Boolean) ?? '';
  const flowText = `${n}곳 → ${plan.map((st) => `${MODES[st.mode].name} ${st.keep}곳`).join(' → ')}`;

  const sq = s.setupSearch.trim().toLowerCase();
  const setupList = base.filter(
    (r) =>
      !sq || r.name.toLowerCase().includes(sq) || r.menus.some((m) => m.name.includes(sq)),
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(260px,330px) minmax(0,1fr)',
        gap: 18,
        padding: '2px 28px 24px',
      }}
    >
      {/* ------------------------------------------------ 후보 패널 */}
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          boxShadow: PANEL_RING,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderBottom: '1px solid oklch(0.93 0.005 75)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>후보 식당</span>
            <span
              style={{
                fontSize: 12.5,
                color: AINK,
                fontWeight: 650,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n} / {base.length}곳
            </span>
          </div>

          {s.scope ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                background: SOFT,
                borderRadius: 7,
                padding: '7px 10px',
                fontSize: 12.5,
                color: 'oklch(0.42 0.12 40)',
              }}
            >
              <span>이전 결과 {s.scope.length}곳으로 진행 중</span>
              <button
                type="button"
                onClick={s.clearScope}
                style={{
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  fontSize: 12,
                  color: 'oklch(0.42 0.12 40)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                전체로
              </button>
            </div>
          ) : null}

          <input
            className="inp"
            value={s.setupSearch}
            onChange={(e) => s.setSetupSearch(e.target.value)}
            placeholder="후보 검색"
            style={{
              height: 32,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 7,
              padding: '0 10px',
              font: 'inherit',
              fontSize: 13,
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {CATS.filter((c) => base.some((r) => r.category === c)).map((c) => {
              const inC = base.filter((r) => r.category === c);
              const anyOn = inC.some((r) => picked.has(r.id));
              return (
                <Chip
                  key={c}
                  label={c}
                  title="분류 전체 켜기/끄기"
                  onClick={() => s.toggleCatGroup(c)}
                  dot={catDot(c)}
                  dotSize={6}
                  gap={5}
                  height={24}
                  padX={8}
                  fontSize={12}
                  bg={anyOn ? 'white' : 'oklch(0.96 0.004 75)'}
                  color={anyOn ? 'oklch(0.3 0.012 60)' : 'oklch(0.6 0.01 60)'}
                  border={anyOn ? LINE : 'transparent'}
                  strike={!anyOn}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
              <button
                type="button"
                onClick={s.selectAll}
                style={{
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  cursor: 'pointer',
                  color: AINK,
                  padding: 0,
                }}
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={s.selectNone}
                style={{
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  cursor: 'pointer',
                  color: MUTED,
                  padding: 0,
                }}
              >
                해제
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {setupList.map((r) => {
            const on = picked.has(r.id);
            return (
              <div
                key={r.id}
                className="pick-row"
                role="button"
                tabIndex={0}
                onClick={() => s.toggleExcl(r.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') s.toggleExcl(r.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  opacity: on ? 1 : 0.5,
                  borderBottom: '1px solid oklch(0.955 0.004 75)',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    flex: 'none',
                    background: on ? AC : 'white',
                    boxShadow: `inset 0 0 0 1.5px ${on ? AC : 'oklch(0.82 0.008 75)'}`,
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? '✓' : ''}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: catDot(r.category),
                        flex: 'none',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 620,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'oklch(0.52 0.012 60)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {topMenus(r, 3).map((m) => m.name).join(' · ') || '메뉴 미등록'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ 방식 */}
      <div
        style={{
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          paddingBottom: 8,
        }}
      >
        <Seg
          size="lg"
          options={[
            { value: 'single', label: '한 가지 방식' },
            { value: 'course', label: '섞어서 (코스)' },
          ]}
          value={s.methodTab}
          onChange={s.setMethodTab}
        />

        {s.methodTab === 'single' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
                gap: 10,
              }}
            >
              {MIDS.map((id) => {
                const m = MODES[id];
                const err = stepErr({ mode: id, keep: s.target }, n);
                const on = s.mode === id;
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    onClick={() => s.setMode(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') s.setMode(id);
                    }}
                    style={{
                      background: on ? SOFT : 'white',
                      borderRadius: 10,
                      padding: 14,
                      cursor: 'pointer',
                      boxShadow: on ? `inset 0 0 0 2px ${AC}` : 'inset 0 0 0 1px oklch(0.91 0.006 75)',
                      opacity: err ? 0.55 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'box-shadow .15s, background .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          height: 22,
                          minWidth: 22,
                          padding: '0 6px',
                          borderRadius: 6,
                          background: on ? AC : 'oklch(0.94 0.005 75)',
                          color: on ? 'white' : 'oklch(0.4 0.012 60)',
                          fontSize: 11,
                          fontWeight: 750,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {m.tag}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'oklch(0.48 0.012 60)',
                        lineHeight: 1.5,
                        textWrap: 'pretty',
                      }}
                    >
                      {m.desc}
                    </div>
                    <div style={{ fontSize: 12, color: DANGER }}>{err}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>몇 곳까지 줄일까요?</span>
              <Seg
                size="md"
                options={[
                  { value: 1, label: '최종 1곳' },
                  { value: 4, label: '4곳까지' },
                ]}
                value={s.target}
                onChange={s.setTarget}
              />
              <span style={{ fontSize: 12.5, color: 'oklch(0.52 0.012 60)' }}>
                4곳까지 줄이면 마지막은 직접 고르거나 한 번 더 돌릴 수 있어요.
              </span>
            </div>
          </div>
        ) : (
          <CourseTab n={n} />
        )}

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            background: 'white',
            borderRadius: 12,
            boxShadow: PANEL_RING,
            padding: '14px 16px',
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: 'oklch(0.52 0.012 60)' }}>진행 순서</div>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                marginTop: 3,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {flowText}
            </div>
            <div style={{ fontSize: 12, color: DANGER, marginTop: 3 }}>{firstErr}</div>
          </div>
          <button
            type="button"
            className={firstErr ? '' : 'btn-accent'}
            onClick={s.start}
            disabled={!!firstErr}
            style={{
              height: 44,
              padding: '0 22px',
              border: 'none',
              borderRadius: 9,
              background: AC,
              color: 'white',
              font: 'inherit',
              fontSize: 15,
              fontWeight: 700,
              cursor: firstErr ? 'not-allowed' : 'pointer',
              opacity: firstErr ? 0.4 : 1,
            }}
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 코스 탭

function CourseTab({ n }: { n: number }) {
  const s = usePick();
  const cErrs = validatePlan(s.custom, n);

  const flowChips = (steps: { mode: ModeId; keep: number }[], selected: boolean) =>
    steps.map((st, i) => (
      <span key={`${st.mode}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            height: 22,
            padding: '0 8px',
            borderRadius: 11,
            background: selected ? 'white' : 'oklch(0.95 0.005 75)',
            color: 'oklch(0.35 0.012 60)',
            fontSize: 11.5,
            fontWeight: 650,
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {MODES[st.mode].tag} → {st.keep}곳
        </span>
        {i < steps.length - 1 ? (
          <span style={{ color: 'oklch(0.7 0.01 60)', fontSize: 12 }}>→</span>
        ) : null}
      </span>
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: MUTED }}>
        여러 방식을 이어서 단계별로 줄여요. 앞 단계의 결과가 다음 단계의 후보가 됩니다.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
          gap: 10,
        }}
      >
        {PRESETS.map((p) => {
          const on = s.preset === p.id;
          const steps = p.steps ?? s.custom;
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => s.setPreset(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') s.setPreset(p.id);
              }}
              style={{
                background: on ? SOFT : 'white',
                borderRadius: 10,
                padding: 14,
                cursor: 'pointer',
                boxShadow: on ? `inset 0 0 0 2px ${AC}` : 'inset 0 0 0 1px oklch(0.91 0.006 75)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {flowChips(steps, on)}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'oklch(0.48 0.012 60)',
                  lineHeight: 1.5,
                  textWrap: 'pretty',
                }}
              >
                {p.desc}
              </div>
            </div>
          );
        })}
      </div>

      {s.preset === 'custom' ? (
        <div
          style={{
            background: 'white',
            borderRadius: 10,
            boxShadow: PANEL_RING,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>
            나만의 코스{' '}
            <span style={{ fontWeight: 400, color: MUTED_2, fontSize: 12.5 }}>· 최대 3단계</span>
          </div>
          {s.custom.map((c, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: INK,
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                {i + 1}
              </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {MIDS.map((id) => {
                  const on = c.mode === id;
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      onClick={() => s.setCustomStep(i, { mode: id })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') s.setCustomStep(i, { mode: id });
                      }}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 6,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        background: on ? INK : 'white',
                        color: on ? 'white' : 'oklch(0.35 0.012 60)',
                        boxShadow: `inset 0 0 0 1px ${on ? INK : LINE}`,
                        fontWeight: on ? 650 : 500,
                      }}
                    >
                      {MODES[id].tag}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <button
                  type="button"
                  onClick={() => s.setCustomStep(i, { keep: Math.max(1, c.keep - 1) })}
                  style={stepperBtn}
                >
                  −
                </button>
                <span
                  style={{
                    minWidth: 44,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 650,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c.keep}곳
                </span>
                <button
                  type="button"
                  onClick={() => s.setCustomStep(i, { keep: Math.min(30, c.keep + 1) })}
                  style={stepperBtn}
                >
                  +
                </button>
              </div>
              {s.custom.length > 1 ? (
                <button
                  type="button"
                  onClick={() => s.removeCustomStep(i)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    font: 'inherit',
                    fontSize: 12,
                    color: MUTED_2,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  빼기
                </button>
              ) : null}
              <span style={{ fontSize: 12, color: DANGER }}>{cErrs[i]}</span>
            </div>
          ))}
          {s.custom.length < 3 ? (
            <button
              type="button"
              onClick={s.addCustomStep}
              style={{
                alignSelf: 'flex-start',
                border: 'none',
                background: 'transparent',
                font: 'inherit',
                fontSize: 12.5,
                color: AINK,
                cursor: 'pointer',
                fontWeight: 600,
                padding: 0,
              }}
            >
              + 단계 추가
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const stepperBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 6,
  background: 'white',
  font: 'inherit',
  cursor: 'pointer',
};
