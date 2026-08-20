import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../state/AppContext'
import { Btn, Card, Chip, Icon, MicroLabel, PostureFigure, TONE } from './ui'
import { fmtDur } from '../lib/format'

// 상시 미니 위젯 — 최종적으로는 OS 트레이 아이콘이 될 자리.
// 평상시엔 이게 앱의 유일한 존재감이어야 하므로, 조용하게.
export function Widget() {
  const {
    posture, meta, paused, demoAlert, warnLevel,
    setPaused, setScreen,
    alertCount, elapsedSec, localDetection,
  } = useApp()
  const liveScore =
    localDetection.status === 'tracking' && localDetection.displayScore != null
      ? localDetection.displayScore
      : meta.score
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
              <div className="font-mono text-2xl font-semibold leading-none">{paused ? '--' : liveScore}</div>
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

// 플로팅 위젯 (Document PiP) — 다른 앱 위에 떠 있는 창에 포털로 렌더.
// 메인 앱과 같은 React 트리라 자세 상태가 실시간으로 반영된다.
export function FloatingWidgetPortal() {
  const { pipWindow, posture, meta, paused, setPaused, warnLevel, localDetection } = useApp()
  if (!pipWindow) return null

  const tone = paused ? TONE.neutral : TONE[meta.tone]
  const score =
    localDetection.status === 'tracking' && localDetection.displayScore != null
      ? localDetection.displayScore
      : meta.score

  return createPortal(
    <div className={`relative flex h-screen w-screen items-center gap-3 border-t-2 bg-ink px-4 ${tone.border}`}>
      {/* 브랜드 라벨 — PiP 타이틀바의 도메인 표기는 브라우저 보안 UI라 못 바꾸므로 콘텐츠 안에 표기 */}
      <span className="absolute right-3 top-2 text-[11px] font-bold tracking-tight text-mid">반듯</span>
      <PostureFigure state={paused ? 'good' : posture} className={`h-16 w-16 shrink-0 ${tone.text}`} stroke={5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold leading-none text-hi">{paused ? '--' : score}</span>
          <span className={`text-sm font-medium ${tone.text}`}>{paused ? '일시정지' : meta.label}</span>
        </div>
        <div className="mt-1.5 flex gap-0.5">
          {[1, 2, 3].map((l) => (
            <span
              key={l}
              className={`h-[3px] w-4 rounded-full ${!paused && warnLevel >= l ? tone.bg : 'bg-white/15'}`}
            />
          ))}
        </div>
        <p className="mt-1.5 truncate text-[11px] text-dim">
          {paused ? '모니터링이 멈춰 있어요' : (localDetection.reason ?? '조용히 지켜보는 중')}
        </p>
      </div>
      {/* 일시정지/재개 — 같은 React 트리라 메인 앱의 setPaused 를 그대로 호출 (카메라도 함께 꺼지고 켜진다) */}
      <button
        onClick={() => setPaused(!paused)}
        title={paused ? '모니터링 재개' : '모니터링 일시정지'}
        className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${
          paused
            ? 'border-good/50 bg-good/10 text-good hover:bg-good/20'
            : 'border-line-strong bg-raised text-mid hover:text-hi'
        }`}
      >
        <Icon name={paused ? 'play' : 'pause'} size={15} />
      </button>
    </div>,
    pipWindow.document.body,
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
