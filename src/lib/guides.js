// AI 레포 app/core/guides.py 포팅판 — 화면 오버레이용 자세 가이드 + 정합(alignment) 판정.
// 앵커/실루엣 좌표는 카메라 프레임 기준 정규화 좌표(0~1, 좌상단 원점).
// 미러링된 셀피 화면에 그릴 때는 x를 1-x로 뒤집는다 (drawGuide가 처리).
// 앵커 키의 left_/right_는 해부학이 아니라 "이미지 기준 좌/우"다.

const LM = { NOSE: 0, LEFT_EAR: 7, RIGHT_EAR: 8, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12 }

const FRONT_ANCHORS = {
  nose: [0.5, 0.3],
  left_ear: [0.435, 0.3],
  right_ear: [0.565, 0.3],
  left_shoulder: [0.34, 0.52],
  right_shoulder: [0.66, 0.52],
}

// 좌대각: 노트북(웹캠)이 사용자 왼쪽 앞에 위치 (시선은 정면 모니터)
const LEFT_DIAG_ANCHORS = {
  nose: [0.46, 0.3],
  left_ear: [0.415, 0.3],
  right_ear: [0.535, 0.305],
  left_shoulder: [0.33, 0.52],
  right_shoulder: [0.62, 0.53],
}

// 우대각: 노트북(웹캠)이 사용자 오른쪽 앞에 위치 (시선은 정면 모니터)
const RIGHT_DIAG_ANCHORS = {
  nose: [0.54, 0.3],
  left_ear: [0.465, 0.305],
  right_ear: [0.585, 0.3],
  left_shoulder: [0.38, 0.53],
  right_shoulder: [0.67, 0.52],
}

// 스트레칭용: 팔 동작이 프레임에 들어오도록 상반신을 조금 작게/아래로
const STRETCH_ANCHORS = {
  nose: [0.5, 0.26],
  left_ear: [0.445, 0.26],
  right_ear: [0.555, 0.26],
  left_shoulder: [0.365, 0.44],
  right_shoulder: [0.635, 0.44],
}

export const VIEW_ANCHORS = {
  front: FRONT_ANCHORS,
  left_diagonal: LEFT_DIAG_ANCHORS,
  right_diagonal: RIGHT_DIAG_ANCHORS,
  stretch: STRETCH_ANCHORS,
}

export const CAMERA_VIEWS = [
  {
    id: 'front',
    label: '정면 (모니터 상단 / 정면 노트북)',
    desc: '웹캠이 모니터 정면 중앙에 위치한 기본 세팅',
    badge: '기본',
  },
  {
    id: 'left_diagonal',
    label: '좌측 대각선 (노트북이 왼쪽)',
    desc: '노트북을 왼쪽에 두고 정면 모니터를 주로 보는 듀얼 모니터 세팅',
    badge: '듀얼 모니터 추천',
  },
  {
    id: 'right_diagonal',
    label: '우측 대각선 (노트북이 오른쪽)',
    desc: '노트북을 오른쪽에 두고 정면 모니터를 주로 보는 듀얼 모니터 세팅',
    badge: '듀얼 모니터 추천',
  },
]

// 허용 오차(정규화 거리).
export const ANCHOR_TOLERANCE = 0.12
// 어깨 너비 비율(거리) 허용 범위 — 목표 대비 ±30%
export const SCALE_TOLERANCE = 0.3

/** 앵커 기반 상반신 실루엣 폴리곤 (머리 반원 + 어깨/몸통 사다리꼴) */
export function getSilhouette(view = 'front', expand = 1.0) {
  const a = VIEW_ANCHORS[view] || VIEW_ANCHORS.front
  const ls = a.left_shoulder
  const rs = a.right_shoulder
  const nose = a.nose
  const sw = (rs[0] - ls[0]) * expand
  const headR = sw * 0.3
  const cx = nose[0]
  const headCy = nose[1]
  const bodyBottom = Math.min(ls[1] + sw * 0.85, 0.99)
  const pts = []
  for (let i = 0; i < 12; i++) {
    const ang = Math.PI * (1 - i / 11.0)
    pts.push([cx + headR * Math.cos(ang + Math.PI), headCy + headR * Math.sin(ang + Math.PI)])
  }
  const body = [
    [ls[0] - sw * 0.1, ls[1] - sw * 0.1],
    [ls[0] - sw * 0.14, bodyBottom],
    [rs[0] + sw * 0.14, bodyBottom],
    [rs[0] + sw * 0.1, rs[1] - sw * 0.1],
  ]
  return [...pts, ...body]
}

