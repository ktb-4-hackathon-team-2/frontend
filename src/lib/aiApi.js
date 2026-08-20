// AI 서버(FastAPI) 클라이언트 — docs/ai-server-api-spec.md 기준.
// 실시간 판정은 프론트 온디바이스(src/lib/postureDetector.js — posture.py 포팅판)로 처리하고,
// AI 서버는 캘리브레이션 baseline 등록과 (추후) 리포트 LLM 분석에만 사용한다.

const AI_BASE =
  import.meta.env.VITE_AI_URL ||
  import.meta.env.VITE_AI_API_BASE ||
  ''

export const aiEnabled = Boolean(AI_BASE)

export class AiApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'AiApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(AI_BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new AiApiError('AI 서버에 연결할 수 없어요')
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    // 본문 없는 응답 허용
  }
  if (!res.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'AI 서버 요청이 실패했어요'
    throw new AiApiError(detail, res.status)
  }
  return data
}

/**
 * 서버 전송용 프레임 캡처.
 * 미리보기는 CSS 미러지만 video 원본은 미러가 아니므로 그대로 그린다 (스펙: raw 프레임 전송).
 */
export function captureFrame(video, maxWidth = 480, quality = 0.6) {
  if (!video || !video.videoWidth) return null
  const scale = Math.min(1, maxWidth / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality) // data URL 그대로 허용됨
}

export const aiApi = {
  /** 바른 자세 한 컷 → baseline_id 발급 (이미지는 서버에 저장되지 않음) */
  calibrate: ({ image, userId, view = 'front' }) =>
    request('/api/calibrate', { method: 'POST', body: { image, user_id: String(userId ?? 'anonymous'), view } }),

  /** 해당 유저의 최신 baseline — 재접속 시 재캘리브레이션 생략용 (없으면 404) */
  userBaseline: (userId) => request(`/api/users/${encodeURIComponent(userId)}/baseline`),
}
