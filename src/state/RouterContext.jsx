import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// History API 기반 초소형 라우터.
// 라이브러리 없이 경로 상태만 제공하고, 화면 매핑/가드는 각 컨텍스트가 담당한다.
const Ctx = createContext(null)
export const useRouter = () => useContext(Ctx)

export function RouterProvider({ children }) {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname) return
    window.history[replace ? 'replaceState' : 'pushState'](null, '', to)
    setPath(to)
  }, [])

  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>
}
