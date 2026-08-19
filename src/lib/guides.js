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
// 스트레칭용: 팔 동작이 프레임에 들어오도록 상반신을 조금 작게/아래로
const STRETCH_ANCHORS = {
  nose: [0.5, 0.26],
  left_ear: [0.445, 0.26],
  right_ear: [0.555, 0.26],
  left_shoulder: [0.365, 0.44],
  right_shoulder: [0.635, 0.44],
}

export const VIEW_ANCHORS = { front: FRONT_ANCHORS, stretch: STRETCH_ANCHORS }

// 허용 오차(정규화 거리). 원본 guides.py(0.09, 앵커 5점 전부 충족)는 체형 차이
// (어깨 폭·귀 간격)에 과민해서, 프론트는 어깨 "중심 위치 + 거리"만 보고 완화했다.
// ※ 서버 check_alignment와 기준이 달라졌음 — AI팀과 동기화 시 참고.
export const ANCHOR_TOLERANCE = 0.12
// 어깨 너비 비율(거리) 허용 범위 — 목표 대비 ±30%
export const SCALE_TOLERANCE = 0.3

/** 앵커 기반 상반신 실루엣 폴리곤 (머리 반원 + 어깨/몸통 사다리꼴) — guides.py _silhouette */
export function getSilhouette(view = 'front', expand = 1.0) {
  const a = VIEW_ANCHORS[view]
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
 * MediaPipe LEFT_*는 해부학 기준이라 x좌표로 정렬해 이미지 기준 좌/우로 매칭한다
 * (프레임이 미러링돼 들어와도 동일하게 동작).
 * 안내 문구는 유저 몸 기준 = 미러링된 셀피 화면 기준 방향.
 */
export function checkAlignment(landmarks, view = 'front') {
  const anchors = VIEW_ANCHORS[view]
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

  // 앵커별 오차는 정보용으로만 계산 (판정은 중심 위치·거리 기준)
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
 * 미리보기가 거울 모드 + object-cover이므로 같은 변환(cover 매핑 + x 반전)을 쓴다.
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
