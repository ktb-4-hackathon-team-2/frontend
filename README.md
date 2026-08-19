# 반듯 — 자세 지킴이 프로토타입

웹캠으로 앉은 자세를 지켜보다가, 무너지는 순간에만 조용히 개입하는 자세 교정 서비스의
**UI 프로토타입**입니다. 카메라는 실제로 켜지지만 자세 판정(MediaPipe)은 아직 연결하지 않았습니다.

## 실행

```bash
npm install
cp .env.example .env   # 서버 주소 설정 (AI 서버 주소까지 채워져 있음 — 필수)
npm run dev
```

## 프로토타입 범위

- ✅ 카메라: `getUserMedia` 실연결 — 권한 대기/거부/카메라 없음/다른 앱 점유 상태 UI, 장치 선택, 켜기·끄기
- ✅ 감지 루프: `setInterval` 기반 구조만 (탭 비활성화 시에도 동작해야 하므로 rAF를 쓰지 않음) — `src/state/AppContext.jsx`의 `analyzeFrame()`이 MediaPipe가 들어갈 자리
- ✅ 화면 7종: 온보딩/캘리브레이션 → 모니터링 → 알림 3단계 데모 → 스트레칭 → 환경 가이드 → 리포트 → 설정
- ✅ 스트레칭 실시간 판정 1종: **목 옆 늘리기** — MediaPipe Pose Landmarker + 관절 각도 룰(`src/lib/poseRules.js`).
  조건(머리 기울기 ≥18°, 어깨 수평, 좌우 교대)을 4초 유지하면 세트 자동 카운트. 카메라가 꺼져 있으면 타이머 모드로 폴백.
  wasm은 `public/mediapipe-wasm/`(로컬), 모델 `.task`만 최초 1회 구글 CDN에서 로드
- ✅ 상시 미니 위젯(트레이 아이콘이 될 자리) + 위젯 모드
- ✅ URL 라우팅: `/key` `/login` `/signup` `/onboarding` `/monitor` `/report` `/stretch` `/environment` `/alerts` `/settings` `/widget`.
  라이브러리 없이 History API(`src/state/RouterContext.jsx`) — 인증/캘리브레이션 상태에 안 맞는 경로는 자동 리다이렉트
- ❌ 자세 판정: **좌측 하단 DEV 패널**에서 양호/경고1·2·3을 수동 토글 (MediaPipe 결과를 대신함)
- ✅ 인증 연동: 제품 키 게이트 → 회원가입/로그인 → JWT 저장(`docs/api-spec.md` 기준, 백엔드 `localhost:8080` 필요).
  시작 시 저장된 토큰을 `GET /api/me`로 검증하고, 만료/무효면 로그인 화면으로. API 주소는 `VITE_API_BASE`로 변경 가능
- ❌ 결제 없음 — 영상은 어디로도 전송되지 않음

## 판정 엔진 전환 (로컬 ↔ AI 서버)

`.env`(또는 `.env.production`)에 AI 서버 주소를 넣으면 자세 판정이 AI 서버(FastAPI, `docs/ai-server-api-spec.md`)로 전환됩니다.

```bash
# .env.example 참고
VITE_AI_API_BASE=          # 비우면 로컬(브라우저 내) MediaPipe 판정
VITE_AI_API_BASE=http://localhost:8000   # 넣으면 AI 서버 판정
```

- 온보딩 캡처 시 `/api/calibrate`로 baseline 발급 → localStorage 저장
- 모니터링은 `/api/monitor/frame` 1.5초 주기 REST 전송(in-flight guard), 일시정지 시 `/api/monitor/reset`
- 서버 `alert_level` 0/1/2 → 앱 경고 단계 매핑: 자세 무너짐(레벨 0)=위젯, 1=토스트, 2=전체 화면

## 구조

```
src/
  state/AppContext.jsx   앱 전역 상태 + 감지 루프 자리
  hooks/useCamera.js     getUserMedia 상태 머신
  data/dummy.js          더미 점수·2주 리포트 데이터
  components/            위젯, 알림 레이어, 카메라 뷰, 차트, DEV 패널
  screens/               7개 화면
```

나중에 Tauri로 감쌀 예정이라 브라우저 전용 API에는 강하게 의존하지 않습니다.
