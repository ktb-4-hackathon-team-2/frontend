// 백엔드 API 클라이언트 — docs/api-spec.md 기준.
// 토큰은 Authorization: Bearer 헤더로만 주고받는다 (쿠키 미사용).

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'
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
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
}
