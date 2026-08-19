// 스트레칭 동작 판정 룰 (관절 각도·위치 기반, 브라우저 로컬).
// 각 룰은 (landmarks, ctx) → { conds, all, hint } 를 반환하고,
// 조건을 모두 만족한 채 hold 시간을 유지하면 한 동작 완료로 센다.
// prod(AI 서버 모드)에서는 /api/stretch/session/{id}/frame 판정으로 대체될 자리.

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
const lineAngle = (a, b) => deg(Math.atan2(b.y - a.y, b.x - a.x))
const vis = (p) => Boolean(p) && (p.visibility ?? 1) > 0.5
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const cond = (id, label, ok, value = null) => ({ id, label, ok, value })
const pack = (conds, hint) => ({ conds, all: conds.every((c) => c.ok), hint })
const notVisible = () =>
  pack([cond('vis', '상반신이 프레임 안에', false)], '카메라에 얼굴과 어깨가 보이게 앉아 주세요')

function baseParts(lm) {
  if (!lm) return null
  const ls = lm[LM.leftShoulder]
  const rs = lm[LM.rightShoulder]
  const le = lm[LM.leftEar]
  const re = lm[LM.rightEar]
  if (![ls, rs, le, re].every(vis)) return null
  return {
    ls, rs, le, re,
    nose: lm[LM.nose],
    lw: lm[LM.leftWrist],
    rw: lm[LM.rightWrist],
    sw: Math.max(dist(ls, rs), 0.05),
    shoulderAngle: lineAngle(rs, ls),
    // 어깨 기준 머리(귀 선) 상대 기울기 — 양수 = 사람 기준 왼쪽으로 기울임
    tilt: lineAngle(re, le) - lineAngle(rs, ls),
    shoulderMid: mid(ls, rs),
    earMid: mid(le, re),
  }
}

// ── 목 옆 늘리기 (왼/오) ─────────────────────────────────────────────
// 거울 미리보기에서 사람 기준 방향과 화면에 보이는 방향이 일치한다.
function neckSide(direction) {
  const label = direction === 'left' ? '왼' : '오른'
  return (lm) => {
    const p = baseParts(lm)
    if (!p) return notVisible()
    const t = direction === 'left' ? p.tilt : -p.tilt
    // 기울기 임계 13°: AI 서버(core/stretch.py)와 동일. 어깨 수평은 프론트 추가 가드.
    const conds = [
      cond('vis', '어깨까지 프레임 안에', true),
      cond('tilt', `머리를 ${label}쪽으로 깊게 (13° 이상)`, t >= 13, `${Math.max(0, t).toFixed(0)}°`),
      cond('level', '어깨는 수평 유지', Math.abs(p.shoulderAngle) <= 12, `${Math.abs(p.shoulderAngle).toFixed(0)}°`),
    ]
    let hint = null
    if (t <= -10) hint = `반대쪽이에요 — ${label}쪽으로 기울여 주세요`
    else if (t < 13) hint = '귀가 어깨에 닿는다는 느낌으로 조금 더'
    else if (Math.abs(p.shoulderAngle) > 12) hint = '어깨가 따라 올라갔어요 — 힘을 빼세요'
    return pack(conds, hint)
  }
}

// ── 어깨 으쓱하기 ────────────────────────────────────────────────────
// 세션 중 관찰된 "가장 이완된 상태"(귀-어깨 거리 최대)를 기준으로 상승률을 계산한다.
// 세션 중 가장 이완된 상태(귀-어깨 거리 최대)를 기준으로 상승률을 재는 적응형 방식.
// AI 서버는 고정 기준값을 쓰므로 방식이 다름 — 어느 쪽으로 통일할지 AI팀과 결정 필요.
// 콜드스타트 방어: 세션 시작 직후엔 기준이 없으므로 1초(10샘플) 관찰 후부터 판정한다.
function shoulderShrug(lm, ctx) {
  const p = baseParts(lm)
  if (!p) return notVisible()
  const r = (p.shoulderMid.y - p.earMid.y) / p.sw
  const ref = ctx?.ref ?? {}
  ref.maxR = Math.max(ref.maxR ?? 0, r)
  ref.samples = (ref.samples ?? 0) + 1
  const warmedUp = ref.samples >= 10 && ref.maxR > 0.2
  const lift = warmedUp ? 1 - r / ref.maxR : 0
  const lifted = warmedUp && lift >= 0.18
  const conds = [
    cond('vis', '어깨까지 프레임 안에', true),
    cond('lift', '어깨를 귀 쪽으로 으쓱', lifted, warmedUp ? `${Math.round(lift * 100)}%` : null),
  ]
  const hint = !warmedUp
    ? '잠시 편안히 앉아 주세요 — 기준을 잡는 중이에요'
    : lifted
      ? null
      : '양어깨를 귀에 닿을 만큼 끌어올려 보세요'
  return pack(conds, hint)
}

