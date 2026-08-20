import { useEffect, useRef, useState } from 'react'
import { useApp, DETECT_INTERVAL_MS } from '../state/AppContext'
import { api, getAccessToken } from '../lib/api'
import { drawPose } from '../lib/poseRules'
import { CameraView } from '../components/CameraView'
import { Btn, Card, Chip, Icon, MicroLabel, PostureFigure, TONE } from '../components/ui'
import { REGION_LABEL } from '../data/dummy'
import { fmtClock, fmtDur, fmtDurShort } from '../lib/format'
import { SettingsPanel } from '../components/SettingsPanel'

// 3×3 삼분할 격자 — 프레이밍 참고선
function drawGrid(canvas) {
  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, cw, ch)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 2; i++) {
    const x = (cw * i) / 3
    const y = (ch * i) / 3
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, ch)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(cw, y)
    ctx.stroke()
  }
}

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
    adjustStretch, localDetection, endMonitoring,
    detectionVideoRef, pose, cameraView,
  } = useApp()
  const overlayRef = useRef(null)

  // 격자 + 스켈레톤 오버레이 — 판정 틱(2초)과 별개로 0.3초 주기의 자체 그리기 루프.
  // 이 화면에 있을 때만 돌므로 다른 화면의 판정 비용에는 영향 없다.
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const draw = () => {
      drawGrid(canvas)
      const video = detectionVideoRef.current
      if (paused || !video || pose.status !== 'ready') return
      const result = pose.detect(video)
      const lm = result?.landmarks?.[0] ?? null
      if (lm) drawPose(canvas, video, lm, posture === 'good', { clear: false })
    }
    draw()
    const id = setInterval(draw, 300)
    return () => clearInterval(id)
  }, [paused, posture, camera.status, pose.status, pose.detect, detectionVideoRef])
  // 판정 중이면 실측값(포팅된 posture.py 계산), 아니면 상태별 기본값
  const tracking = localDetection.status === 'tracking'
  const score = tracking && localDetection.displayScore != null ? localDetection.displayScore : meta.score
  const mainMsg = tracking && localDetection.reason ? localDetection.reason : meta.msg
  const regions = tracking && localDetection.regionScores ? localDetection.regionScores : meta.regions
  const tone = TONE[meta.tone]
  const stretchTotal = settings.stretchMin * 60
  // +10분으로 남은 시간이 주기보다 길어질 수 있으므로 0 밑으로 내려가지 않게 클램프
  const stretchProgress = Math.max(0, 1 - stretchLeft / stretchTotal)

  // 오늘·어제 기록 — 백엔드 대시보드에서 조회, 1분(집계 전송 주기)마다 갱신
  const [serverToday, setServerToday] = useState(null)
  const [yesterday, setYesterday] = useState(null)
  useEffect(() => {
    if (!getAccessToken()) return
    const fetchDays = () => {
      const now = new Date()
      const todayKey = `${now.getMonth() + 1}/${now.getDate()}`
      const y = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const yKey = `${y.getMonth() + 1}/${y.getDate()}`
      api
        .getReportDashboard()
        .then((data) => {
          const t = data?.days14?.find((d) => d.d === todayKey)
          const yd = data?.days14?.find((d) => d.d === yKey)
          if (t?.hasData) setServerToday(t)
          if (yd?.hasData) setYesterday(yd)
        })
        .catch(() => {})
    }
    fetchDays()
    const id = setInterval(fetchDays, 60_000)
    return () => clearInterval(id)
  }, [])

  // 오늘 유지율 — 서버의 하루 전체 집계(여러 세션 누적) 우선, 없으면 이번 세션 실측
  const sessionPct = localDetection.sessionRatio != null ? Math.round(localDetection.sessionRatio * 100) : null
  const todayPct = serverToday?.rate ?? sessionPct
  const todaySource = serverToday?.rate != null ? '오늘 전체 · 1분마다 갱신' : '이번 세션 실측'
  const rateDelta = todayPct != null && yesterday?.rate != null ? todayPct - yesterday.rate : null
  const alertDelta = yesterday?.alertCount != null ? alertCount - yesterday.alertCount : null

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
          <ScoreRing score={score} tone={tone} state={posture} paused={paused} />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold leading-snug">
              {paused ? '지금은 쉬는 중이에요' : mainMsg}
            </div>
            <div className="mt-1 font-mono text-xs text-dim">
              {paused ? '재개하면 이어서 지켜볼게요' : `이 상태로 ${fmtDurShort(postureSinceSec)}`}
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {Object.entries(regions).map(([key, v]) => {
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
        <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
          <span className="flex items-center gap-1.5 font-mono text-sm text-mid">
            <Icon name="clock" size={14} className="text-dim" />
            {fmtClock(elapsedSec)}
          </span>
          <span className="text-[11px] text-dim">오늘 모니터링</span>
          <div className="flex-1" />
          <Btn size="sm" kind="outline" onClick={() => setPaused(!paused)}>
            <Icon name={paused ? 'play' : 'pause'} size={13} />
            {paused ? '재개' : '일시정지'}
          </Btn>
          <Btn
            size="sm"
            kind="ghost"
            onClick={endMonitoring}
            disabled={camera.status !== 'active'}
            title="카메라를 끄고 지금까지의 기록을 서버로 전송합니다"
          >
            <Icon name="videoOff" size={13} />
            모니터링 종료
          </Btn>
        </div>
        {!tracking && localDetection.reason && (
          <p className="mt-3 text-xs text-dim">{localDetection.reason}</p>
        )}
      </Card>

      {/* 카메라 */}
      <Card className="rise d2 col-span-5 flex flex-col p-5">
        <div className="mb-4 flex items-center justify-between">
          <MicroLabel>카메라</MicroLabel>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-white/[0.06] border border-line px-2 py-0.5 text-[10px] font-mono text-mid">
              {cameraView === 'front' ? '정면 뷰' : cameraView === 'left_diagonal' ? '좌측 대각 뷰' : '우측 대각 뷰'}
            </span>
          </div>
        </div>
        <CameraView
          className="aspect-[4/3]"
          overlay={<canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />}
        />
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              camera.status === 'active' && !paused ? 'bg-good blink-dot' : 'bg-white/20'
            }`}
          />
          <span className="font-mono text-[11px] text-dim">
            LOOP {DETECT_INTERVAL_MS}ms · TICK {tick.toLocaleString()}
          </span>
          <span className="ml-auto text-[11px] text-dim">
            {tracking
              ? 'On-device 판정 · 인식 중'
              : localDetection.status === 'loading'
                ? 'On-device 판정 · 로딩 중'
                : localDetection.status === 'error'
                  ? 'On-device 판정 · 오류'
                  : 'On-device 판정 · 대기'}
          </span>
        </div>
      </Card>

      {/* 오늘 요약 */}
      <div className="col-span-12 grid grid-cols-4 gap-4">
        <Card className="rise d3 flex flex-col gap-2 p-5">
          <MicroLabel>오늘 유지율</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{todayPct ?? '—'}</span>
            {todayPct != null && <span className="text-sm text-mid">%</span>}
          </div>
          {rateDelta != null ? (
            <div className={`text-xs ${rateDelta >= 0 ? 'text-good' : 'text-warn2'}`}>
              {rateDelta >= 0 ? '+' : ''}
              {rateDelta}%p · 어제보다
            </div>
          ) : (
            <div className="text-xs text-dim">{todayPct != null ? todaySource : '측정 대기 중'}</div>
          )}
        </Card>
        <Card className="rise d4 flex flex-col gap-2 p-5">
          <MicroLabel>알림 횟수</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{alertCount}</span>
            <span className="text-sm text-mid">회</span>
          </div>
          {alertDelta != null ? (
            <div className={`text-xs ${alertDelta <= 0 ? 'text-good' : 'text-warn2'}`}>
              {alertDelta > 0 ? '+' : ''}
              {alertDelta}회 · 어제보다
            </div>
          ) : (
            <div className="text-xs text-dim">오늘 누적</div>
          )}
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
          <div className="mt-1 flex gap-1">
            <Btn size="sm" kind="ghost" className="flex-1 whitespace-nowrap px-1!" onClick={() => adjustStretch(-10)}>
              −10분
            </Btn>
            <Btn size="sm" kind="ghost" className="flex-1 whitespace-nowrap px-1!" onClick={() => adjustStretch(-1)}>
              −1분
            </Btn>
            <Btn size="sm" kind="ghost" className="flex-1 whitespace-nowrap px-1!" onClick={() => adjustStretch(1)}>
              +1분
            </Btn>
            <Btn size="sm" kind="ghost" className="flex-1 whitespace-nowrap px-1!" onClick={() => adjustStretch(10)}>
              +10분
            </Btn>
          </div>
        </Card>
      </div>

      {/* 설정 — 모니터링 화면에서 바로 조절 (설정 화면과 동일한 패널) */}
      <div className="col-span-12 mt-2">
        <MicroLabel className="mb-3">설정</MicroLabel>
        <SettingsPanel compact />
      </div>
    </div>
  )
}
