import { useApp, DETECT_INTERVAL_MS } from '../state/AppContext'
import { CameraView } from '../components/CameraView'
import { Btn, Card, Chip, Icon, MicroLabel, PostureFigure, TONE } from '../components/ui'
import { REGION_LABEL } from '../data/dummy'
import { fmtClock, fmtDur, fmtDurShort } from '../lib/format'

function regionTone(v) {
  if (v >= 80) return TONE.good
  if (v >= 60) return TONE.warn1
  if (v >= 40) return TONE.warn2
  return TONE.warn3
}

function ScoreRing({ score, tone, state, paused }) {
  const R = 74
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-[184px] w-[184px] shrink-0">
      <svg viewBox="0 0 184 184" className="h-full w-full -rotate-90">
        <circle cx="92" cy="92" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle
          cx="92"
          cy="92"
          r={R}
          fill="none"
          stroke={paused ? 'rgba(255,255,255,0.2)' : tone.hex}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - (paused ? 0 : score) / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <PostureFigure state={paused ? 'good' : state} className={`h-12 w-12 ${paused ? 'text-dim' : tone.text}`} />
        <div className="font-mono text-3xl font-semibold leading-none tracking-tight">
          {paused ? '--' : score}
        </div>
        <MicroLabel>Score</MicroLabel>
      </div>
    </div>
  )
}

export default function Monitor() {
  const {
    meta, posture, paused, setPaused, postureSinceSec,
    alertCount, elapsedSec, stretchLeft, settings, camera, tick,
    startStretchNow, postponeStretch,
  } = useApp()
  const tone = TONE[meta.tone]
  const stretchTotal = settings.stretchMin * 60
  const stretchProgress = 1 - stretchLeft / stretchTotal

  return (
    <div className="grid grid-cols-12 gap-4">
      {paused && (
        <Card className="rise col-span-12 flex items-center gap-3 border-warn1/30 bg-warn1/[0.06] px-5 py-4">
          <Icon name="pause" size={18} className="text-warn1" />
          <div className="flex-1">
            <div className="text-sm font-semibold">모니터링이 일시정지되어 있어요</div>
            <div className="text-xs text-mid">감지와 기록이 멈춘 상태예요. 자리에 돌아오면 재개해 주세요.</div>
          </div>
          <Btn size="sm" kind="primary" onClick={() => setPaused(false)}>
            <Icon name="play" size={13} />
            재개하기
          </Btn>
        </Card>
      )}

      {/* 현재 상태 */}
      <Card className="rise d1 col-span-7 flex flex-col p-6">
        <div className="mb-5 flex items-center justify-between">
          <MicroLabel>현재 상태 · Live</MicroLabel>
          <Chip tone={paused ? 'neutral' : meta.tone}>{paused ? '일시정지' : meta.label}</Chip>
        </div>
        <div className="flex items-center gap-7">
          <ScoreRing score={meta.score} tone={tone} state={posture} paused={paused} />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold leading-snug">
              {paused ? '지금은 쉬는 중이에요' : meta.msg}
            </div>
            <div className="mt-1 font-mono text-xs text-dim">
              {paused ? '재개하면 이어서 지켜볼게요' : `이 상태로 ${fmtDurShort(postureSinceSec)}`}
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {Object.entries(meta.regions).map(([key, v]) => {
                const t = regionTone(v)
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-mid">{REGION_LABEL[key]}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className={`h-full rounded-full ${paused ? 'bg-white/20' : t.bg} transition-all duration-700`}
                        style={{ width: `${paused ? 0 : v}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-xs text-mid">{paused ? '--' : v}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <p className="mt-6 border-t border-line pt-4 text-xs text-dim">
          자세 판정 로직은 아직 연결 전이에요 — 좌측 하단 <span className="font-mono text-mid">DEV</span> 패널로 상태를
          바꿔볼 수 있어요.
        </p>
      </Card>

      {/* 카메라 */}
      <Card className="rise d2 col-span-5 flex flex-col p-5">
        <div className="mb-4 flex items-center justify-between">
          <MicroLabel>카메라</MicroLabel>
          <span className="text-[11px] text-dim">영상은 기기 밖으로 나가지 않아요</span>
        </div>
        <CameraView className="aspect-video" />
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              camera.status === 'active' && !paused ? 'bg-good blink-dot' : 'bg-white/20'
            }`}
          />
          <span className="font-mono text-[11px] text-dim">
            LOOP {DETECT_INTERVAL_MS}ms · TICK {tick.toLocaleString()}
          </span>
          <span className="ml-auto text-[11px] text-dim">MediaPipe Pose 연결 예정</span>
        </div>
      </Card>

      {/* 오늘 요약 */}
      <div className="col-span-12 grid grid-cols-4 gap-4">
        <Card className="rise d3 flex flex-col gap-2 p-5">
          <MicroLabel>오늘 유지율</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">87</span>
            <span className="text-sm text-mid">%</span>
          </div>
          <div className="text-xs text-good">+4%p · 어제보다</div>
        </Card>
        <Card className="rise d4 flex flex-col gap-2 p-5">
          <MicroLabel>알림 횟수</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{alertCount}</span>
            <span className="text-sm text-mid">회</span>
          </div>
          <div className="text-xs text-good">−3회 · 어제보다</div>
        </Card>
        <Card className="rise d5 flex flex-col gap-2 p-5">
          <MicroLabel>모니터링 시간</MicroLabel>
          <div className="font-mono text-[28px] font-semibold leading-none">{fmtDur(elapsedSec)}</div>
          <div className="text-xs text-dim">오늘 누적</div>
        </Card>
        <Card className="rise d6 flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between">
            <MicroLabel>다음 스트레칭</MicroLabel>
            <Icon name="clock" size={13} className="text-dim" />
          </div>
          <div className="font-mono text-[28px] font-semibold leading-none">{fmtClock(stretchLeft)}</div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-good/70 transition-all duration-1000"
              style={{ width: `${stretchProgress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex gap-1.5">
            <Btn size="sm" kind="outline" className="flex-1" onClick={startStretchNow}>
              지금 하기
            </Btn>
            <Btn size="sm" kind="ghost" onClick={postponeStretch}>
              +10분
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}
