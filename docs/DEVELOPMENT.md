# 반듯 — 웹캠 자세 지킴이

> 하루 9.3시간, 앉아서 보내는 시간. **반듯**은 웹캠으로 앉은 자세를 지켜보다가
> 무너지는 순간에만 조용히 개입하는 자세 교정 서비스입니다.

- **온디바이스 판정** — 영상은 실시간으로 어디에도 전송되지 않고, 판정은 전부 브라우저 안에서 처리됩니다.
- **조용한 개입** — 평상시엔 구석의 미니 위젯뿐. 무시할수록 위젯 → 토스트 → 전체 화면으로 개입이 세집니다.
- **맞춤 스트레칭** — 감지된 문제(거북목·어깨 기울어짐 등)에 맞는 동작을 골라 카메라로 실시간 판정하며 따라 합니다.

---

## 1. 실행

```bash
npm install
cp .env.example .env   # 서버 주소 설정 — 필수
npm run dev            # http://localhost:5173
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (HMR) |
| `npm run build` | 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |

### 환경변수 (.env)

| 변수 | 용도 | 기본값 |
|---|---|---|
| `VITE_API_BASE` | 앱 서버(Spring) — 인증·리포트·통계 | `http://localhost:8080` |
| `VITE_AI_API_BASE` (또는 `VITE_AI_URL`) | AI 서버(FastAPI) — 캘리브레이션 baseline 등록 | `.env.example` 참고 |

`VITE_AI_API_BASE`를 비우면 AI 서버 없이도 전체 기능이 로컬 판정만으로 동작합니다.

### 데모 순서 (해커톤 시연용)

1. 제품 키 입력 (`/key`, 로컬 기본 키 **9999**) → 회원가입/로그인
2. 온보딩: 카메라 연결 → 자세 가이드 → **기준 자세 3초 홀드 캡처**
3. 모니터링 화면에서 자세를 무너뜨려 보기 → 위젯(즉시) → 토스트(5초) → 전체 화면(15초, 설정 옵트인)
4. 토스트의 "○○ 하기" 버튼 → 해당 스트레칭 세션으로 딥링크 → 카메라 실시간 판정으로 완료
5. 모니터링 종료 → 세션 요약(`/summary`) → 리포트(`/report`)

---

## 2. 시스템 구성

```
┌─────────────────────────────────────────────┐
│  프론트 (이 레포, React+Vite, → Tauri 예정)     │
│  · MediaPipe Pose 온디바이스 추론 (wasm 로컬)   │
│  · 자세 판정 = posture.py 포팅판 (전부 로컬)     │
│  · 1분 집계만 서버로 전송                       │
└──────┬──────────────────────────┬───────────┘
       │ JWT (Bearer)             │ 캘리브레이션 한 컷
       ▼                          ▼
┌──────────────────┐   ┌──────────────────────┐
│ 앱 서버 (Spring)   │   │ AI 서버 (FastAPI)      │
│ :8080             │   │ :8000                 │
│ · 인증/회원        │   │ · /api/calibrate      │
│ · 리포트 집계/조회  │──▶│ · 리포트 LLM 분석      │
│ · 1분 통계 수집*    │   │   (Spring이 호출)     │
└──────────────────┘   └──────────────────────┘
```

- 실시간 판정에 서버가 개입하지 않으므로 **서버가 죽어도 모니터링·경고는 동작**합니다.
- `*` `POST /api/monitor/stats`(1분 집계 수집)는 백엔드 신규 API — 스키마는 `src/lib/statsReporter.js` 상단 주석.
- 스펙 문서: 앱 서버 `docs/api-spec.md`, AI 서버 `docs/ai-server-api-spec.md`

---

## 3. 라우팅

라이브러리 없이 History API 미니 라우터(`src/state/RouterContext.jsx`).
인증/캘리브레이션 상태에 맞지 않는 경로는 `App.jsx`의 가드가 자동 교정합니다.

| 경로 | 화면 | 비고 |
|---|---|---|
| `/key` → `/login` `/signup` | 제품 키 게이트 → 인증 | 키 확인은 localStorage에 기억 |
| `/onboarding` | 캘리브레이션 | 뷰 선택(정면/좌·우대각) 포함 |
| `/monitor` | 메인 모니터링 | 점수 링·부위별 미터·격자+스켈레톤 |
| `/stretch` · `/stretch/<동작id>` | 스트레칭 목록 · 동작별 세션 | 세션 URL 공유/딥링크 가능 |
| `/report` | 주 단위 리포트 → 일간 상세 | 백엔드 `/api/reports/*` 연동 |
| `/summary` | 모니터링 종료 요약 | 사이드바에 없음 |
| `/environment` `/alerts` `/settings` | 환경 가이드 · 알림 데모 · 설정 | |
| `/widget` | 위젯 모드 | 트레이 전용 상태 시뮬레이션 |

---

## 4. 자세 판정 파이프라인 (온디바이스)

