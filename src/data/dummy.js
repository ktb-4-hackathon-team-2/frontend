// 자세 판정이 아직 없으므로, 판정 결과 자리를 채우는 더미 데이터.
// StopSlouching을 레퍼런스로: 부위별(머리·어깨·상체) 점수 + 취약 부위 기반 스트레칭 추천.

export const POSTURE_META = {
  good: {
    label: '양호',
    tone: 'good',
    score: 93,
    msg: '바른 자세를 유지하고 있어요',
    regions: { head: 94, shoulder: 91, torso: 95 },
  },
  warn1: {
    label: '주의',
    tone: 'warn1',
    score: 76,
    msg: '머리가 조금씩 앞으로 나오고 있어요',
    regions: { head: 71, shoulder: 82, torso: 88 },
  },
  warn2: {
    label: '경고',
    tone: 'warn2',
    score: 55,
    msg: '거북목 자세가 이어지고 있어요',
    regions: { head: 46, shoulder: 63, torso: 74 },
  },
  warn3: {
    label: '심각',
    tone: 'warn3',
    score: 32,
    msg: '자세가 크게 무너졌어요',
    regions: { head: 24, shoulder: 38, torso: 51 },
  },
}

export const REGION_LABEL = { head: '머리 · 목', shoulder: '어깨', torso: '상체' }

/** 현재 상태에서 가장 취약한 부위 키 */
export function weakestRegion(posture) {
  const r = POSTURE_META[posture].regions
  return Object.keys(r).sort((a, b) => r[a] - r[b])[0]
}

export const TOAST_MSG = {
  warn1: { title: '머리가 앞으로 나오고 있어요', body: '턱을 살짝 당기고, 화면에서 한 뼘 멀어져 볼까요?' },
  warn2: { title: '거북목 자세가 20초째예요', body: '허리를 세우고 어깨를 뒤로 — 지금 고치면 1초면 돼요.' },
  warn3: { title: '자세가 크게 무너졌어요', body: '이대로면 목과 허리에 부담이 쌓여요.' },
}

// ── 리포트: 최근 14일 더미 (오늘 = 2026-08-19 수) ─────────────────────
export const DAYS14 = [
  { d: '8/6', dow: '목', rate: 62, hold: 31 },
  { d: '8/7', dow: '금', rate: 66, hold: 33 },
  { d: '8/8', dow: '토', rate: 61, hold: 30 },
  { d: '8/9', dow: '일', rate: 58, hold: 29 },
  { d: '8/10', dow: '월', rate: 68, hold: 34 },
  { d: '8/11', dow: '화', rate: 71, hold: 36 },
  { d: '8/12', dow: '수', rate: 66, hold: 33 },
  { d: '8/13', dow: '목', rate: 73, hold: 37 },
  { d: '8/14', dow: '금', rate: 70, hold: 35 },
  { d: '8/15', dow: '토', rate: 74, hold: 37 },
  { d: '8/16', dow: '일', rate: 72, hold: 36 },
  { d: '8/17', dow: '월', rate: 80, hold: 40 },
  { d: '8/18', dow: '화', rate: 83, hold: 42 },
  { d: '8/19', dow: '수', rate: 87, hold: 44, today: true },
]

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']
export const WEEK_LAST = { label: '지난주', days: [68, 71, 66, 73, 70, 74, 72] } // 8/10–8/16
export const WEEK_THIS = { label: '이번 주', days: [80, 83, 87] } // 8/17–8/19(오늘)

export const HOURLY = [
  { h: '9시', rate: 81 },
  { h: '10시', rate: 84 },
  { h: '11시', rate: 79 },
  { h: '12시', rate: 70 },
  { h: '13시', rate: 62 },
  { h: '14시', rate: 58 },
  { h: '15시', rate: 66 },
  { h: '16시', rate: 73 },
  { h: '17시', rate: 77 },
  { h: '18시', rate: 71 },
]

export const REPORT_STATS = {
  weekAvg: 83,
  weekDelta: 12, // %p, 지난주(71) 대비
  avgHold: 42, // 시간당 평균 유지(분)
  avgHoldDelta: 6,
  streak: 7, // 목표 70% 연속 달성일
  goal: 70,
}

// ── 스트레칭 — AI 서버 카탈로그(/api/stretch/exercises)와 id 일치 ──────
// 모두 앉아서 하는 동작. targets 는 모니터링 issue code 와 같은 어휘를 쓴다.
export const TARGET_LABEL = {
  neck_tilt: '거북목·목 기울임',
  shoulder_tilt: '어깨 기울어짐',
  head_down: '고개 숙임',
  lean_in: '화면에 붙음',
  lean_out: '뒤로 처짐',
  shift_x: '좌우 이탈',
}

