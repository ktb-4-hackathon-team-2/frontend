import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { Btn, Card, Chip, Icon, MicroLabel, PostureFigure, TONE } from './ui'
import { fmtDur } from '../lib/format'

// 상시 미니 위젯 — 최종적으로는 OS 트레이 아이콘이 될 자리.
// 평상시엔 이게 앱의 유일한 존재감이어야 하므로, 조용하게.
export function Widget() {
  const {
    posture, meta, paused, demoAlert, warnLevel,
    setPaused, setScreen,
    alertCount, elapsedSec,
  } = useApp()
  const [open, setOpen] = useState(false)

  // 1단계 데모: 위젯만 조용히 경고색으로
  const displayState = demoAlert === 1 ? 'warn1' : posture
  const displayLevel = demoAlert === 1 ? 1 : warnLevel
  const tone = paused ? TONE.neutral : TONE[displayState === 'good' ? 'good' : displayState]
  const alerting = !paused && displayLevel >= 1

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <Card className="toast-in w-72 border-line-strong bg-surface/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <MicroLabel>Posture Guard</MicroLabel>
            <Chip tone={paused ? 'neutral' : meta.tone}>{paused ? '일시정지' : meta.label}</Chip>
          </div>
          <div className="mb-3 flex items-center gap-3">
            <PostureFigure state={displayState} className={`h-12 w-12 ${tone.text}`} />
            <div>
              <div className="font-mono text-2xl font-semibold leading-none">{paused ? '--' : meta.score}</div>
              <div className="mt-1 text-[11px] text-dim">자세 점수</div>
            </div>
            <div className="ml-auto text-right text-[11px] leading-relaxed text-mid">
              <div>
                오늘 <span className="font-mono text-hi">87%</span>
              </div>
              <div>
                알림 <span className="font-mono text-hi">{alertCount}회</span>
              </div>
              <div>
                <span className="font-mono text-hi">{fmtDur(elapsedSec)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" kind="outline" className="flex-1" onClick={() => setPaused(!paused)}>
              <Icon name={paused ? 'play' : 'pause'} size={13} />
              {paused ? '재개' : '일시정지'}
            </Btn>
            <Btn
              size="sm"
              kind="primary"
              className="flex-1"
              onClick={() => {
                setScreen('monitor')
                setOpen(false)
              }}
            >
              대시보드 열기
            </Btn>
          </div>
        </Card>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title="반듯 위젯"
        className={`relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border bg-surface/90 shadow-lg backdrop-blur transition-all duration-300 hover:scale-105 ${
          alerting ? `${tone.border} ${tone.soft}` : 'border-line-strong'
        }`}
      >
        {alerting && displayLevel >= 2 && (
          <span className={`absolute inset-0 rounded-2xl border-2 ${tone.border} ring-ping`} />
        )}
        <PostureFigure
          state={paused ? 'good' : displayState}
          className={`h-9 w-9 transition-colors duration-300 ${tone.text}`}
        />
        {/* 경고 단계 도트 — 색에만 의존하지 않도록 단계 수를 함께 표기 */}
        <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5">
          {[1, 2, 3].map((l) => (
            <span
              key={l}
              className={`h-[3px] w-[7px] rounded-full transition-colors duration-300 ${
                !paused && displayLevel >= l ? tone.bg : 'bg-white/12'
              }`}
            />
          ))}
        </span>
        {paused && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-raised">
            <Icon name="pause" size={9} className="text-mid" />
          </span>
        )}
      </button>
    </div>
  )
}

// 위젯 모드 — 앱 창을 닫고 위젯(트레이)만 남은 상태의 시뮬레이션
export function WidgetModeBackdrop() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <MicroLabel className="text-center">Widget Mode</MicroLabel>
      <p className="max-w-sm text-center text-sm leading-relaxed text-dim">
        평상시의 반듯은 이 상태예요 — 화면 구석의 위젯만 남습니다.
        <br />
        <span className="text-mid">우측 하단 위젯을 클릭해 팝오버에서 복귀하세요.</span>
      </p>
    </div>
  )
}
