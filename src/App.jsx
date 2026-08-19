import { AppProvider, useApp } from './state/AppContext'
import { Sidebar } from './components/Sidebar'
import { Widget, WidgetModeBackdrop } from './components/Widget'
import { DebugPanel } from './components/DebugPanel'
import { AlertLayer } from './components/AlertLayer'
import { Btn, Chip, Icon } from './components/ui'
import { fmtClock } from './lib/format'
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

function Root() {
  const { calibrated, widgetMode } = useApp()
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
    <AppProvider>
      <Root />
    </AppProvider>
  )
}