```
카메라 → 히든 비디오(화면 무관 프레임 공급)
  → MediaPipe Pose Landmarker (wasm, 33개 관절)     ... 2초/1틱
  → 지표 계산 + EMA 평활화 (α=0.6)
  → 기준 자세 대비 편차 판정 (posture.py 포팅판)
  → AlertTracker 상태머신 → 경고 단계 → UI/알림음
  → 1분 집계 버퍼 → POST /api/monitor/stats
```

핵심 파일: **`src/lib/postureDetector.js`** — AI 레포 `app/core/posture.py` + `config.py`의 JS 포팅판.
같은 입력에 같은 출력을 내는지 골든 테스트로 검증했습니다.
**⚠ 판정 수식·임계값을 바꿀 땐 파이썬(AI 레포)과 JS를 함께 바꿔야 합니다.**

- **지표 6종**: `neck_tilt`(거북목·목 기울임) `shoulder_tilt` `head_down` `lean_in` `lean_out` `shift_x`
- **score** = 최대 편차 비율 (0=완벽, 1.0↑=임계 초과) → UI 표시는 0~100점 환산
- **경고 단계 매핑**: 나쁜 자세 1.5초 → `warn1`(위젯만) / 5초 → `warn2`(토스트) / 15초 → `warn3`(전체 화면)
- **민감도 슬라이더**(설정): 임계값 배율 2.0×(느슨)~0.5×(민감), 기본 50 = 서버 medium과 동일
- **자리 비움**: 비운 시간은 경고 지속시간에서 제외, **5초 이상 비우면 자동 일시정지**(카메라 끄기 + 전용 안내)
- **일시정지 ↔ 카메라 동기화**: 일시정지하면 카메라 꺼짐, 카메라를 끄면 일시정지 (양방향)

### 서버(posture.py)와 의도적으로 달라진 지점

| 항목 | 서버 | 프론트 | 이유 |
|---|---|---|---|
| 어깨 기울기 임계 | 7° | **9°** | 과민 완화 |
| 목→어깨 간섭 보정 | 없음 | **있음** (상대 머리 기울기 초과분 0.35 차감) | lite 모델이 목만 꺾어도 어깨 랜드마크가 따라 흔들림 |
| strictness | low/medium/high | **연속 배율**(슬라이더) | UX |
| 가이드 정합 | 앵커 5점 각 0.09 | 어깨 중심+거리만 (guides.js) | 체형 차이 과민 |

---

## 5. 캘리브레이션 (기준 자세)

한 장 캡처가 아니라 **3초 홀드 평균** 방식입니다 (`src/screens/Onboarding.jsx`):

1. 뷰 선택 (정면/좌대각/우대각) — 실루엣은 시각 가이드(판정 없음)
2. 라이브 체크 3종: 어깨 수평 ≤6° · 고개 기울임 ≤6° · 목 곧게 ≤8° (+상반신 가시성)
3. **체크가 모두 충족되면 자동으로 홀드 시작** — 150ms마다 스켈레톤을 스택
4. 3초 유지 성공 → 스택 **좌표 평균**을 기준 자세로 저장 (노이즈 상쇄)
5. **중간에 체크가 하나라도 풀리면 스택·타이머 초기화** (감쇠 없음, 처음부터)
6. 완료 시 AI 서버 `POST /api/calibrate`로 한 컷 등록 → `baseline_id` 보관
   (서버도 스켈레톤만 저장 — 이미지 저장 없음. 이 호출이 실패해도 로컬 판정은 정상 동작)

기준 자세는 메모리에만 있어 새로고침 시 재캘리브레이션이 필요합니다(프로토타입 의도).

---

## 6. 스트레칭

앉아서 하는 상반신 6종 — **id·판정 기준을 AI 서버 카탈로그와 통일**했습니다.

| id | 동작 | 유지 | 판정 |
|---|---|---|---|
| `neck_side_left/right` | 목 옆 늘리기 | 10초 | 어깨 대비 머리 기울기 ≥13° + 어깨 수평 |
| `chin_tuck` | 턱 당기기 | 8초 | 코-귀선 하강폭(세션 이완 기준 5%↑, 16%↑는 고개 숙임으로 가드) |
| `shoulder_shrug` | 어깨 으쓱하기 | 6초 | 귀-어깨 거리 상승률 18%↑ (적응형·1초 워밍업) |
| `chest_opener` | 가슴 열기 | 10초 | 손목 간격 ≥ 어깨너비 1.7배 + 어깨 높이 |
| `arms_up` | 팔 위로 뻗기 | 8초 | 양 손목이 코보다 위 + 몸통 수직 |

- 모든 동작은 **카메라 자동 켜짐** + 스켈레톤 오버레이. 조건 유지 게이지가 차면 자동 완료(이탈 시 감쇠).
- **모션 가이드**: 정면(카메라 판정 기준과 일치)·측면(깊이 방향 이해) 2패널 루프 애니메이션(3초 왕복, 목표 자세 유지).
  시선·호흡처럼 그림으로 표현 불가한 항목은 "체크포인트 — 동시에 지켜주세요" 리스트로 분리.
