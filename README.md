# 점심픽 (LunchPick)

점심 식당을 모아두고, 오늘 어디 갈지 여러 방식으로 줄여서 정하는 Windows 데스크탑 앱.

- **식당 목록** — 식당·메뉴·전화번호 관리, 분류/★ 필터, 카드·표 보기, 전화번호 복사
- **오늘 뭐 먹지?** — 소거법 · 이상형 월드컵 · 사다리 타기 · 룰렛 · 슬롯머신 · AI 추천.
  한 가지 방식으로, 또는 여러 방식을 코스로 이어서 후보를 줄인다.
- **같이 고르기** — 사내망의 동료와 한 화면을 보며 실시간으로 함께 고른다. 가기 싫은 곳 빼기,
  후보 함께 찍기, 무작위 n곳 뽑기, AI 정렬(대기열·멀티턴), 사다리, 최종 확정, 채팅.
- **설정** — 실시간 공유 서버(호스트 열기 / 참여), FabriX(AI) 키 등록, 표시 옵션,
  식당 목록 JSON 내보내기/가져오기, CSV 내보내기

## 기술 스택

Tauri 2 · React 19 · TypeScript · Vite · Zustand / Rust (reqwest · keyring · tokio-tungstenite)

## 개발

```bash
npm install
npm run tauri dev      # 앱 실행
npm run build          # 타입체크 + 프론트엔드 빌드
npm run tauri build    # 실행 파일 생성 → src-tauri/target/release/lunchpick.exe
```

`npm run dev` 만 띄우면 브라우저에서도 UI를 볼 수 있다 (저장은 localStorage로 폴백, AI·파일
다이얼로그는 동작하지 않음).

## 배포 — 설치 없이 exe 하나로

`lunchpick.exe` 파일 하나만 복사해서 아무 폴더에서나 실행하면 된다. 화면(HTML·JS·폰트)과
VC++ 런타임, WebView2 로더가 모두 exe 안에 들어 있다. 설치 파일(NSIS)은 만들지 않는다
(`tauri.conf.json` 의 `bundle.active: false`).

- **필요한 것** — Microsoft Edge WebView2 런타임. Windows 11 에는 기본으로 있고, Windows 10 도
  Edge 가 깔린 PC 는 대부분 있다. 없으면 창이 뜨지 않는다.
- **데이터는 exe 옆이 아니라 사용자 폴더에 저장된다** (아래 '저장 위치'). 그래서 새 버전 exe 로
  바꿔도 식당 목록과 키가 그대로 남는다. 화면 캐시는 `%LOCALAPPDATA%\com.lunchpick.desktop` 에 생긴다.
- **코드 서명이 없다** — 메일·메신저로 받은 exe 는 Windows SmartScreen 이 "PC 보호" 경고를 띄울 수
  있다. `추가 정보 → 실행` 으로 연다.
- **지우기** — exe 와 `%APPDATA%\com.lunchpick.desktop`, `%LOCALAPPDATA%\com.lunchpick.desktop`
  폴더를 지우고, 자격 증명 관리자에서 `lunchpick` 항목을 지운다.

## 저장 위치

| 대상 | 위치 |
|---|---|
| 식당·메뉴·먹은 기록 | `%APPDATA%\com.lunchpick.desktop\data.json` |
| 설정 (비밀값 제외) | `%APPDATA%\com.lunchpick.desktop\settings.json` |
| FabriX 자격증명 | Windows 자격 증명 관리자 — 서비스 `lunchpick` |

설정 화면 하단에 실제 저장 경로가 표시된다. 두 JSON 파일은 임시 파일 + rename 으로 원자적으로
쓴다. 파일이 손상되면 `*.corrupt.json` 으로 치워두고 샘플 데이터로 시작한다.

## AI 추천 (FabriX)

Samsung SDS FabriX **LLM Serving APIs** 를 쓴다. FabriX 포털에서 신청하면 받는 값 3개를 설정
화면에 넣는다.

