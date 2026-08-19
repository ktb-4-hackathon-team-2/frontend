// AI 레포(app/core/posture.py + app/config.py)를 JS로 포팅한 온디바이스 판정기.
// 지표 수식·임계값·경고 상태머신을 서버 구현과 동일하게 유지한다.
// 원본: github.com/ktb-4-hackathon-team-2/AI @ main — 수식을 바꿀 땐 양쪽을 함께 바꿀 것.

// ── config.py ────────────────────────────────────────────────────────
// 모니터링 판정에 쓰는 기본 임계값 (strictness=medium 기준)
export const THRESHOLDS = {
  neck_tilt_deg: 12.0, // 목 기울기 변화 허용치 (도)
  shoulder_tilt_deg: 9.0, // 어깨 기울기 변화 허용치 (도) — 원본 config.py는 7.0, 과민해서 완화

  head_down_drop: 0.18, // 머리 숙임: baseline 대비 비율 감소 허용치
  lean_ratio: 0.13, // 어깨 너비 변화율(가까워짐/멀어짐) 허용치
  shift_x: 0.12, // 좌우 이동 허용치 (정규화 좌표)
}

// "얼마나 엄격하게 경고할지" — 임계값에 곱해지는 배율
export const STRICTNESS_SCALE = { low: 1.4, medium: 1.0, high: 0.7 }

// 나쁜 자세가 지속됐을 때 경고 단계가 올라가는 시간(초)
export const DEFAULT_WARN_AFTER_SEC = 5.0 // level 1: 팝업 경고
export const DEFAULT_ALARM_AFTER_SEC = 15.0 // level 2: 강한 경고

// ── posture.py ───────────────────────────────────────────────────────
const LM = { NOSE: 0, LEFT_EAR: 7, RIGHT_EAR: 8, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12 }

// 자세 판정에 반드시 보여야 하는 랜드마크
const REQUIRED_IDS = [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]
const MIN_VISIBILITY = 0.5

const deg = (rad) => (rad * 180) / Math.PI
// 파이썬 %는 항상 양수를 반환 — JS %와 다르므로 맞춰준다
const pymod = (a, n) => ((a % n) + n) % n
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const pt = (lm) => [lm.x, lm.y]

export function visibilityOk(landmarks) {
  return REQUIRED_IDS.every((i) => (landmarks?.[i]?.visibility ?? 0) >= MIN_VISIBILITY)
}

/** 정규화 좌표 기반 자세 지표 — 어깨 너비로 나눠 카메라 거리와 무관하게 만든 값들 */
export function computeMetrics(landmarks) {
  const ls = pt(landmarks[LM.LEFT_SHOULDER])
  const rs = pt(landmarks[LM.RIGHT_SHOULDER])
  const le = pt(landmarks[LM.LEFT_EAR])
  const re = pt(landmarks[LM.RIGHT_EAR])
  const nose = pt(landmarks[LM.NOSE])

  const sw = distance(ls, rs) || 1e-6 // 어깨 너비 = 거리 프록시
  const sc = mid(ls, rs) // 어깨 중심
  const ec = mid(le, re) // 귀 중심 (머리 위치)

  // 어깨선이 수평에서 얼마나 기울었는지 (도, -90~90)
  let shoulderTilt = deg(Math.atan2(rs[1] - ls[1], rs[0] - ls[0]))
  shoulderTilt = pymod(shoulderTilt + 90, 180) - 90

  // 귀 중심→어깨 중심 벡터가 수직에서 기운 각도 (거북목/목 기울기)
  const neckDx = ec[0] - sc[0]
  const neckDy = sc[1] - ec[1] // 위쪽이 양수
  const neckTilt = neckDy !== 0 ? deg(Math.atan2(neckDx, neckDy)) : 0.0

  // 귀선 기울기 (머리 좌우로 갸웃한 정도)
  let headRoll = deg(Math.atan2(re[1] - le[1], re[0] - le[0]))
  headRoll = pymod(headRoll + 90, 180) - 90

  return {
    shoulder_width: sw,
    shoulder_tilt_deg: shoulderTilt,
    neck_tilt_deg: neckTilt,
    head_roll_deg: headRoll,
    head_down: (sc[1] - nose[1]) / sw, // 작아질수록 머리를 숙인 것
    head_forward: neckDx / sw, // 대각선 뷰에서 앞뒤 이동이 드러남
    center_x: sc[0],
    center_y: sc[1],
  }
}

const round3 = (v) => Math.round(v * 1000) / 1000

/**
 * 현재 지표를 baseline과 비교해 문제 목록과 종합 점수를 낸다.
 * score: 최대 편차 비율 (0=완벽, 1.0 이상 = 임계치 초과)
 */
