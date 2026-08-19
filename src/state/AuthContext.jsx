import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, TOKEN_KEY } from '../lib/api'

// 제품 키 게이트 + JWT 세션.
// status: checking(저장된 토큰 검증 중) | guest | authed
const KEY_OK = 'bandeut.productKeyVerified'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking')
  const [member, setMember] = useState(null)
  const [keyVerified, setKeyVerified] = useState(() => localStorage.getItem(KEY_OK) === '1')

  // 앱 시작 시 저장된 토큰을 /api/me 로 검증 — 만료/무효면 로그인 화면으로
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setStatus('guest')
      return
    }
    let cancelled = false
    api.me(token).then(
      (me) => {
        if (cancelled) return
        setMember(me)
        setStatus('authed')
      },
      () => {
        if (cancelled) return
        localStorage.removeItem(TOKEN_KEY)
        setStatus('guest')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const verifyKey = useCallback(async (key) => {
    const res = await api.verifyProductKey(key)
    if (res?.valid) {
      localStorage.setItem(KEY_OK, '1')
      setKeyVerified(true)
      return true
    }
    return false
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password)
    localStorage.setItem(TOKEN_KEY, res.accessToken)
    setMember(res.member)
    setStatus('authed')
  }, [])

  // 가입 성공 시 같은 자격으로 바로 로그인까지
  const signup = useCallback(
    async (email, password) => {
      await api.signup(email, password)
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setMember(null)
    setStatus('guest')
  }, [])

  return (
    <Ctx.Provider value={{ status, member, keyVerified, verifyKey, login, signup, logout }}>
      {children}
    </Ctx.Provider>
  )
}
