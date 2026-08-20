import { useApp } from '../state/AppContext'
import { Icon, MicroLabel, PostureFigure } from './ui'

const NAV = [
  { id: 'monitor', icon: 'activity', label: '모니터링' },
  { id: 'report', icon: 'chart', label: '리포트' },
  { id: 'stretch', icon: 'person', label: '스트레칭' },
  { id: 'environment', icon: 'desk', label: '환경 가이드' },
  { id: 'posture', icon: 'target', label: '바른 자세란?' },
  { id: 'alerts', icon: 'bell', label: '알림 단계' },
  { id: 'settings', icon: 'sliders', label: '설정' },
]

export function Sidebar() {
  const { screen, setScreen, camera } = useApp()
  const camOn = camera.status === 'active'

  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-line px-4 py-6">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <PostureFigure state="good" className="h-8 w-8 text-good" stroke={6} />
        <div>
          <div className="text-lg font-bold leading-none tracking-tight">반듯</div>
          <MicroLabel className="mt-1">Posture Guard</MicroLabel>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = screen === item.id
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition-all duration-150 ${
                active ? 'bg-white/[0.06] font-medium text-hi' : 'text-mid hover:bg-white/[0.03] hover:text-hi'
              }`}
            >
              <Icon name={item.icon} size={16} className={active ? 'text-good' : 'text-dim'} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 px-2">
        <button
          onClick={() => setScreen('monitor')}
          className="flex cursor-pointer items-center gap-2 text-left text-xs text-dim transition-colors hover:text-mid"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${camOn ? 'bg-good blink-dot' : 'bg-white/20'}`} />
          {camOn ? '카메라 켜짐' : '카메라 꺼짐'}
        </button>
        <MicroLabel>v0.1 · Hackathon Proto</MicroLabel>
      </div>
    </aside>
  )
}
