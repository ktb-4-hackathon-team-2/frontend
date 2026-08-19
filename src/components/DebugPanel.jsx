import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { POSTURE_META } from '../data/dummy'
import { Btn, Icon, MicroLabel, TONE } from './ui'

// 로컬 자세 판정과 알림 단계를 수동으로 확인할 수 있는 개발용 패널.
export function DebugPanel() {
  const { posture, setPosture, setStretchSuggest, resetSession, clearDemo, localDetection } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-5 left-5 z-40">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-white/25 bg-ink/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim backdrop-blur transition-colors hover:text-mid"
        >
          <Icon name="wrench" size={11} />
          Dev
        </button>
      ) : (
        <div className="w-64 rounded-2xl border border-dashed border-white/25 bg-ink/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-1 flex items-center justify-between">
            <MicroLabel>판정 시뮬레이터</MicroLabel>
            <button onClick={() => setOpen(false)} className="cursor-pointer text-dim hover:text-hi">
              <Icon name="x" size={13} />
            </button>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-dim">
            {localDetection.status === 'tracking' ? '카메라가 켜져 있으면 로컬 판정 결과가 주기적으로 반영됩니다.' : '자세 상태와 알림 단계를 수동으로 확인합니다.'}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(POSTURE_META).map(([key, m]) => {
              const t = TONE[m.tone]
              const active = posture === key
              return (
                <button
                  key={key}
                  onClick={() => {
                    clearDemo()
                    setPosture(key)
                  }}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-all ${
                    active
                      ? `${t.soft} ${t.border} ${t.text} font-medium`
                      : 'border-line text-mid hover:border-line-strong hover:text-hi'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${t.bg} ${active ? '' : 'opacity-40'}`} />
                  {m.label}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
            <Btn size="sm" kind="ghost" className="justify-start" onClick={() => setStretchSuggest(true)}>
              <Icon name="clock" size={13} />
              스트레칭 제안 트리거
            </Btn>
            <Btn size="sm" kind="ghost" className="justify-start" onClick={resetSession}>
              <Icon name="refresh" size={13} />
              세션 초기화
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