- **추천**: 감지된 issue를 심각도 가중 점수로 매겨 **상위 2개만** 추천 (문제가 없으면 추천 없음).
- 경고 토스트/오버레이에서 해당 동작 세션으로 **딥링크** (`/stretch/<id>`).
- 어깨 으쓱의 고정 기준(서버) vs 적응형(프론트) 방식 통일은 AI팀 결정 대기.

---

## 7. 경고 · 알림

- 3단계 에스컬레이션: ① 위젯 색·실루엣 변화(무개입) ② 토스트 + 맞춤 스트레칭 제안 ③ 전체 화면(**설정 옵트인**, 기본 꺼짐)
- 알림 강도 상한·알림음(차임/우드/펀니(`static/funny_alarm.wav`)/무음)·조용한 시간대는 설정에서
- `알림 단계` 화면에서 각 단계를 데모 버튼으로 확인 가능
- 위젯은 색뿐 아니라 **단계 도트(1~3칸)**를 함께 표시 (색각 접근성)

---

## 8. 서버 연동 현황

| API | 방향 | 상태 |
|---|---|---|
| 인증 (`/api/product-key/verify` `/api/signup` `/api/login` `/api/me`) | → Spring | ✅ 연동 |
| 리포트 (`/api/reports/dashboard` `/daily` `/calendar` `/daily/analyze`) | → Spring | ✅ 연동 |
| 1분 집계 (`POST /api/monitor/stats`) | → Spring | ⚠ **백엔드 신규 API 필요** — 실패 시 큐(30분치) 보관·재시도, 탭 종료 시 keepalive 플러시 |
| 캘리브레이션 (`POST /api/calibrate`) | → AI | ✅ 연동 (캘리브레이션 완료 시 한 컷) |
| 리포트 LLM 분석 (`/api/report/daily/analyze`) | Spring → AI | 백엔드 경유 |

---

## 9. 디렉토리 구조

```
src/
  state/
    AppContext.jsx        전역 상태 · 감지 루프 · 경고 상태머신 · 1분 집계 · 자리비움 자동정지
    AuthContext.jsx       제품 키 게이트 + JWT 세션 (/api/me 검증)
    RouterContext.jsx     History API 미니 라우터
  lib/
    postureDetector.js    ★ 판정 엔진 — posture.py 포팅판 (수정 시 AI 레포와 동기화!)
    poseRules.js          스트레칭 동작 판정 룰 + 스켈레톤 오버레이 드로잉
    guides.js             캘리브레이션 가이드 정합 (guides.py 포팅, 완화판)
    statsReporter.js      1분 집계 전송기 (큐·재시도·keepalive) + payload 스키마
    api.js                앱 서버 클라이언트 (인증·리포트)
    aiApi.js              AI 서버 클라이언트 (calibrate·프레임 캡처)
    sound.js / format.js  알림음(WebAudio+wav) · 시간 포맷
  hooks/
    useCamera.js          getUserMedia 상태 머신 (권한/점유/없음 전부 처리)
    usePoseLandmarker.js  MediaPipe Pose 로더 (모듈 캐시, GPU→CPU 폴백)
  components/             Widget · AlertLayer · CameraView · DebugPanel · charts · ui
  screens/                Auth · Onboarding · Monitor · Stretch · Report · Summary
                          · Environment · AlertsDemo · Settings
  data/dummy.js           스트레칭 카탈로그 · 자세 메타 · (리포트 더미)
public/mediapipe-wasm/    MediaPipe wasm (로컬 서빙 — Tauri 대비)
static/funny_alarm.wav    커스텀 알림음 (번들 에셋)
docs/                     api-spec.md · ai-server-api-spec.md · project-plan.md
```

---

## 10. 개발 팁 · 주의사항

- **DEV 패널** (좌측 하단): 자세 상태 수동 토글, 스트레칭 제안 트리거, 세션 리셋 — 판정 없이 UI 데모할 때 사용
- **rAF 대신 setInterval**: 탭이 비활성화돼도 감지가 돌아야 하므로. 주기: 판정 2초 / 모니터 스켈레톤 그리기 0.3초 / 스트레칭 판정 0.1초 / 캘리브레이션 0.15초
- **판정 틱을 바꾸면 EMA 계수도 함께** (`AppContext.jsx` 상단 주석 참고: 2초→α 0.6, 0.5초→α 0.25)
- MediaPipe 모델 `.task`(~5.5MB)만 최초 1회 구글 CDN에서 받습니다 — 오프라인 배포 시 로컬로 교체
- 테스트 계정 없이 캘리브레이션하면 AI baseline이 `user_id=1`로 등록되어 서로 덮어씁니다 — 각자 로그인 후 진행
- Tailwind v4 사용 — v3식 선행 `!` important는 동작하지 않습니다
- 나중에 **Tauri**로 감쌀 예정이므로 브라우저 전용 API에 강하게 의존하지 말 것