// ── 가슴 열기 (양팔 벌리기) ──────────────────────────────────────────
function chestOpener(lm) {
  const p = baseParts(lm)
  if (!p) return notVisible()
  if (!vis(p.lw) || !vis(p.rw)) {
    return pack(
      [cond('vis', '어깨까지 프레임 안에', true), cond('hands', '양손이 화면 안에', false)],
      '양팔을 벌린 손이 화면에 보이게 조금 뒤로 앉아 주세요',
    )
  }
  // 벌림 임계 1.7배: AI 서버와 동일. 어깨 높이는 프론트 추가 가드.
  const spread = Math.abs(p.lw.x - p.rw.x) / p.sw
  const heightOk =
    Math.abs(p.lw.y - p.shoulderMid.y) <= 0.6 * p.sw && Math.abs(p.rw.y - p.shoulderMid.y) <= 0.6 * p.sw
  const conds = [
    cond('vis', '어깨까지 프레임 안에', true),
    cond('spread', '양팔을 옆으로 넓게 (어깨너비 1.7배)', spread >= 1.7, `${spread.toFixed(1)}배`),
    cond('height', '손은 어깨 높이에서 유지', heightOk),
  ]
  let hint = null
  if (spread < 1.7) hint = '팔을 조금 더 넓게 펼쳐 주세요'
  else if (!heightOk) hint = '손 높이를 어깨 높이에 맞춰 주세요'
  return pack(conds, hint)
}

// ── 턱 당기기 ────────────────────────────────────────────────────────
// 턱을 당기면 머리가 뒤-아래로 회전해 코가 귀 선보다 내려간다.
// 세션 중 가장 이완된 상태(코-귀선 간격 최소)를 기준으로 하강폭을 잰다.
function chinTuck(lm, ctx) {
  const p = baseParts(lm)
  if (!p) return notVisible()
  const gap = (p.nose.y - p.earMid.y) / p.sw // 귀선 대비 코 높이 (아래로 양수)
  const ref = ctx?.ref ?? {}
  ref.minGap = Math.min(ref.minGap ?? gap, gap)
  const delta = gap - ref.minGap
  const tucked = delta >= 0.05
  const overNod = delta > 0.16 // 당기기가 아니라 고개를 숙인 것
  const conds = [
    cond('vis', '어깨까지 프레임 안에', true),
    cond('tuck', '턱을 뒤로 지그시 당기기', tucked && !overNod, `${Math.round(delta * 100)}%`),
    cond('level', '고개는 숙이지 말고 시선은 정면', !overNod),
  ]
  let hint = null
  if (overNod) hint = '숙이는 게 아니라 뒤로 당기는 거예요 — 시선은 정면 유지'
  else if (!tucked) hint = '이중턱을 만든다는 느낌으로 턱을 목 쪽으로'
  return pack(conds, hint)
}

// ── 팔 위로 뻗기 ─────────────────────────────────────────────────────
function armsUp(lm) {
  const p = baseParts(lm)
  if (!p) return notVisible()
  // 손목이 코보다 위: AI 서버와 동일 기준 (여유 마진 제거). 몸통 수평은 프론트 추가 가드.
  const handsVisible = vis(p.lw) && vis(p.rw)
  const up = handsVisible && p.lw.y < p.nose.y && p.rw.y < p.nose.y
  const conds = [
    cond('vis', '어깨까지 프레임 안에', true),
    cond('up', '양손을 머리 위로', up),
    cond('level', '몸통은 좌우로 곧게', Math.abs(p.shoulderAngle) <= 12, `${Math.abs(p.shoulderAngle).toFixed(0)}°`),
  ]
  let hint = null
  if (!handsVisible) hint = '손이 화면 밖으로 나갔어요 — 조금 뒤로 앉아 주세요'
  else if (!up) hint = '손끝을 하늘로 민다는 느낌으로 더 높이'
  else if (Math.abs(p.shoulderAngle) > 12) hint = '몸통이 기울었어요 — 가운데로 곧게'
  return pack(conds, hint)
}

// 실시간 판정을 지원하는 동작 목록 — 6종 전부
export const STRETCH_RULES = {
  neck_side_left: neckSide('left'),
  neck_side_right: neckSide('right'),
  chin_tuck: chinTuck,
  shoulder_shrug: shoulderShrug,
  chest_opener: chestOpener,
  arms_up: armsUp,
}

// ── 스켈레톤 오버레이 ────────────────────────────────────────────────
const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [7, 8],
]
const POINTS = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]

// 미리보기가 거울 모드 + object-cover이므로, 같은 변환으로 그린다.
// clear=false 면 기존 그림(예: 가이드 실루엣) 위에 겹쳐 그린다.
export function drawPose(canvas, video, lm, active, { clear = true } = {}) {
  if (!canvas || !video) return
  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (clear) ctx.clearRect(0, 0, cw, ch)
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