// 로컬 판정 모드에서 부위 점수 → issue code 추천용 매핑
export const REGION_TO_ISSUES = {
  head: ['neck_tilt', 'head_down'],
  shoulder: ['shoulder_tilt'],
  torso: ['lean_in', 'lean_out'],
}

export const STRETCHES = [
  {
    id: 'neck_side_left',
    name: '목 옆 늘리기 (왼쪽)',
    hold: 10,
    targets: ['neck_tilt', 'shoulder_tilt'],
    steps: ['등을 세우고 정면을 봅니다', '왼쪽 귀가 왼쪽 어깨에 닿듯 천천히 기울입니다', '반대쪽 어깨는 끌려 올라가지 않게 눌러 줍니다'],
  },
  {
    id: 'neck_side_right',
    name: '목 옆 늘리기 (오른쪽)',
    hold: 10,
    targets: ['neck_tilt', 'shoulder_tilt'],
    steps: ['등을 세우고 정면을 봅니다', '오른쪽 귀가 오른쪽 어깨에 닿듯 천천히 기울입니다', '반대쪽 어깨는 끌려 올라가지 않게 눌러 줍니다'],
  },
  {
    id: 'chin_tuck',
    name: '턱 당기기',
    hold: 8,
    targets: ['neck_tilt', 'head_down', 'lean_in'],
    steps: ['등을 세우고 정면을 봅니다', '턱을 뒤로 지그시 당겨 이중턱을 만듭니다', '뒤통수를 뒤로 민다는 느낌으로 유지합니다'],
  },
  {
    id: 'shoulder_shrug',
    name: '어깨 으쓱하기',
    hold: 6,
    targets: ['shoulder_tilt'],
    steps: ['양어깨를 귀에 닿을 만큼 끌어올립니다', '그대로 버텼다가', '툭 떨어뜨리며 힘을 완전히 뺍니다'],
  },
  {
    id: 'chest_opener',
    name: '가슴 열기 (양팔 벌리기)',
    hold: 10,
    targets: ['lean_in', 'head_down'],
    steps: ['양팔을 어깨 높이로 넓게 벌립니다', '가슴을 열고 어깨를 뒤로 모읍니다', '시선은 정면, 호흡은 천천히'],
  },
  {
    id: 'arms_up',
    name: '팔 위로 뻗기',
    hold: 8,
    targets: ['head_down', 'shift_x'],
    steps: ['양팔을 귀 옆까지 곧게 뻗어 올립니다', '손끝을 하늘로 민다는 느낌으로', '몸통이 좌우로 기울지 않게 유지합니다'],
  },
]

/** 감지된 issue code 목록(심각한 순)에 맞는 첫 번째 스트레칭 — 경고에서 바로 제안용 */
export function recommendStretch(issueCodes = []) {
  for (const code of issueCodes) {
    const hit = STRETCHES.find((s) => s.targets.includes(code))
    if (hit) return hit
  }
  return null
}

// ── 환경 가이드: 캘리브레이션 프레임 기반 더미 진단 ─────────────────────
export const ENV_CHECKS = [
  {
    id: 'monitor',
    name: '모니터 높이',
    ok: false,
    value: '시선 기준 −8°',
    finding: '화면 상단이 눈높이보다 낮아, 고개가 앞으로 숙여지는 원인이 되고 있어요.',
    fix: '노트북 받침대나 모니터암으로 화면 상단을 눈높이까지 올려 주세요.',
  },
  {
    id: 'distance',
    name: '화면 거리',
    ok: false,
    value: '약 48cm',
    finding: '권장 거리(60–70cm)보다 화면이 가까워요. 가까울수록 머리가 먼저 나갑니다.',
    fix: '의자를 한 뼘 뒤로. 팔을 뻗어 손끝이 화면에 닿을락 말락 한 거리가 적당해요.',
  },
  {
    id: 'chair',
    name: '의자 · 골반',
    ok: true,
    value: '골반 중립',
    finding: '앉은 높이와 골반 각도가 안정적이에요. 지금 세팅을 유지하세요.',
    fix: '무릎 각도 90°, 발바닥이 바닥에 온전히 닿는 상태가 이상적이에요.',
  },
  {
    id: 'camera',
    name: '카메라 각도',
    ok: true,
    value: '정면 −2°',
    finding: '상체가 프레임에 안정적으로 들어와 있어 감지 정확도가 좋아요.',
    fix: '카메라가 화면 상단 중앙에 오도록 유지해 주세요.',
  },
]
