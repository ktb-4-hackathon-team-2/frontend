# 반듯 — 자세 지킴이 프로토타입

웹캠으로 앉은 자세를 지켜보다가, 무너지는 순간에만 조용히 개입하는 자세 교정 서비스의
**UI 프로토타입**입니다. 카메라는 실제로 켜지지만 자세 판정(MediaPipe)은 아직 연결하지 않았습니다.

## 실행

```bash
npm install
npm run dev
```

## 프로토타입 범위

- ✅ 카메라: `getUserMedia` 실연결 — 권한 대기/거부/카메라 없음/다른 앱 점유 상태 UI, 장치 선택, 켜기·끄기
- ✅ 감지 루프: `setInterval` 기반 구조만 (탭 비활성화 시에도 동작해야 하므로 rAF를 쓰지 않음) — `src/state/AppContext.jsx`의 `analyzeFrame()`이 MediaPipe가 들어갈 자리
- ✅ 화면 7종: 온보딩/캘리브레이션 → 모니터링 → 알림 3단계 데모 → 스트레칭 → 환경 가이드 → 리포트 → 설정
- ✅ 상시 미니 위젯(트레이 아이콘이 될 자리) + 위젯 모드
- ❌ 자세 판정: **좌측 하단 DEV 패널**에서 양호/경고1·2·3을 수동 토글 (MediaPipe 결과를 대신함)
- ❌ 서버/로그인/결제 없음 — 영상은 어디로도 전송되지 않음

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