| 입력 | 보내는 헤더 |
|---|---|
| Endpoint URL | — (`{endpoint}/openapi/llm` 이 base) |
| Client Key | `x-fabrix-client` |
| OpenAPI Token | `x-openapi-token` (`Bearer ` 접두사는 없으면 자동으로 붙음) |
| 모델 | `x-llm-model-id` (기본 `16`) |

호출은 **Rust 백엔드에서만** 한다 — 키가 webview 로 내려가지 않고, 키를 읽는 Tauri 커맨드도
없다. AI 가 실패하면(키 미설정·네트워크 오류·한도 초과·응답 파싱 실패) 무작위 선택으로 폴백해
흐름이 막히지 않는다.

FabriX 호출은 **프록시를 타지 않고 항상 DIRECT** 로 나간다. PC 에 `HTTP_PROXY`·`HTTPS_PROXY`·
`ALL_PROXY` 환경변수나 Windows 인터넷 옵션 프록시가 잡혀 있어도 무시한다.

**키 없이 테스트하기** — 바탕화면 `FabrixSample` 에 실 응답을 재생하는 목 서버가 있다.

```bash
cd ~/Desktop/FabrixSample
pip install requests          # 목 서버가 쓰는 fabrix 패키지에 필요
python -m mock.server --port 8765
```

설정 화면에 아래 값을 넣으면 된다.

```
Endpoint URL : http://127.0.0.1:8765/sds/trial/api-llm
Client Key   : mock-client-key
OpenAPI Token: Bearer mock-openapi-token
```

## 같이 고르기 (실시간 공유)

한 사람이 **호스트**로 공유 서버를 열고, 나머지는 각자 PC의 점심픽에서 그 주소로 **접속**한다.
식당 목록과 AI 정렬은 호스트 PC 기준이다. 화면과 애니메이션은 디자인 시안 `같이 고르기.dc.html` 을 따른다.

1. 설정 → 실시간 공유 서버에서 **내 이름**을 정한다. 아바타 색은 이름에서 정해지고, 오른쪽에
   '동료 화면에는 이렇게 보여요' 미리보기가 뜬다.
2. 호스트: **호스트로 열기** → 포트(기본 `8787`) → **서버 켜기**. 포트 확인 → 로컬 서버 시작 →
   식당 공유 준비 단계가 차례로 지나가고, 레이더 가운데의 나와 둘레로 들어오는 동료, 크게 보이는
   접속 주소(복사)가 나온다. 처음 켤 때 Windows 방화벽 창이 뜨면 '허용'을 누른다.
   '자동 시작'을 켜 두면 앱을 켤 때 서버도 함께 열린다.
3. 참여자: **호스트에 접속** → `주소:포트` → **접속**. 호스트 찾는 중 → 연결 확인 → 식당 정보 받는
   중(k/N) → 입장 준비를 거쳐 잠시 뒤 같이 고르기 화면으로 들어간다. 최근 접속한 방은 호스트 이름과
   함께 칩으로 남는다.
4. 같이 고르기 화면에서는 사이드바가 접히고 방이 넓게 열린다. 머리의 진행 표시
   (가기 싫은 곳 빼기 → 후보 올리기 → 추려내기 → 최종 확정)가 지금 단계를 알려준다.

방에서 할 수 있는 것 — 식당 세부정보를 빼면 모두 **같은 화면**으로 공유된다.

