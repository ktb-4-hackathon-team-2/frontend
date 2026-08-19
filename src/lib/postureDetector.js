// 캘리브레이션 기준 자세와 현재 MediaPipe 랜드마크를 비교하는 로컬 판정기.
// 의료적 진단이 아니라, 사용자가 캡처한 기준 자세에서 얼마나 벗어났는지 측정한다.

const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
}

const MIN_VISIBILITY = 0.5
const REQUIRED = [LM.nose, LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function visible(point) {
  return Boolean(point) && (point.visibility ?? 1) >= MIN_VISIBILITY
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function relativePoint(point, origin, scale) {
  return {
    x: (point.x - origin.x) / scale,
    y: (point.y - origin.y) / scale,
  }
}

function lineAngle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

function angleDifference(a, b) {
  let diff = a - b
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return Math.abs(diff)
}

function makeSnapshot(landmarks) {
  if (!landmarks || !REQUIRED.every((index) => visible(landmarks[index]))) return null

  const leftShoulder = landmarks[LM.leftShoulder]
  const rightShoulder = landmarks[LM.rightShoulder]
  const shoulderCenter = midpoint(leftShoulder, rightShoulder)
  const shoulderWidth = Math.max(distance(leftShoulder, rightShoulder), 0.05)
  const leftEar = landmarks[LM.leftEar]
  const rightEar = landmarks[LM.rightEar]
  const head = midpoint(leftEar, rightEar)

  const snapshot = {
    head: relativePoint(head, shoulderCenter, shoulderWidth),
    shoulderAngle: lineAngle(leftShoulder, rightShoulder),
    torso: null,
  }

  const leftHip = landmarks[LM.leftHip]
  const rightHip = landmarks[LM.rightHip]
  if (visible(leftHip) && visible(rightHip)) {
    snapshot.torso = relativePoint(midpoint(leftHip, rightHip), shoulderCenter, shoulderWidth)
  }

  return snapshot
}

function normalizedDrift(current, reference) {
  return distance(current, reference)
}

/**
 * @returns {{status: string, rawLevel: number, score: number|null, reason: string}}
 */
export function assessPosture(landmarks, referenceLandmarks) {
  const current = makeSnapshot(landmarks)
  const reference = makeSnapshot(referenceLandmarks)

  if (!referenceLandmarks) {
    return { status: 'uncalibrated', rawLevel: 0, score: null, reason: '기준 자세를 먼저 캡처해 주세요' }
  }
  if (!current || !reference) {
    return { status: 'lost', rawLevel: 0, score: null, reason: '얼굴과 양쪽 어깨를 찾는 중이에요' }
  }

  const headDrift = normalizedDrift(current.head, reference.head)
  const shoulderDrift = clamp(angleDifference(current.shoulderAngle, reference.shoulderAngle) / (Math.PI / 4), 0, 1)
  const torsoDrift = current.torso && reference.torso ? normalizedDrift(current.torso, reference.torso) : 0

  // 머리 위치 변화에 가장 큰 가중치를 주고, 어깨 기울기와 상체 위치를 보조 지표로 사용한다.
  const drift = clamp(headDrift * 0.55 + shoulderDrift * 0.2 + torsoDrift * 0.25, 0, 1)
  const rawLevel = drift >= 0.32 ? 3 : drift >= 0.2 ? 2 : drift >= 0.11 ? 1 : 0
  const score = Math.round(100 - clamp(drift / 0.4, 0, 1) * 68)

  return {
    status: 'tracking',
    rawLevel,
    score,
    reason: rawLevel === 0 ? '기준 자세를 잘 유지하고 있어요' : '기준 자세에서 벗어나고 있어요',
    metrics: { headDrift, shoulderDrift, torsoDrift, drift },
  }
}