/**
 * 실시간 프레임이 가이드에 맞는지 판정 — guides.py check_alignment 포팅.
 */
export function checkAlignment(landmarks, view = 'front') {
  const anchors = VIEW_ANCHORS[view] || VIEW_ANCHORS.front
  const byX = (a, b) => a.x - b.x
  const [imgLSh, imgRSh] = [landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]].sort(byX)
  const [imgLEar, imgREar] = [landmarks[LM.LEFT_EAR], landmarks[LM.RIGHT_EAR]].sort(byX)
  const lmMap = {
    nose: landmarks[LM.NOSE],
    left_ear: imgLEar,
    right_ear: imgREar,
    left_shoulder: imgLSh,
    right_shoulder: imgRSh,
  }
  const messages = []

  const lowVis = Object.values(lmMap).some((lm) => (lm.visibility ?? 0) < 0.5)
  if (lowVis) messages.push('상반신이 모두 화면에 나오도록 위치를 조정해 주세요')

  const ls = lmMap.left_shoulder
  const rs = lmMap.right_shoulder
  const curCx = (ls.x + rs.x) / 2
  const curCy = (ls.y + rs.y) / 2
  const curW = Math.abs(rs.x - ls.x)
  const [tgtLs, tgtRs] = [anchors.left_shoulder, anchors.right_shoulder]
  const tgtCx = (tgtLs[0] + tgtRs[0]) / 2
  const tgtCy = (tgtLs[1] + tgtRs[1]) / 2
  const tgtW = Math.abs(tgtRs[0] - tgtLs[0])

  const dx = curCx - tgtCx
  const dy = curCy - tgtCy
  const dw = curW / tgtW - 1.0

  if (dx > ANCHOR_TOLERANCE) messages.push('오른쪽으로 조금 이동해 주세요')
  else if (dx < -ANCHOR_TOLERANCE) messages.push('왼쪽으로 조금 이동해 주세요')
  if (dy > ANCHOR_TOLERANCE) messages.push('조금 위로 (의자를 높이거나 카메라를 내려) 맞춰 주세요')
  else if (dy < -ANCHOR_TOLERANCE) messages.push('조금 아래로 맞춰 주세요')
  if (dw > SCALE_TOLERANCE) messages.push('카메라에서 조금 멀어져 주세요')
  else if (dw < -SCALE_TOLERANCE) messages.push('카메라에 조금 가까이 와 주세요')

  const offsets = {}
  for (const [key, tgt] of Object.entries(anchors)) {
    const lm = lmMap[key]
    const d = Math.hypot(lm.x - tgt[0], lm.y - tgt[1])
    offsets[key] = Math.round(d * 10000) / 10000
  }

  const aligned =
    !lowVis &&
    Math.abs(dx) <= ANCHOR_TOLERANCE &&
    Math.abs(dy) <= ANCHOR_TOLERANCE &&
    Math.abs(dw) <= SCALE_TOLERANCE
  return {
    aligned,
    offsets,
    dx: Math.round(dx * 10000) / 10000,
    dy: Math.round(dy * 10000) / 10000,
    scale: Math.round(dw * 10000) / 10000,
    messages: aligned ? ['좋아요! 이 자세를 유지해 주세요'] : messages,
  }
}

/**
 * 실루엣 폴리곤을 카메라 미리보기 위에 그린다.
 */
export function drawGuide(canvas, video, polygon, aligned) {
  if (!canvas || !video) return
  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, cw, ch)
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(cw / vw, ch / vh)
  const ox = (cw - vw * scale) / 2
  const oy = (ch - vh * scale) / 2
  const px = (p) => ({ x: cw - (ox + p[0] * vw * scale), y: oy + p[1] * vh * scale })

  ctx.beginPath()
  polygon.forEach((p, i) => {
    const P = px(p)
    if (i === 0) ctx.moveTo(P.x, P.y)
    else ctx.lineTo(P.x, P.y)
  })
  ctx.closePath()
  ctx.setLineDash([8, 8])
  ctx.lineWidth = 2
  ctx.strokeStyle = aligned ? 'rgba(62, 201, 143, 0.85)' : 'rgba(230, 179, 69, 0.8)'
  ctx.fillStyle = aligned ? 'rgba(62, 201, 143, 0.06)' : 'rgba(230, 179, 69, 0.05)'
  ctx.fill()
  ctx.stroke()
  ctx.setLineDash([])
}