| 기능 | 동작 |
|---|---|
| 가기 싫은 곳 | 카드의 ⊘ → 그 자리에서 작아지며 빠지고 왼쪽 열에 빠진 순서대로 쌓인다. 누가 뺐는지 보이고, '내 표시 취소'·'나도 싫어요'로 표를 더하거나 뺀다. 아무도 싫어하지 않으면 다시 목록으로 |
| 후보 | 카드를 누르면 모두에게 '후보 · 이름'으로 표시. 한 번 더 누르면 내려온다 |
| 보는 중 | 다른 사람이 마우스를 올린 카드에 그 사람의 이름표가 따라다니고, 참여자 목록에 '보는 중 · 식당'이 뜬다 |
| 무작위 n곳 | 스포트라이트가 카드 사이를 건너뛰다 느려지며 n곳(최대 5)에 멈추고, 그곳들이 후보로 올라간다 |
| AI 정렬 | 원하는 걸 말하면 호스트의 AI가 **순서만** 다시 늘어놓는다 — 카드가 새 자리로 미끄러지고 ▲▼로 오르내린 칸 수, 앞 3곳에 'AI n위'가 붙는다. 원문은 호스트의 AI에만 가고 다른 사람에게는 **키워드만** 공개된다(내 원문은 내 칩에만 툴팁으로). 여러 명이 보내면 'AI 큐'에 들어온 순서대로 쌓여 한 대화(멀티턴)로 누적 반영된다(1차, 2차 …). '순서 초기화'로 되돌린다 |
| 사다리 | 후보 2~8곳 중 n곳을 남긴다. 모두에게 같은 사다리가 보이고, 누구든 이름을 눌러 한 줄씩 또는 '전체 출발'로 내려보낸 뒤 '결과 적용'을 누른다 |
| 최종 확정 | 누구든 후보 칩의 '확정'(또는 식당 정보의 '이 식당으로 최종 확정')을 누르면 모두에게 색종이와 함께 결과가 뜬다. 호스트의 먹은 기록에 남고, '다시 고르기'로 모두에게서 풀 수 있다. 닫으면 머리에 '오늘은 …'이 남는다 |
| 채팅 | 기본 채팅 + 입력 중 표시. 빼기·올리기·뽑기·정렬·사다리·확정·정보 수정도 한 줄씩 남는다 |

식당 **세부정보**(메뉴·전화번호·메모)는 '나만 보는 중' 드로어로 각자 연다. 틀린 정보는 '정보 수정'으로
고치면 호스트의 식당 목록에 저장되고, 모두에게 '방금 수정됨'과 채팅 한 줄로 알려진다.

호스트 PC에 FabriX 키가 없거나 AI 호출이 실패하면 키워드 사전(국물·안 매운·가볍게·비 오는 날 …)으로
대신 정렬해 흐름이 막히지 않는다(나중 요청일수록 조금 더 무겁게 친다). 호스트는 참여자 목록에서
**내보내기**를 할 수 있고, **서버 끄기**를 누르면 참여자들에게 종료 안내가 간다. 참여자는 연결이 잠깐
끊기면 같은 사람으로 자동 재접속한다.

**구조** — Rust(`src-tauri/src/share.rs`)는 WebSocket 서버/접속과 텍스트 전달만 한다. 방 상태의 주인은
호스트 PC의 프론트엔드(`src/share/host.ts`)이고, 참여자는 요청(Action)을 보내고 호스트가 적용한 상태
전체를 받는다. '보는 중' 표시는 자주 바뀌어서 작은 메시지로 따로 보낸다. 메시지 모양은
`src/share/protocol.ts` 에만 있다. 같은 사내망 안에서만 쓰는 기능이라 암호화(TLS)·입장 코드는 없다.

**애니메이션** — 키프레임은 시안의 `lp-*` 를 그대로 옮겼다(`src/styles/together.css`). 무작위 뽑기와
사다리는 연출 자체가 기능이라 `.keep-motion` 으로 감싸 Windows '애니메이션 효과'를 꺼 둔 PC에서도 보인다.
시간표(`src/share/anim.ts`)는 모든 화면이 같은 값으로 계산하고, 호스트의 '애니메이션 속도'를 따른다.

**개발 모드에서 확인하기** — `npm run dev` 로 띄운 브라우저에서는 같은 브라우저의 탭끼리
BroadcastChannel 로 흉내 낸다. 한 탭에서 서버를 켜고, 다른 탭에서 `아무주소:같은포트` 로 접속한다.

