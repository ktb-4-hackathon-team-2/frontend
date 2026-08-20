import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { TOAST_MSG, recommendStretch } from '../data/dummy'
import { Btn, Icon, PostureFigure } from './ui'
import { fmtDurShort, fmtClock } from '../lib/format'

// 경고 2단계(토스트) + 3단계(전체 화면) + 스트레칭 제안 토스트.
// 평상시엔 아무것도 렌더하지 않는다 — 개입할 때만 존재한다.
export function AlertLayer() {
  const {
    effectiveLevel, posture, demoAlert,
    resolvePosture, setScreen, requestStretch,
    stretchSuggest, startStretchNow, postponeStretch,
    localDetection, awayPaused, clearAwayPaused, setPaused,
  } = useApp()

  const toastVisible = effectiveLevel === 2
  const overlayVisible = effectiveLevel >= 3
  const toastState = demoAlert === 2 ? 'warn2' : posture
  const msg = TOAST_MSG[toastState] || TOAST_MSG.warn2
  // 실제 판정 중이면 감지된 문제를 제목으로, 가장 심각한 issue에 맞는 스트레칭을 추천
  const live = !demoAlert && localDetection.status === 'tracking' && localDetection.issues?.length > 0
  const toastTitle = live ? localDetection.reason : msg.title
  const rec = live ? recommendStretch(localDetection.issues) : null

  const goStretch = () => {
    resolvePosture()
    if (rec) requestStretch(rec.id)
    else setScreen('stretch')
  }

  return (
    <>
      {/* ── 2단계: 작은 토스트 ── */}
      {toastVisible && (
        <div className="toast-in fixed right-5 top-16 z-50 w-[340px]">
          <div className="alert-toast-warn2 overflow-hidden rounded-2xl border border-warn2/40 bg-raised shadow-2xl">
            <div className="alert-tone-bar h-0.5 w-full bg-warn2" />
            <div className="flex gap-3 p-4">
              <span className="alert-tone-icon mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warn2/15 text-warn2">
                <Icon name="alert" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold leading-snug">{toastTitle}</div>
                  <button onClick={resolvePosture} className="cursor-pointer text-dim transition-colors hover:text-hi">
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-mid">
                  {rec ? `${rec.name}(${rec.hold}초)로 바로 풀 수 있어요.` : msg.body}
                </p>
                <div className="mt-3 flex gap-2">
                  <Btn size="sm" kind="primary" onClick={resolvePosture}>
                    바로잡았어요
                  </Btn>
                  <Btn size="sm" kind="ghost" onClick={goStretch}>
                    {rec ? `${rec.name} 하기` : '스트레칭 하기'}
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3단계: 전체 화면 개입 ── */}
      {overlayVisible && <FullOverlay onResolve={resolvePosture} rec={rec} onStretch={goStretch} />}

      {/* ── 자리 비움 자동 일시정지 — 경고와 구분되는 차분한 전체 화면 안내 ── */}
      {awayPaused && !overlayVisible && (
        <div className="overlay-in fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-ink/90 backdrop-blur-xl" />
          <div className="zoom-in relative flex max-w-md flex-col items-center px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line-strong bg-raised">
              <Icon name="videoOff" size={26} className="text-mid" />
            </span>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">
              Away Detected · Auto Paused
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">자리를 비우신 것 같아요</h1>
            <p className="mt-3 text-sm leading-relaxed text-mid">
              5초 이상 감지되지 않아 모니터링을 일시정지하고 카메라를 껐어요.
              <br />
              돌아오셨다면 이어서 지켜볼게요.
            </p>
            <div className="mt-8 flex gap-3">
              <Btn kind="primary" size="lg" onClick={() => setPaused(false)}>
                <Icon name="play" size={16} />
                다시 시작하기
              </Btn>
              <Btn kind="ghost" size="lg" onClick={clearAwayPaused}>
                이대로 두기
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── 스트레칭 제안 (경고와 구분되는 차분한 톤) ── */}
      {stretchSuggest && !overlayVisible && (
        <div className="toast-in fixed bottom-24 right-5 z-40 w-[320px]">
          <div className="alert-toast-good overflow-hidden rounded-2xl border border-good/30 bg-raised shadow-2xl">
            <div className="alert-tone-bar h-0.5 w-full bg-good" />
            <div className="flex gap-3 p-4">
              <span className="alert-tone-icon mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-good/15 text-good">
                <Icon name="clock" size={16} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold">스트레칭 시간이에요</div>
                <p className="mt-1 text-xs leading-relaxed text-mid">
                  오랜 시간 동안 집중했어요. 목과 어깨를 풀어줄 타이밍이에요.
                </p>
                <div className="mt-3 flex gap-2">
                  <Btn size="sm" kind="primary" onClick={startStretchNow}>
                    지금 하기
                  </Btn>
                  <Btn size="sm" kind="ghost" onClick={postponeStretch}>
                    10분 뒤에
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FullOverlay({ onResolve, rec, onStretch }) {
  // 오버레이가 뜬 순간부터의 경과 시간 — 0초에서 시작해 자세 복구 감지로 사라진다
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSec((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="alert-overlay overlay-in fixed inset-0 z-[60] flex items-center justify-center">
      <div className="alert-overlay-scrim absolute inset-0 backdrop-blur-xl" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(900px 600px at 50% 40%, rgb(224 57 62 / 0.16), transparent 65%)' }}
      />
      <div className="hazard absolute inset-x-0 top-0 h-1.5 opacity-50" />
      <div className="hazard absolute inset-x-0 bottom-0 h-1.5 opacity-50" />

      <div className="zoom-in relative flex max-w-lg flex-col items-center px-6 text-center">
        <PostureFigure state="warn3" className="breathe h-24 w-24 text-warn3" />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-warn3">
          Posture Alert · Level 3
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">잠깐, 자세가 무너졌어요</h1>
        <p className="mt-3 text-base leading-relaxed text-mid">
          허리를 세우고, 어깨를 펴고, 턱을 살짝 당겨 주세요.
        </p>
        <div className="mt-4 font-mono text-sm text-warn3">{fmtDurShort(sec)}째 이어지는 중 · {fmtClock(sec)}</div>
        <Btn kind="primary" size="lg" className="mt-8" onClick={onResolve}>
          <Icon name="check" size={18} />
          바르게 앉았어요
        </Btn>
        {rec && (
          <Btn kind="outline" className="mt-3" onClick={onStretch}>
            <Icon name="person" size={15} />
            {rec.name}로 풀어주기 · {rec.hold}초
          </Btn>
        )}
        <p className="mt-4 text-xs text-dim">
          실제 서비스에선 자세 복구가 감지되면 자동으로 사라져요 — 지금은 버튼으로 시뮬레이션합니다.
        </p>
      </div>
    </div>
  )
}
