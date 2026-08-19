import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { STRETCHES, REGION_LABEL, weakestRegion } from '../data/dummy'
import { CameraView } from '../components/CameraView'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { POSE_RULES, HOLD_MS, drawPose } from '../lib/poseRules'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader } from '../components/ui'
import { fmtClock } from '../lib/format'
import { playChime } from '../lib/sound'

function TimerRing({ remaining, total, label = 'Sec' }) {
  const R = 56
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90">
        <circle cx="68" cy="68" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="68"
          cy="68"
          r={R}
          fill="none"
          stroke="#3ec98f"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - remaining / total)}
          className="transition-all duration-300 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold">{remaining}</span>
        <MicroLabel>{label}</MicroLabel>
      </div>
    </div>
  )
}

const TICK_MS = 100

function ActiveSession({ stretch, onExit }) {
  const { camera } = useApp()
  const rule = POSE_RULES[stretch.id]
  const pose = usePoseLandmarker(Boolean(rule))
  const camOn = camera.status === 'active'
  // 룰이 있고 + 카메라 + 모델 준비까지 되면 자동 판정, 아니면 수동 타이머로 폴백
  const tracking = Boolean(rule) && camOn && pose.status === 'ready'

  const [rep, setRep] = useState(1)
  const [done, setDone] = useState(false)
  const [running, setRunning] = useState(true)
  const [remaining, setRemaining] = useState(stretch.dur)
  const [live, setLive] = useState({ conds: null, hint: null, hold: 0, detected: false })

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const holdRef = useRef(0)
  const lastSideRef = useRef(null)
  const repRef = useRef(1)
  const remRef = useRef(stretch.dur)
  useEffect(() => {
    repRef.current = rep
  }, [rep])

  const completeRep = useCallback(() => {
    playChime('wood')
    holdRef.current = 0
    remRef.current = stretch.dur
    setRemaining(stretch.dur)
    if (repRef.current >= stretch.reps) setDone(true)
    else setRep(repRef.current + 1)
  }, [stretch.dur, stretch.reps])

  // 수동 타이머 (판정 미지원 동작 / 카메라 꺼짐 / 모델 로딩 중)
  useEffect(() => {
    if (tracking || done || !running) return
    const id = setInterval(() => {
      remRef.current -= 1
      if (remRef.current <= 0) completeRep()
      else setRemaining(remRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [tracking, done, running, completeRep])

  // 자동 판정 루프 — 조건 충족 상태를 HOLD_MS 유지하면 세트 완료
  useEffect(() => {
    if (!tracking || done) return
    const id = setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const result = pose.detect(video)
      const lm = result?.landmarks?.[0] ?? null
      const ev = lm ? rule(lm, { lastSide: lastSideRef.current, rep: repRef.current }) : null
      drawPose(canvasRef.current, video, lm, Boolean(ev?.all))
      if (ev?.all) holdRef.current = Math.min(HOLD_MS, holdRef.current + TICK_MS)
      else holdRef.current = Math.max(0, holdRef.current - TICK_MS * 1.5)
      if (holdRef.current >= HOLD_MS) {
        lastSideRef.current = ev?.side ?? null
        completeRep()
      }
      setLive({ conds: ev?.conds ?? null, hint: ev?.hint ?? null, hold: holdRef.current, detected: Boolean(lm) })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [tracking, done, rule, pose.detect, completeRep]) // eslint-disable-line react-hooks/exhaustive-deps

  const holdSecLeft = Math.max(0, Math.ceil((HOLD_MS - live.hold) / 1000))

  const trackStatus = !rule
    ? null
    : pose.status === 'loading'
      ? { text: '모델 로딩 중…', tone: 'text-warn1' }
      : pose.status === 'error'
        ? { text: '모델 로딩 실패 — 타이머 모드', tone: 'text-warn2' }
        : !camOn
          ? { text: '카메라 꺼짐 — 타이머 모드', tone: 'text-dim' }
          : live.detected
            ? { text: '인식 중', tone: 'text-good' }
            : { text: '사람을 찾는 중…', tone: 'text-dim' }

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="rise col-span-7 flex flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <MicroLabel>진행 중</MicroLabel>
            <h2 className="mt-1 text-xl font-bold">{stretch.name}</h2>
          </div>
          <Chip tone="good">{stretch.tag}</Chip>
        </div>

        {/* 교본 일러스트 자리 */}
        <div className="flex aspect-[16/8] items-center justify-center rounded-xl border border-dashed border-line-strong bg-raised/60">
          <div className="flex flex-col items-center gap-2 text-center">
            <Icon name="person" size={30} className="text-dim" />
            <MicroLabel>교본 일러스트 · 영상 자리</MicroLabel>
          </div>
        </div>

        <ol className="mt-5 flex flex-col gap-2.5">
          {stretch.steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-sm text-mid">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[10px] text-hi">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        <div className="mt-6 flex items-center gap-6 border-t border-line pt-6">
          {tracking ? (
            <TimerRing remaining={done ? 0 : holdSecLeft} total={HOLD_MS / 1000} label="Hold" />
          ) : (
            <TimerRing remaining={remaining} total={stretch.dur} />
          )}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <MicroLabel>Set</MicroLabel>
              <div className="flex gap-1.5">
                {Array.from({ length: stretch.reps }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-6 rounded-full ${
                      done || i < rep - 1 ? 'bg-good' : i === rep - 1 ? 'bg-good/40' : 'bg-white/[0.08]'
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono text-xs text-mid">
                {done ? stretch.reps : rep}/{stretch.reps}
              </span>
            </div>
            {done ? (
              <div className="flex items-center gap-2 text-sm text-good">
                <Icon name="check" size={16} />
                수고했어요! 다음 제안은 50분 뒤에요.
              </div>
            ) : tracking ? (
              <p className="text-xs leading-relaxed text-mid">
                카메라 판정으로 자동 진행 중 — 조건을 만족한 채{' '}
                <span className="font-mono text-hi">{HOLD_MS / 1000}초</span> 유지하면 다음 세트로 넘어가요.
              </p>
            ) : (
              <div className="flex gap-2">
                <Btn size="sm" kind="outline" onClick={() => setRunning(!running)}>
                  <Icon name={running ? 'pause' : 'play'} size={13} />
                  {running ? '일시정지' : '계속'}
                </Btn>
                <Btn size="sm" kind="ghost" onClick={completeRep}>
                  다음 세트
                </Btn>
              </div>
            )}
            <div className="flex gap-2">
              {tracking && !done && (
                <Btn size="sm" kind="ghost" onClick={completeRep}>
                  세트 건너뛰기
                </Btn>
              )}
              <Btn size="sm" kind="ghost" onClick={onExit}>
                <Icon name="x" size={13} />
                종료
              </Btn>
            </div>
          </div>
        </div>
      </Card>

      {/* 실시간 자세 판정 / 비교 영역 */}
      <Card className="rise d2 col-span-5 flex flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <MicroLabel>실시간 자세 판정</MicroLabel>
          {trackStatus && (
            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${trackStatus.tone}`}>
              {trackStatus.text}
            </span>
          )}
        </div>

        {rule ? (
          <>
            <CameraView
              videoRef={videoRef}
              className="aspect-video"
              overlay={<canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />}
            />
            {tracking && live.conds ? (
              <div className="mt-4 flex flex-col gap-2">
                {live.conds.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 text-xs">
                    <Icon name="check" size={13} className={c.ok ? 'text-good' : 'text-dim'} />
                    <span className={c.ok ? 'text-mid' : 'text-dim'}>{c.label}</span>
                    {c.value && <span className="ml-auto font-mono text-dim">{c.value}</span>}
                  </div>
                ))}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-good transition-all duration-150"
                    style={{ width: `${(live.hold / HOLD_MS) * 100}%` }}
                  />
                </div>
                <p className="min-h-4 text-xs text-mid">
                  {live.hint ?? (live.hold > 0 ? '좋아요 — 그대로 유지하세요' : ' ')}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-dim">
                {pose.status === 'loading'
                  ? '판정 모델을 불러오는 중이에요. 최초 1회, 몇 초 걸려요.'
                  : pose.status === 'error'
                    ? '모델을 불러오지 못해 타이머 모드로 진행돼요. 네트워크 연결을 확인해 주세요.'
                    : !camOn
                      ? '카메라를 켜면 동작 일치 여부를 실시간으로 판정하고 세트를 자동으로 세요. 지금은 타이머로 진행돼요.'
                      : '프레임에서 사람을 찾고 있어요 — 상반신이 보이게 앉아 주세요.'}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-raised/40 p-6 text-center">
            <Icon name="camera" size={26} className="text-dim" />
            <p className="max-w-[240px] text-xs leading-relaxed text-dim">
              이 동작은 정면 웹캠으로 판정이 어려워 타이머로 진행해요. 측면 판정은 연결 예정이에요.
            </p>
            <MicroLabel>목 옆 늘리기는 실시간 판정 지원</MicroLabel>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function Stretch() {
  const { posture, stretchLeft, startStretchNow } = useApp()
  const [activeId, setActiveId] = useState(null)
  const weak = weakestRegion(posture)
  const active = STRETCHES.find((s) => s.id === activeId)

  if (active) return <ActiveSession stretch={active} onExit={() => setActiveId(null)} />

  return (
    <div>
      <ScreenHeader
        title="스트레칭"
        desc="50분마다 제안해요. 지금 무너진 부위에 맞는 동작부터."
        right={
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <Icon name="clock" size={15} className="text-dim" />
            <span className="text-xs text-mid">다음 제안까지</span>
            <span className="font-mono text-sm font-semibold">{fmtClock(stretchLeft)}</span>
          </Card>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        {STRETCHES.map((s, i) => {
          const recommended = s.region === weak
          const hasRule = Boolean(POSE_RULES[s.id])
          return (
            <Card
              key={s.id}
              className={`rise d${i + 1} flex flex-col p-6 ${recommended ? 'border-good/30 bg-good/[0.04]' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{s.name}</h3>
                    {recommended && <Chip tone="good">지금 추천</Chip>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-dim">
                    {REGION_LABEL[s.region]} · {s.tag}
                    {hasRule && (
                      <span className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-mid">
                        <Icon name="camera" size={10} />
                        실시간 판정
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-mid">
                  {s.dur}초 × {s.reps}
                </span>
              </div>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-mid">{s.steps[0]} …</p>
              {recommended && (
                <p className="mt-2 text-xs text-good">
                  현재 {REGION_LABEL[weak]} 점수가 가장 낮아요 — 이 동작부터 해볼까요?
                </p>
              )}
              <Btn kind={recommended ? 'primary' : 'outline'} className="mt-4 self-start" onClick={() => setActiveId(s.id)}>
                <Icon name="play" size={14} />
                시작하기
              </Btn>
            </Card>
          )
        })}
      </div>

      <Card className="rise d5 mt-4 flex items-center gap-3 px-6 py-4">
        <Icon name="clock" size={16} className="shrink-0 text-dim" />
        <p className="flex-1 text-xs leading-relaxed text-mid">
          다음 제안을 기다리지 않아도 돼요. 타이머를 리셋하고 바로 시작할 수 있어요.
        </p>
        <Btn size="sm" kind="ghost" onClick={startStretchNow}>
          타이머 리셋하고 지금 하기
        </Btn>
      </Card>
    </div>
  )
}