## 식당 목록 공유

설정 → 데이터에서 JSON으로 내보내고, 받은 파일을 그대로 가져올 수 있다.

```json
{
  "format": "lunchpick.restaurants",
  "version": 1,
  "exportedAt": "2026-10-06T03:00:00.000Z",
  "count": 27,
  "restaurants": [{ "id": "…", "name": "진주집", "category": "한식", "phone": "02-555-1234",
                    "memo": "", "fav": true,
                    "menus": [{ "id": "…", "name": "김치찌개", "price": 9000, "fav": true }] }]
}
```

가져올 때 두 가지를 고를 수 있다.

- **합치기** — 식당 이름 기준으로 매칭. 새 식당만 추가하고, 겹치는 식당에는 없는 메뉴만 더한다.
  기존 전화번호·메모·★ 는 보존한다.
- **전체 교체** — 지금 목록을 파일 내용으로 완전히 바꾼다.

먹은 기록(`history`)은 개인 데이터라 내보내지 않는다.

## 애니메이션

일반 UI 전환은 Windows의 '애니메이션 효과' 설정(`prefers-reduced-motion`)을 따른다.
고르기 엔진(룰렛·사다리·슬롯·월드컵 등)은 돌아가는 연출 자체가 기능이라 이 설정에서 제외하고
(`.keep-motion`), 속도는 설정 화면의 **애니메이션 속도**로 조절한다. 애니메이션 효과를 꺼 둔
PC에서도 룰렛이 돌지 않고 결과로 바로 넘어가는 일이 없게 하기 위해서다.

애니메이션 효과를 꺼 둔 PC에서 켜진 상태를 확인하려면, 시스템 설정을 바꾸지 말고 창 설정의
`additionalBrowserArgs` 에 `--force-prefers-no-reduced-motion` 을 더한 JSON 을 만들어
`npm run tauri dev -- --config <그 파일>` 로 띄운다. 기본값
`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` 도 함께 적어야 한다.
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 환경 변수는 Tauri 가 인자를 직접 넘기기 때문에 먹히지 않는다.

## 아직 없는 것

- **같이 고르기의 사내망 밖 접속** — 같은 망 안에서만 쓴다. 암호화(TLS)·입장 코드·브라우저용 참여
  페이지는 없다 (참여자도 점심픽을 실행해야 한다).
- FabriX 스트리밍(SSE)·도구 호출 — 이 앱은 한 번에 JSON 배열만 받으면 되므로 쓰지 않는다.
- Windows 외 플랫폼, 자동 업데이트, 코드 서명

## 구조

```
src/
  theme.ts          디자인 토큰 (oklch 값은 디자인 원본에서 그대로 옮김)
  lib/              ipc · util · seed · shareFormat · types
  store/            data · settings · list · pick · ui · share  (Zustand)
  pick/             modes(모드/프리셋/검증) · engine(사다리·월드컵 알고리즘)
  share/            같이 고르기 — protocol · transport(Tauri/개발용) · host(방 엔진) · client · ai · anim · ladder
  components/       TitleBar · Sidebar · Toast · Seg · Chip · Toggle · RestaurantModal · ErrorBoundary
  screens/          List(+Drawer) · Pick(Setup/Play/Result) · Settings(+settings/ShareCard) · play/*
                    together/*  같이 고르기 방 (보드·가기 싫은 곳·후보 트레이·채팅·상세·사다리·확정)
src-tauri/src/
  storage.rs        data.json / settings.json 원자적 읽기·쓰기
  secrets.rs        Windows 자격 증명 관리자 (읽기는 Rust 내부 전용)
  fabrix.rs         FabriX 클라이언트 + 3종 에러 본문 정규화 (+ 같이 고르기용 멀티턴 호출)
  share.rs          같이 고르기 WebSocket 서버/접속 (전달만 — `cargo test share::` 로 실제 소켓 테스트)
```
