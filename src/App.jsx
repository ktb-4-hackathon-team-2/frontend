import { useEffect } from 'react'
import { AppProvider, useApp, SCREEN_PATHS } from './state/AppContext'
import { AuthProvider, useAuth } from './state/AuthContext'
import { RouterProvider, useRouter } from './state/RouterContext'
import { Sidebar } from './components/Sidebar'
import { Widget, WidgetModeBackdrop } from './components/Widget'
import { DebugPanel } from './components/DebugPanel'
import { AlertLayer } from './components/AlertLayer'
import { Btn, Chip, Icon, MicroLabel, PostureFigure } from './components/ui'
import { fmtClock } from './lib/format'
import Auth from './screens/Auth'
import Onboarding from './screens/Onboarding'
import Monitor from './screens/Monitor'
import Report from './screens/Report'
import Stretch from './screens/Stretch'
import Environment from './screens/Environment'
import AlertsDemo from './screens/AlertsDemo'
import Settings from './screens/Settings'

const SCREENS = {
  monitor: Monitor,
  report: Report,
  stretch: Stretch,
  environment: Environment,
  alerts: AlertsDemo,
  settings: Settings,
}

function Topbar() {
  const { meta, paused, setPaused, elapsedSec, setWidgetMode, posture } = useApp()
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
      {paused ? (
        <Chip tone="neutral">일시정지됨</Chip>
      ) : (
        <Chip tone={meta.tone}>
          {meta.label}
          <span className="font-mono opacity-80">{meta.score}</span>
        </Chip>
      )}
      {!paused && posture === 'good' && <span className="text-xs text-dim">조용히 지켜보는 중</span>}
      <div className="flex-1" />
      <span className="flex items-center gap-1.5 font-mono text-xs text-mid">
        <Icon name="clock" size={13} className="text-dim" />
        {fmtClock(elapsedSec)}
      </span>
      <Btn size="sm" kind="ghost" onClick={() => setPaused(!paused)}>
        <Icon name={paused ? 'play' : 'pause'} size={13} />
        {paused ? '재개' : '일시정지'}
      </Btn>
      <div className="h-4 w-px bg-line-strong" />
      <Btn size="sm" kind="ghost" onClick={() => setWidgetMode(true)} title="앱을 접고 위젯만 남기기">
        <Icon name="pip" size={13} />
        위젯 모드
      </Btn>
    </header>
  )
}

function Shell() {
  const { screen } = useApp()
  const Screen = SCREENS[screen] || Monitor
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6 pb-24">
          <div key={screen} className="mx-auto max-w-[1060px]">
            <Screen />
          </div>
        </main>
      </div>
    </div>
  )
}

const AUTH_PATHS = ['/key', '/login', '/signup']
const APP_PATHS = [...Object.values(SCREEN_PATHS), '/widget']
const TITLES = {
  '/key': '제품 키',
  '/login': '로그인',
  '/signup': '회원가입',
  '/onboarding': '캘리브레이션',
  '/monitor': '모니터링',
  '/report': '리포트',
  '/stretch': '스트레칭',
  '/environment': '환경 가이드',
  '/alerts': '알림 단계',
  '/settings': '설정',
  '/widget': '위젯 모드',
}

function Root() {
  const { status, keyVerified } = useAuth()
  const { calibrated, widgetMode } = useApp()
  const { path, navigate } = useRouter()

  // 인증/캘리브레이션 상태에 맞지 않는 경로는 교정한다 (가드 리다이렉트)
  useEffect(() => {
    if (status === 'checking') return
    if (status !== 'authed') {
      if (!keyVerified) {
        if (path !== '/key') navigate('/key', { replace: true })
      } else if (!AUTH_PATHS.includes(path) || path === '/key') {
        navigate('/login', { replace: true })
      }
      return
    }
    if (!calibrated) {
      if (path !== '/onboarding') navigate('/onboarding', { replace: true })
      return
    }
    if (!APP_PATHS.includes(path)) navigate('/monitor', { replace: true })
  }, [status, keyVerified, calibrated, path, navigate])

  useEffect(() => {
    document.title = TITLES[path] ? `반듯 — ${TITLES[path]}` : '반듯 — 자세 지킴이 프로토타입'
  }, [path])

  // 저장된 토큰을 /api/me 로 검증하는 동안의 스플래시
  if (status === 'checking') {
    return (
      <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-3">
        <PostureFigure state="good" className="blink-dot h-12 w-12 text-good" stroke={6} />
        <MicroLabel>세션 확인 중…</MicroLabel>
      </div>
    )
  }

  // 제품 키 → 로그인/회원가입 게이트
  if (status !== 'authed') {
    return (
      <div className="app-bg min-h-screen">
        <Auth />
      </div>
    )
  }

  return (
    <div className="app-bg min-h-screen">
      {!calibrated ? <Onboarding /> : widgetMode ? <WidgetModeBackdrop /> : <Shell />}
      {calibrated && <Widget />}
      <DebugPanel />
      <AlertLayer />
    </div>
  )
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppProvider>
          <Root />
        </AppProvider>
      </AuthProvider>
    </RouterProvider>
  )
}