export function evaluateAgainstBaseline(metrics, baselineMetrics, strictness = 'medium') {
  // 파이썬 원본은 low/medium/high 이름만 받지만, 프론트는 민감도 슬라이더를 위해
  // 숫자 배율(0.7~1.4)도 허용한다 — 숫자가 작을수록 민감.
  const scale = typeof strictness === 'number' ? strictness : (STRICTNESS_SCALE[strictness] ?? 1.0)
  const b = baselineMetrics
  const issues = []
  const deviations = {}

  const check = (code, value, threshold, message) => {
    const limit = threshold * scale
    const ratio = limit ? Math.abs(value) / limit : 0.0
    deviations[code] = round3(ratio)
    if (ratio >= 1.0) {
      issues.push({ code, message, severity: Math.min(ratio, 3.0) })
    }
    return ratio
  }

  check(
    'neck_tilt', metrics.neck_tilt_deg - b.neck_tilt_deg,
    THRESHOLDS.neck_tilt_deg, '목이 기울거나 앞으로 나왔어요 (거북목 주의)',
  )

  // 목-어깨 판정 분리 보정 (원본 posture.py에는 없음 — lite 모델 한계 대응):
  // 목만 꺾으면 어깨 랜드마크가 몇 도씩 따라 흔들려 어깨 판정이 같이 내려간다.
  // "어깨선 대비 머리 상대 기울기"가 어깨 변화량을 초과하는 만큼(목이 주도한 만큼)만
  // 어깨 편차에서 깎는다. 몸 전체가 기울면 상대 기울기≈0이라 보정이 걸리지 않고,
  // 머리를 수평으로 유지한 채 어깨만 틀면 초과분이 없어 감지가 그대로 유지된다.
  const shoulderDeltaRaw = metrics.shoulder_tilt_deg - b.shoulder_tilt_deg
  const relHeadRoll =
    metrics.head_roll_deg - metrics.shoulder_tilt_deg - (b.head_roll_deg - b.shoulder_tilt_deg)
  const bleed = 0.35 * Math.max(0, Math.abs(relHeadRoll) - Math.abs(shoulderDeltaRaw))
  const shoulderDelta = Math.sign(shoulderDeltaRaw) * Math.max(0, Math.abs(shoulderDeltaRaw) - bleed)
  check('shoulder_tilt', shoulderDelta, THRESHOLDS.shoulder_tilt_deg, '어깨가 한쪽으로 기울었어요')
  // head_down은 '감소'만 문제 (머리를 숙임)
  const drop = (b.head_down - metrics.head_down) / Math.max(Math.abs(b.head_down), 1e-6)
  check('head_down', Math.max(drop, 0.0), THRESHOLDS.head_down_drop, '고개를 숙이고 있어요')

  const lean = metrics.shoulder_width / Math.max(b.shoulder_width, 1e-6) - 1.0
  if (lean > 0) {
    check('lean_in', lean, THRESHOLDS.lean_ratio, '화면에 너무 가까워요 (앞으로 기울었어요)')
    deviations.lean_out ??= 0.0
  } else {
    check('lean_out', lean, THRESHOLDS.lean_ratio, '기준 자세보다 뒤로 처져 있어요')
    deviations.lean_in ??= 0.0
  }
  check('shift_x', metrics.center_x - b.center_x, THRESHOLDS.shift_x, '기준 위치에서 좌우로 벗어났어요')

  const score = round3(Math.max(0, ...Object.values(deviations)))
  return {
    posture_ok: issues.length === 0,
    score,
    issues,
    deviations,
  }
}

/**
 * 나쁜 자세 지속 시간에 따라 경고 단계를 올리는 상태머신.
 * level 0: 정상 / level 1: 팝업 경고 / level 2: 강한 경고(알람).
 */
export class AlertTracker {
  constructor(warnAfter = DEFAULT_WARN_AFTER_SEC, alarmAfter = DEFAULT_ALARM_AFTER_SEC) {
    this.warnAfter = warnAfter
    this.alarmAfter = alarmAfter
    this.badSince = null
    this.lastSeen = null
  }

  /** @param {boolean} postureOk @param {number} now 초 단위 timestamp */
  update(postureOk, now = Date.now() / 1000) {
    // 프레임 간격이 너무 길면(모니터링 중단 등) 지속시간 리셋
    if (this.lastSeen !== null && now - this.lastSeen > 30.0) {
      this.badSince = null
    }
    this.lastSeen = now

    if (postureOk) {
      this.badSince = null
      return { alert_level: 0, bad_duration_sec: 0.0, alarm: false }
    }

    if (this.badSince === null) this.badSince = now
    const duration = now - this.badSince
    const level = duration >= this.alarmAfter ? 2 : duration >= this.warnAfter ? 1 : 0
    return {
      alert_level: level,
      bad_duration_sec: Math.round(duration * 10) / 10,
      alarm: level >= 2,
    }
  }

  /** 자리 비움/미검출 프레임: 비운 시간은 나쁜 자세 지속시간에서 제외 */
  noteAbsence(now = Date.now() / 1000) {
    if (this.badSince !== null && this.lastSeen !== null) {
      this.badSince += now - this.lastSeen
    }
    this.lastSeen = now
  }
}

// ── UI 표시용 변환 (프론트 전용 — 서버 포팅 아님) ─────────────────────
// score(편차 비율)를 0~100 점수로: 0→100점, 임계치(1.0)→55점, 2.0+→10점
export function toDisplayScore(score) {
  return Math.max(5, Math.round(100 - Math.min(score ?? 0, 2) * 45))
}

// 부위별 미터: 관련 편차 중 최악을 부위 점수로 환산
export function toRegionScores(deviations = {}) {
  const worst = (...codes) => Math.max(0, ...codes.map((c) => deviations[c] ?? 0))
  return {
    head: toDisplayScore(worst('neck_tilt', 'head_down')),
    shoulder: toDisplayScore(worst('shoulder_tilt')),
    torso: toDisplayScore(worst('lean_in', 'lean_out', 'shift_x')),
  }
}
