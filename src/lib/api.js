// 백엔드 API 클라이언트 — docs/api-spec.md 기준.
// 토큰은 Authorization: Bearer 헤더로만 주고받는다 (쿠키 미사용).

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:8080'
const BASE = API_BASE

export const TOKEN_KEY = 'bandeut.accessToken'
export const getAccessToken = () => localStorage.getItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const currentToken = token ?? getAccessToken()
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('NETWORK', `서버에 연결할 수 없어요. 백엔드(${BASE})가 켜져 있는지 확인해 주세요.`)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    // 본문 없는 응답 허용
  }
  if (!res.ok) {
    throw new ApiError(data?.code ?? 'INTERNAL_ERROR', data?.message ?? '요청을 처리하지 못했어요.', res.status)
  }
  return data
}

export const api = {
  /** POST /api/product-key/verify — 틀려도 200 + {valid:false} */
  verifyProductKey: (key) => request('/api/product-key/verify', { method: 'POST', body: { key } }),

  /** POST /api/signup → 201 {id, email} */
  signup: (email, password) => request('/api/signup', { method: 'POST', body: { email, password } }),

  /** POST /api/login → {accessToken, tokenType, expiresIn, member} */
  login: (email, password) => request('/api/login', { method: 'POST', body: { email, password } }),

  /** GET /api/me — 저장된 토큰 검증 겸용 */
  me: (token) => request('/api/me', { token }),

  // ── 리포트 & 통계 API ──────────────────────────────────────────
  /** GET /api/reports/dashboard — 레포트 화면 전체 대시보드 (14일 추이, 시간대별) */
  getReportDashboard: (token) => request('/api/reports/dashboard', { token }),

  /** GET /api/reports/daily — 특정 날짜 일일 레포트 상세 조회 */
  getDailyReport: (date, token) => request(`/api/reports/daily${date ? `?date=${date}` : ''}`, { token }),

  /** GET /api/reports/calendar — 달력 잔디(히트맵) 조회 */
  getCalendar: (year, month, token) => request(`/api/reports/calendar?year=${year}&month=${month}`, { token }),

  /** POST /api/reports/daily/analyze — AI 일일 리포트 분석 요청 / 재생성 */
  analyzeDailyReport: (date, token) => request(`/api/reports/daily/analyze${date ? `?date=${date}` : ''}`, { method: 'POST', token }),

  // ── ⚙️ 사용자 설정 API (docs/api-spec.md 7-1) ──
  /** GET /api/settings — 항상 200. 저장 전이면 서버가 기본값을 채워서 내려준다 (404 분기 불필요) */
  getSettings: (token) => request('/api/settings', { token }),

  /** PUT /api/settings — 저장(업서트). 4개 필드 전부 필수: sensitivity·sound·maxAlertLevel·stretchMin */
  saveSettings: (payload, token) => request('/api/settings', { method: 'PUT', body: payload, token }),
}
