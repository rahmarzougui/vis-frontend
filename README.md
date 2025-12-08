# RefaVis – 시각화 기반 리팩토링 탐색기

RefaVis는 React + Vite + Tailwind로 만든 인터랙티브 대시보드로, 대규모 C/C++ 코드베이스에서 리팩토링 우선순위를 빠르게 식별할 수 있도록 돕습니다.  
프론트엔드는 두 가지 모드를 지원합니다.

1. **Local Mode** – 프로젝트에 포함된 `sqlite_*.json` 파일을 사용해 완전히 로컬에서 콜 그래프와 함수/경고 리스트를 렌더링합니다.
2. **Backend Mode** – [`infovis-backend`](https://github.com/HyeongseoYoo/infovis-backend)에 HTTP로 요청을 보내 GitHub 저장소를 분석하고, 결과를 받아 위와 동일한 UI 구조로 렌더링합니다.

---

## 주요 기능

- 🧭 **프리셋 선택기**: “High Complexity”, “Risky Warnings”, “Easy Fixes” 세 가지 프리셋을 전환할 수 있으며, 각 프리셋은 좌측 패널에 꼭 맞는 필터를 노출하고 서로 다른 정렬 기준을 사용합니다.
- 🎚️ **동적 필터**: 경고 수, 복잡도, 심각도, 연결도, 쉬운 개선 정도로 필터링하면 카드가 즉시 갱신됩니다.
- 🧩 **함수 카드**: Tailwind 기반 스타일링으로 카드마다 호버/선택 상태, 상세 보기 링크, 심각도 칩을 제공합니다.
- 🕸️ **콜 그래프 하이라이트**: 카드나 노드를 클릭하면 함수와 이웃 노드가 주요 블루 팔레트로 강조됩니다.
- 📊 **Radar / Heatmap 비교 뷰**: 선택한 여러 함수의 메트릭을 Radar 차트와 Heatmap으로 시각적으로 비교할 수 있습니다.
- 📱 **반응형 레이아웃**: 좌측 패널은 토글 버튼으로 접을 수 있어 그래프 영역을 넓게 사용할 수 있습니다.

---

## 데이터 구조 개요

Local/Backend 모드 모두 다음 세 가지 JSON 구조를 기준으로 동작합니다.

- `sqlite_function.json` – 함수별 메트릭
  - 예시: `sqlite_function.json:1`
    - `file`: `"src/mem2.c"`
    - `function`: `"sqlite3MemSize"`
    - `NLOC`, `CCN`, `length`, `start_line`, `end_line`, `param`
    - `in_degree`, `out_degree`, `degree`
    - `warning`: `{ "HIGH": 0, "MID": 0, "LOW": 3 }`
- `sqlite_warning.json` – 개별 경고 레코드
  - 예시: `sqlite_warning.json:1`
    - `file`, `function`, `line`, `column`
    - `severity`: `"style"` (도구별 원래 심각도 문자열)
    - `severity_level`: `"HIGH" | "MID" | "LOW"`
    - `category`, `detail`, `warning`, `tool`
    - `id`: `"file@function@line@warning"`
- `public/sqlite_cg.json` – 콜 그래프
  - `nodes`: 각 함수 노드
    - `id`, `name`
    - `file`, `start_line`, `end_line`
    - `in_degree`, `out_degree`, `degree`
  - `edges`: 함수 간 호출 관계
    - `source`: 호출하는 함수 id
    - `target`: 호출되는 함수 id

Backend 모드에서 서버가 반환하는 `functions`, `warnings`, `cg` 응답은 이 스키마와 호환되도록 가정하며, 그대로 메모리 상에서 사용합니다.

---

## 프리셋별 필터링 흐름

`src/pages/WarningsPage.jsx`에는 `complexity`, `severity`, `easy` 3가지 프리셋이 정의되어 있습니다.

2. **프리셋별 필터링 규칙**  
   `src/pages/WarningsPage.jsx`에는 `complexity`, `severity`, `easy` 3가지 프리셋이 정의되어 있습니다.

   - **High Complexity (`complexity`)**
     - 기본 필터: 경고 수 ≥ 1, degree ≥ 3, High 심각도 경고가 1개 이상
     - 필터링: `warningCount >= minWarnings`, `degree >= minDegree`, 선택된 `severity`가 `any`가 아니면 해당 심각도 경고가 하나 이상 있는 함수만 표시
     - 정렬: `complexity` 내림차순(복잡도가 높은 함수부터 상단에 노출)

   - **Risky Warnings (`severity`)**
     - 기본 필터: 복잡도 ≥ 5, 경고 수 ≥ 1
     - 필터링: `complexity >= minComplexity`, `warningCount >= minWarnings`
     - 정렬: `severityCounts.High` 내림차순(High 심각도 경고가 많은 함수일수록 상단에 노출)

   - **Easy Fixes (`easy`)**
     - 기본 필터: 쉬운 경고 수(`easyFixCount`, Low severity) ≥ 1, 복잡도 ≤ 12
     - 필터링: `easyFixCount >= minEasyFix`, `maxComplexity`가 0이 아니면 `complexity <= maxComplexity`
     - 정렬: `easyFixCount` 내림차순(쉬운 경고가 많은 함수일수록 상단에 노출)

   - 프리셋을 바꾸면 관련 셀렉트 박스와 기본값이 함께 전환되며, 위의 기준에 따라 함수 목록이 다시 필터링·정렬됩니다.

3. **함수 카드 인터랙션**  
   - 카드를 클릭하면 선택 상태가 토글되고, 콜 그래프에서도 동일한 함수가 하이라이트됩니다.
   - “함수 상세 보기” 버튼은 향후용 상세 페이지(`/function/:id`)로 라우팅합니다.
   - 심각도 칩(High/Medium/Low)은 해당 경고가 하나 이상 있을 때만 렌더링됩니다.

4. **콜 그래프 하이라이트**  
   `src/components/CallGraphWebGL.jsx`는 WebGL 기반 `force-graph`를 이용해 그래프를 그립니다. 함수가 선택되면:
   - 선택한 노드와 1-hop 이웃 노드가 강조 색상과 100% 불투명도로 유지됩니다.
   - 연결된 엣지는 더 진한 색과 높은 불투명도로 표시되어 관계를 강조합니다.
   - 그 외 노드는 25% 불투명도로 낮춰 시각적 잡음을 줄입니다.  
   기본적으로 노드 드래그, 확대/축소, 간단한 툴팁을 지원합니다.

5. **양방향 선택 연동**  
   그래프에서 노드를 클릭하면 `WarningsPage`의 상태가 갱신되어 동일한 카드를 선택/해제합니다. 선택하지 않은 상태에서의 호버는 일시적으로 연결된 노드와 엣지만 강조합니다.

6. **프리셋 패널 제어**  
   좌측 패널은 둥근 토글 버튼으로 접거나 펼칠 수 있습니다. 패널이 접히면 프리셋 버튼과 필터, 함수 개수 표시가 숨겨지고, 다시 펼치면 동일한 상태로 복원됩니다.

---

## UI 탐색 흐름 (Local / Backend 공통)

- **초기 진입** – `/warnings` 경로에서 “High Complexity” 프리셋이 기본 활성화되며, 경고 ≥ 1 · 연결도 ≥ 3 · 심각도 High 조건을 자동 적용합니다.
- **프리셋 변경** – 프리셋을 바꾸면 표시되는 필터와 기본값이 함께 전환됩니다. `필터 초기화` 버튼은 언제나 해당 프리셋의 기본 조합으로 되돌립니다.
- **필터 조정** – 드롭다운에서 값을 바꾸면 즉시 함수 목록이 재계산됩니다.
- **그래프 탐색** – 카드나 노드를 선택해 주변 관계를 확인하고, 범례를 참고해 색상을 해석하며 드래그·줌으로 구조를 탐색할 수 있습니다.
- **함수 선택 (Call Graph)** – 좌측 함수 목록에서 최대 두 개까지 선택하면, Call Graph 영역에서 선택 함수 기준 서브그래프를 1개 또는 2개 패널로 비교해 볼 수 있습니다.

### Radar / Heatmap 뷰

`/warnings` 페이지의 우측 상단에는 콜 그래프와 Radar/Heatmap 뷰를 전환하는 토글 버튼이 있습니다.

- **뷰 전환 버튼**
  - 기본 라벨: `radar/heatmap` – Call graph에서 Radar/Heatmap으로 전환
  - 전환 후 라벨: `call graph` – Radar/Heatmap에서 다시 Call graph로 복귀
  - 뷰 전환 시에는 혼동을 피하기 위해 기존에 선택되어 있던 함수 선택 상태가 초기화됩니다.

- **데이터 소스**
  - Local Mode: `sqlite_function.json`, `sqlite_warning.json`을 사용합니다.
  - Backend Mode: 서버에서 전달받은 `functions`, `warnings` 응답을 사용합니다.
  - 두 모드 모두 동일한 스키마(`functionsWithMetrics`)를 사용하므로 Radar/Heatmap 뷰가 동일하게 동작합니다.

- **Radar Chart**
  - 파일: `src/components/RadarChart.jsx`
  - 선택된 함수들에 대해 다음 5개 축으로 5각형 레이다 차트를 그립니다.
    - `NLOC`
    - `CCN` (복잡도)
    - `in_degree`
    - `out_degree`
    - `warningScore` = `3 * HIGH + 2 * MID + 1 * LOW`
  - 각 축별 최대값을 기준으로 0~1로 정규화하여 비교 가능한 형태로 표현합니다.
  - Local/Backend 모드 모두 동일하게 동작합니다.

- **Metrics Heatmap**
  - 파일: `src/components/MetricsHeatmap.jsx`
  - 행(row): 선택된 함수 이름
  - 열(column): `NLOC`, `CCN`, `in_degree`, `out_degree`, `warningScore` 다섯 개 메트릭
  - 각 컬럼 내에서 값의 상대적인 순위에 따라 다섯 단계의 빨간색 계조로 표시됩니다.
    - 같은 컬럼에서 가장 큰 값 → 가장 진한 빨강
    - 중간 값들 → 중간 단계의 빨강
    - 가장 작은 값 → 가장 연한 빨강
  - 최소 2개, 최대 5개의 함수를 선택했을 때 Heatmap이 활성화되며, 그보다 적게 선택하면 안내 메시지가 표시됩니다.

- **함수 선택 규칙**
  - Call graph 모드:
    - 설명: “함수를 클릭하면 서브그래프가 표시됩니다. 최대 2개까지 선택하여 비교할 수 있습니다.”
    - 최대 2개의 함수만 선택 가능하며, 선택 수를 초과하면 에러 메시지가 화면에 표시됩니다.
  - Radar/Heatmap 모드:
    - 설명: “함수를 클릭하면 Radar/Heatmap에 사용할 함수가 선택됩니다. 최소 2개, 최대 5개까지 선택할 수 있습니다.”
    - 최소 2개 이상, 최대 5개의 함수까지 선택 가능하며, 초과 시 에러 메시지가 표시됩니다.

- **선택 상태 표시 및 초기화**
  - Call graph 모드:
    - 상단 타이틀: `Call Graph Visualization`
    - 선택된 함수가 있을 경우: “서브그래프: func1, func2 …” 형식으로 표시됩니다.
    - 초기화 버튼: `그래프 초기화` – 현재 서브그래프 선택 및 관련 오버뷰 창들을 모두 초기화합니다.
  - Radar/Heatmap 모드:
    - 상단 타이틀: `Radar Chart / Heatmap`
    - 선택된 함수가 있을 경우: “선택된 함수: func1, func2, …” 형식으로 표기되며, 가로 스크롤이 가능한 컨테이너 안에서 긴 리스트도 확인할 수 있습니다.
    - 초기화 버튼: `선택 함수 초기화` – 선택된 함수 리스트를 모두 비우고 Radar/Heatmap을 초기 상태로 되돌립니다.

- **뷰 전환 시 동작**
  - Call graph → Radar/Heatmap 전환:
    - 서브그래프/선택된 함수 상태 및 관련 드래그 윈도우 상태가 모두 초기화됩니다.
  - Radar/Heatmap → Call graph 전환:
    - 선택된 함수 상태와 오버뷰 윈도우, 검색 이름이 모두 초기화된 기본 콜 그래프 화면으로 되돌아갑니다.

---

## Local Mode

Local Mode는 프로젝트에 포함된 `sqlite_*.json` 파일을 그대로 사용합니다. 백엔드 서버가 없어도 모든 UI가 동작합니다.

- **데이터 소스**
  - `sqlite_function.json`, `sqlite_warning.json`, `public/sqlite_cg.json`
  - `WarningsPage`의 `functionsSource`, `warningsSource`는 항상 이 파일들을 사용합니다.
  - `CallGraphWebGL`은 `/sqlite_cg.json`을 fetch하여 WebGL 콜 그래프를 렌더링합니다.
- **함수 목록**
  - 좌측 함수 리스트는 `functionsSource`와 `warningsSource`를 결합해 `functionsWithMetrics`를 만들고, 프리셋/필터에 따라 정렬/필터링합니다.
- **Call Graph**
  - 그래프 데이터는 항상 로컬 파일에서 읽어옵니다.
  - 모드 토글에서 `Local`이 선택되어 있을 때 동작합니다.

### Local Mode 실행 방법

### 사전 준비

- Node.js 18 이상(권장: Node 20)
- npm 9 이상(Node 최신 버전에 포함)

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

Vite가 로컬 주소(기본 `http://localhost:5173`)를 출력하며, HMR이 기본 활성화됩니다.

### 프로덕션 빌드

```bash
npm run build
```

빌드 결과는 `dist/`에 생성됩니다. 로컬에서 프로덕션 번들을 미리 보려면:

```bash
npm run preview
```

---

## Backend Mode

Backend Mode에서는 [`https://infovis-server.fly.dev`](https://infovis-server.fly.dev) API를 통해 GitHub 저장소를 분석하고, 결과를 메모리에 로드한 뒤 Local Mode와 동일한 구조로 렌더링합니다.

### 전체 파이프라인 개요

`src/App.jsx`에 Backend 파이프라인 로직이 구현되어 있습니다.

- 상태 필드
  - `mode`: `'local' | 'backend'`
  - `githubUrl`: 사용자가 입력한 GitHub 저장소 URL
  - `backendTaskId`: 서버에서 발급한 task_id
  - `backendFunctions`, `backendWarnings`, `backendCg`: 서버에서 받은 JSON (sqlite_* 구조)
  - `backendGraphLoaded`: 콜 그래프/함수/경고 데이터가 준비되었는지 여부
  - `backendStep`: 현재 서버 단계 (`CLONING`, `CLANG`, `INFER`, `CPPLINT`, `LIZARD`, `PREPROCESSING`, `CLEANUP`, `FETCHING` 등)
  - `backendStatus`: `{ status, message }` – 서버가 준 상태/메시지
  - `backendError`: `{ step, endpoint, message }` – 실패/타임아웃 시 에러 정보
  - `isBackendRunning`: 파이프라인 실행 중 여부

- 주요 함수
  - `runBackendPipeline()` – 전체 분석 파이프라인 실행
  - `runBackendStep(taskId, taskName, stepKey, displayLabel)` – 개별 단계 실행
  - `pollTaskStatus(taskId, expectedStep, endpointLabel)` – `/status/` polling (1.5초 주기, 90초 타임아웃)
  - `fetchBackendJson(taskId, dataName, label)` – `cg`, `warnings`, `functions` JSON 조회
  - `resetBackendState()` – Backend 상태 초기화

### Backend Mode에서 UI 동작 방식

#### 1. 모드 전환 및 URL 입력

- Navbar (`src/components/Navbar.jsx`) 우측에서 모드를 전환합니다.
  - `Local` / `Backend` 토글 버튼
  - Backend 선택 시:
    - GitHub repo URL 입력창 (`githubUrl`)
    - `Run Analysis` 버튼 (`onStartBackend` → `runBackendPipeline()` 호출)

#### 2. 파이프라인 단계 흐름

Backend Mode에서 `Run Analysis`를 누르면 다음 순서를 따릅니다.

1. **Task 생성 & Git Clone**
   - `POST /api/tasks/start/` with `{ "github_url": "<입력값>" }`
   - 응답의 `task_id`를 `backendTaskId`에 저장
   - `pollTaskStatus(taskId, 'CLONING', 'Git cloning')`
   - UI:
     - 상단 오버레이에 `"Cloning repository via Git. Please wait..."` 표시
2. **분석 단계 실행 (각각 독립 실행 + polling)**
   - Clang: `POST /api/tasks/{task_id}/run/clang`
     - 완료까지 `/status/` polling
     - 오버레이 문구: `"Running Clang analysis. Please wait..."`
   - Cpplint: `POST /api/tasks/{task_id}/run/cpplint`
     - 오버레이 문구: `"Running Cpplint analysis. Please wait..."`
   - Lizard: `POST /api/tasks/{task_id}/run/lizard`
     - 오버레이 문구: `"Running Lizard analysis. Please wait..."`
   - Infer: `POST /api/tasks/{task_id}/run/infer`
     - 오버레이 문구: `"Running Infer analysis. Please wait..."`
3. **Preprocessing**
   - `POST /api/tasks/{task_id}/run/preprocess`
   - 완료까지 `/status/` polling
   - 오버레이 문구: `"Running preprocessing. Please wait..."`
4. **결과 데이터 조회**
   - `GET /api/tasks/{task_id}/cg`
   - `GET /api/tasks/{task_id}/warnings`
   - `GET /api/tasks/{task_id}/functions`
   - 응답 결과를 그대로:
     - `backendCg` ← `cg` (sqlite_cg.json 구조)
     - `backendWarnings` ← `warnings` (sqlite_warning.json 구조)
     - `backendFunctions` ← `functions` (sqlite_function.json 구조)
   - `backendGraphLoaded = true`
   - 오버레이 문구: `"Fetching analysis results from server..."`
5. **Cleanup**
   - `POST /api/tasks/{task_id}/run/cleanup`
   - 완료까지 `/status/` polling
   - 실패해도 UI에는 영향을 주지 않으며 콘솔에만 로그를 남깁니다.

#### 3. 상태 Polling 규칙

- 모든 단계 실행 후 반드시 `GET /api/tasks/{task_id}/status/`로 상태를 확인합니다.
- 1.5초 주기로 polling, 최대 90초 동안 `COMPLETED`가 되지 않으면 타임아웃 처리합니다.
- 서버 응답 예:
  - `status`: `PENDING | RUNNING | COMPLETED | FAILED`
  - `current_step`: `NONE | CLONING | CLANG | INFER | CPPLINT | LIZARD | PREPROCESSING | CLEANUP`
- Polling 중:
  - `status === 'FAILED'` → 즉시 실패 처리
  - 90초 경과 시 → 타임아웃 에러 처리

#### 4. 로딩 / 에러 UI

- 로딩 오버레이 (`App.jsx`)
  - `isBackendRunning === true`인 동안 전체 화면 상단에 카드 형태의 오버레이 표시
  - 현재 단계와 상태:
    - `Current step: {backendStep}`
    - `Status: {backendStatus.status}`
- 에러 오버레이 (`backendError`가 존재할 때)
  - 다음 정보 표시:
    - `Step` – 실패하거나 타임아웃된 단계명
    - `Endpoint` – 호출한 API URL
    - `Message` – 서버 응답 혹은 예외 메시지
  - 사용자는 `Close` 버튼으로 에러 패널을 닫을 수 있습니다.

#### 5. Backend Mode에서 함수 목록 / 그래프 렌더링

- `WarningsPage` (`src/pages/WarningsPage.jsx`)에서 데이터 소스를 분기합니다.
  - `mode === 'local'`:
    - `functionsSource = sqlite_function.json`
    - `warningsSource = sqlite_warning.json`
  - `mode === 'backend'`:
    - `functionsSource = backendFunctions || []`
    - `warningsSource = backendWarnings || []`
    - backend 결과를 아직 받지 못한 경우(분석 전/실패)에 함수 리스트는 비어 있습니다.

- **함수 목록 영역 (좌측 패널)**
  - Backend Mode에서 아직 데이터를 받지 못한 경우:

    ```text
    Enter a Git repository URL and run the analysis to load functions.
    ```

    가 placeholder로 표시됩니다.

  - 분석이 끝나고 `backendFunctions`가 채워지면:
    - Local Mode와 동일하게 `functionsWithMetrics`를 계산하고, 프리셋/필터/검색에 따라 리스트를 렌더링합니다.

- **Call Graph (중앙 패널)**
  - `CallGraphWebGL`은 `graphData` prop을 통해 Backend 데이터를 받을 수 있습니다.
    - Local Mode: `graphData`를 넘기지 않음 → 내부에서 `/sqlite_cg.json` fetch
    - Backend Mode: `graphData={backendCg}`를 전달 → fetch 없이 메모리 데이터로 렌더
  - Backend Mode에서 아직 그래프 데이터가 없으면:

    ```text
    Enter the Git repository URL to extract the call graph.
    ```

    가 placeholder로 표시됩니다.

### Backend Mode 사용 절차 요약

1. 앱을 실행하고 `/warnings` 페이지로 이동합니다.
2. Navbar 우측에서 `Backend` 모드를 선택합니다.
3. GitHub 저장소 URL을 입력합니다.
   - 예: `https://github.com/DaveGamble/cJSON.git`
4. `Run Analysis` 버튼을 클릭합니다.
5. 상단 오버레이에서 진행 중인 단계를 확인합니다.
   - Cloning → Clang → Cpplint → Lizard → Infer → Preprocessing → Fetching → Cleanup
6. 모든 단계가 성공하면:
   - 좌측 함수 목록에 Backend에서 계산된 함수 메트릭이 표시됩니다.
   - 중앙 Call Graph에 Backend 콜 그래프가 렌더링됩니다.
7. 프리셋/필터/검색/함수 선택 기능은 Local Mode와 동일하게 동작합니다.
8. 문제가 발생하면 에러 오버레이에서:
   - 실패한 단계명
   - 호출 API endpoint
   - 에러 메시지
   를 확인한 후, URL을 수정하거나 다시 실행할 수 있습니다.

---

## UI 세부 동작 및 최근 변경 사항

### Backend 모드에서의 추가 예외 처리

- **GitHub URL 검증**
  - `Run Analysis` 실행 전, 입력한 URL이 유효한 GitHub 저장소 주소인지 검사합니다.
  - 허용되는 형식:
    - `https://github.com/owner/repo`
    - `https://github.com/owner/repo.git`
  - 형식이 잘못된 경우:
    - 파이프라인을 시작하지 않고, 상단 Backend 에러 오버레이에 다음과 유사한 메시지가 표시됩니다.
      - `유효한 GitHub 저장소 URL을 입력하세요. 예: https://github.com/owner/repo 또는 https://github.com/owner/repo.git`

- **Radar/Heatmap 모드에서 Backend 데이터 유효성 검사**
  - Backend 모드에서 Radar/Heatmap 뷰로 전환 시, 다음 두 데이터가 모두 존재해야 합니다.
    - `backendFunctions` (functions 데이터)
    - `backendWarnings` (warnings 데이터)
  - 둘 중 하나라도 비어 있으면:
    - 모드를 Radar/Heatmap으로 전환하지 않고,
    - 화면 상단에 토스트 에러가 표시됩니다.
      - `Backend 모드에서 Radar/Heatmap을 사용하려면 functions 및 warnings 데이터가 필요합니다. 먼저 GitHub 저장소 분석을 완료해 주세요.`

### Call Graph 패널 및 제목

- **Call Graph 패널 토글**
  - `CallGraphWebGL` 좌측 상단에 작은 아이콘 버튼이 있습니다.
    - `▶` / `▼` 아이콘만으로 패널을 열고 닫습니다 (텍스트 라벨 없음).
    - Local/Backend 모드 모두 같은 방식으로 동작합니다.

- **패널 내부 구조**
  - 상단 타이틀: 현재 Call Graph의 데이터 소스를 나타냅니다.
    - Local Mode: `SQLite Call Graph`
    - Backend Mode:
      - GitHub URL이 `https://github.com/DaveGamble/cJSON.git`인 경우 → `cJSON Call Graph`
      - `.git` 확장자를 제거하고 마지막 path 조각(`repo` 이름)만 추출해 타이틀에 사용합니다.
      - URL이 파싱되지 않으면 `Backend Call Graph`로 표시됩니다.
  - 타이틀 우측:
    - **Show overview / Hide overview** 버튼
      - 클릭하면 선택한 함수들에 대한 Function Overview 카드(오른쪽 패널 상단 부근에 띄워지는 상세 카드)를 열거나 닫습니다.
      - 카드가 열린 상태에서는 `Hide overview`, 닫힌 상태에서는 `Show overview`로 표시됩니다.
      - 두 개의 함수 비교 모드에서는 왼쪽/오른쪽 Call Graph 각각에 대해 독립적으로 토글됩니다.
        - 왼쪽 그래프의 버튼은 첫 번째 함수의 overview만,
        - 오른쪽 그래프의 버튼은 두 번째 함수의 overview만 제어합니다.

- **그래프 초기화 버튼**
  - Warnings 페이지 우측 상단의 `그래프 초기화` 버튼:
    - 현재 선택된 함수들(`manualSelection`)과 `selectedFunction`, overview 창 상태, Call Graph 검색 이름 등을 모두 초기화합니다.
    - 내부적으로 `CallGraphWebGL`을 다시 마운트하여:
      - 서브그래프 검색 상태, `isSubgraphMode`, `searchTerm` 등이 전부 초기화되고,
      - **가장 처음 화면과 동일한 전체 콜 그래프**가 다시 렌더링됩니다.

### Function Overview 동작

- **Overview 카드 열기**
  - Call graph 모드에서 함수들을 선택한 상태에서, Call Graph 패널 헤더의 `Show overview` 버튼을 누르면,
    - 선택된 함수 각각에 대해 “Function Overview” 카드가 오른쪽 패널 안에 떠서 상세 정보를 표시합니다.
  - 카드 내용:
    - 함수명, complexity, call count, warningCount, degree, file path
    - Warning Breakdown (High/Medium/Low 개수)
    - 최근 경고 목록 (최대 5개)

- **카드 위치 및 정렬**
  - 두 개의 함수를 선택한 경우:
    - 첫 번째 함수의 overview 카드는 화면의 왼쪽 상단 영역에,
    - 두 번째 함수의 overview 카드는 화면의 오른쪽 상단 영역에 기본 배치됩니다.
  - 카드는 드래그로 세로 방향으로 위치를 조정할 수 있습니다.

- **카드 닫기와 버튼 상태**
  - 카드 상단의 `▼` 버튼으로 overview를 최소화하면:
    - 해당 함수의 overview 상태가 `'maximized'` → `'minimized'`로 바뀌며 카드가 사라집니다.
    - Call Graph 패널의 버튼은 자동으로 `Show overview` 상태로 돌아갑니다.

### Call Graph 검색 / 센터링 동작

- **함수 검색 및 서브그래프**
  - Call Graph 패널에서 함수명을 입력하고 `Enter` 또는 `Search` 버튼을 누르면:
    - 해당 함수와 1-hop 이웃 노드(호출/피호출 관계)를 포함한 서브그래프를 추출합니다.
    - 서브그래프 모드에서는:
      - 선택된 함수와 이웃 노드들만 표시되며,
      - 상단 Edge Filter(All / Incoming / Outgoing)로 서브그래프 내의 링크를 필터링할 수 있습니다.
  - 매칭되는 함수가 없으면:
    - `alert("No functions found matching \"...\"")`가 표시됩니다.

- **선택된 함수 중심으로 뷰 맞추기**
  - 프리셋 함수 목록에서 함수 2개를 선택한 비교 모드에서는,
    - 왼쪽 Call Graph는 첫 번째 선택 함수,
    - 오른쪽 Call Graph는 두 번째 선택 함수
    를 기준으로 서브그래프를 그립니다.
  - 서브그래프 레이아웃이 안정된 뒤:
    - 선택된 함수 노드가 캔버스 중앙에 오도록 `centerAt` + `zoom`을 수행합니다.
    - 이후 `onEngineStop`에서 자동으로 카메라를 다시 움직이지 않도록 하여, 뷰가 갑자기 튀지 않고 선택 함수가 중앙에 유지됩니다.

### 노드 우클릭 컨텍스트 메뉴 (함수명 복사)

- Call Graph에서 개별 함수 노드 위에서 마우스를 **우클릭**하면,
  - 노드 위치 근처에 작은 컨텍스트 메뉴가 나타나고,
  - 함수명이 한 줄로 표시된 뒤 `Copy function name` 버튼이 제공됩니다.
- 버튼을 클릭하면:
  - 브라우저가 지원하는 경우 `navigator.clipboard.writeText`를 사용해 함수명을 클립보드에 복사하고,
  - 그렇지 않은 환경에서는 숨겨진 `<textarea>`를 이용해 `document.execCommand('copy')`로 복사합니다.
  - 복사 후 컨텍스트 메뉴는 자동으로 닫힙니다.

### Metrics Heatmap 툴팁 및 Warning score 정의

- Radar/Heatmap 모드에서 우측에 표시되는 **Metrics Heatmap** 헤더 옆에는 `i` 아이콘이 있습니다.
  - 아이콘 위에 마우스를 올리면 각 메트릭의 정의를 설명하는 툴팁이 나타납니다.
    - `NLOC`: 함수의 유효 코드 라인 수 (Number of Lines of Code)
    - `CCN`: 순환 복잡도 (Cyclomatic Complexity)
    - `In degree`: 해당 함수를 호출하는 다른 함수 수
    - `Out degree`: 해당 함수가 호출하는 다른 함수 수
    - `Warning score`: 심각도 가중치를 적용한 경고 점수
      - 공식:
        - `Warning score = High × 3 + Medium × 2 + Low × 1`
  - Heatmap 셀 색상은 각 메트릭별 상대적인 크기에 따라 랭크 기반 팔레트로 결정됩니다.

## 프로젝트 구조

```
src/
├─ components/
│  ├─ CallGraphWebGL.jsx   # WebGL 기반 콜 그래프 (local/backend 공통)
│  ├─ Navbar.jsx           # Local/Backend 모드 토글 + GitHub URL 입력
│  └─ …                    # 레이아웃 및 공용 UI 컴포넌트
├─ pages/
│  ├─ WarningsPage.jsx     # RefaVis 핵심 화면 (프리셋, 함수 리스트, 그래프)
│  ├─ CallGraphPage.jsx    # 향후용 함수 단일 상세 그래프 페이지 (placeholder)
│  └─ ComparisonPage.jsx   # 함수 비교 화면
├─ main.jsx / App.jsx      # 앱 엔트리 포인트 + 모드/백엔드 상태 관리
└─ assets/ …               # 정적 리소스
```

TypeScript 없이 **JavaScript**와 ES 모듈, JSX 조합을 사용합니다.

---

## 커스터마이징 팁

- **데이터 교체**: `src/mockData.json`을 실제 분석 결과로 바꿀 수 있습니다. 기존 스키마( warnings/functions/nodes/edges )를 유지하거나 `mockData.js` 로직을 수정하세요.
- **브랜딩 변경**: Tailwind 클래스는 JSX에 직접 들어 있습니다. 전역 팔레트를 바꾸고 싶다면 `tailwind.config.js`에서 테마 색상을 수정하세요.
- **추가 패널**: 좌측 패널 하단 영역은 비워 두었으므로, `components/`에 “Function Detail”과 같은 컴포넌트를 추가한 뒤 그래프 옆/아래에 마운트해 확장할 수 있습니다. 프리셋 정의와 필터 로직은 `src/pages/WarningsPage.jsx`에서 함께 조정하면 됩니다.

---

## 개발 메모

- ESLint는 `eslint.config.js`에 현대식 플랫 설정으로 구성되어 있습니다. `npm run lint` 명령은 해당 설정에서 참조하는 `@typescript-eslint/*` 패키지가 필요하므로, 린팅을 사용하려면 별도로 설치해야 합니다.
- 최상단 라우팅은 `App.jsx`의 React Router가 담당합니다. 현재 `/warnings`만 동작하지만 `/function/:id`, `/graph/:id`, `/compare` 경로가 향후 확장을 위해 준비되어 있습니다.

---
