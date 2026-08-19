// 방식 1: 관절 각도 룰 기반 스트레칭 판정.
// 스트레칭마다 목표 자세를 몇 개의 각도 조건으로 정의하고,
// 전부 충족한 상태를 HOLD_MS 동안 유지하면 한 세트로 센다.

export const HOLD_MS = 4000

// PoseLandmarker 랜드마크 인덱스 (person 기준 left/right)
const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
}

const deg = (rad) => (rad * 180) / Math.PI

// 두 랜드마크를 잇는 선이 수평과 이루는 각도 (이미지 좌표계, y는 아래로 증가)
function lineAngle(a, b) {
  return deg(Math.atan2(b.y - a.y, b.x - a.x))
}

const vis = (p) => (p.visibility ?? 1) > 0.5

// ── 목 옆 늘리기 ─────────────────────────────────────────────────────
// 어깨 선 기준 머리(귀 선)의 상대 기울기로 판정. 좌우를 번갈아 해야 다음 세트로 넘어간다.
// 미러 여부와 무관하도록 절대 방향(왼쪽/오른쪽)은 지시하지 않고 "반대쪽"만 요구한다.
function evalNeckSide(lm, { lastSide, rep }) {
  const le = lm[LM.leftEar]
  const re = lm[LM.rightEar]
  const ls = lm[LM.leftShoulder]
  const rs = lm[LM.rightShoulder]
  const visible = [le, re, ls, rs].every(vis)

  const headAngle = lineAngle(re, le)
  const shoulderAngle = lineAngle(rs, ls)
  const tilt = headAngle - shoulderAngle // 어깨 기준 상대 기울기
  const side = tilt > 0 ? 'a' : 'b'
  const needOpposite = rep > 1 && lastSide != null

  const conds = [
    { id: 'visible', label: '어깨까지 프레임 안에', ok: visible },
    {
      id: 'tilt',
      label: '머리를 옆으로 깊게 (18° 이상)',
      ok: visible && Math.abs(tilt) >= 18,
      value: visible ? `${Math.abs(tilt).toFixed(0)}°` : null,
    },
    {
      id: 'shoulder',
      label: '어깨는 수평 유지 (10° 이내)',
      ok: visible && Math.abs(shoulderAngle) <= 10,
      value: visible ? `${Math.abs(shoulderAngle).toFixed(0)}°` : null,
    },
    ...(needOpposite ? [{ id: 'switch', label: '이전과 반대쪽으로', ok: side !== lastSide }] : []),
  ]

  let hint = null
  if (!visible) hint = '카메라에 어깨까지 나오게 앉아 주세요'
  else if (needOpposite && side === lastSide && Math.abs(tilt) >= 18) hint = '이번엔 반대쪽으로 기울여 주세요'
  else if (Math.abs(tilt) < 18) hint = '귀가 어깨에 닿는다는 느낌으로 조금 더'
  else if (Math.abs(shoulderAngle) > 10) hint = '어깨가 따라 올라갔어요 — 힘을 빼세요'

  return { conds, all: conds.every((c) => c.ok), side, hint }
}

// 실시간 판정을 지원하는 스트레칭 목록 (정면 웹캠으로 판정 가능한 동작만)
export const POSE_RULES = {
  neckside: evalNeckSide,
}

// ── 스켈레톤 오버레이 ────────────────────────────────────────────────
const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [7, 8],
]
const POINTS = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]

// 미리보기가 거울 모드 + object-cover이므로, 같은 변환으로 그린다
export function drawPose(canvas, video, lm, active) {
  if (!canvas || !video) return
  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, cw, ch)
  if (!lm) return
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(cw / vw, ch / vh)
  const dx = (cw - vw * scale) / 2
  const dy = (ch - vh * scale) / 2
  const px = (p) => ({ x: cw - (dx + p.x * vw * scale), y: dy + p.y * vh * scale })

  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.strokeStyle = active ? 'rgba(62, 201, 143, 0.9)' : 'rgba(255, 255, 255, 0.45)'
  for (const [a, b] of CONNECTIONS) {
    if (!vis(lm[a]) || !vis(lm[b])) continue
    const A = px(lm[a])
    const B = px(lm[b])
    ctx.beginPath()
    ctx.moveTo(A.x, A.y)
    ctx.lineTo(B.x, B.y)
    ctx.stroke()
  }
  ctx.fillStyle = active ? '#3ec98f' : 'rgba(255, 255, 255, 0.7)'
  for (const i of POINTS) {
    if (!vis(lm[i])) continue
    const P = px(lm[i])
    ctx.beginPath()
    ctx.arc(P.x, P.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
}
