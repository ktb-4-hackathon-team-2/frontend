import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { STRETCHES, TARGET_LABEL, REGION_TO_ISSUES, weakestRegion } from '../data/dummy'
import { CameraView } from '../components/CameraView'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { STRETCH_RULES, drawPose } from '../lib/poseRules'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader } from '../components/ui'
import { fmtClock } from '../lib/format'
import { playChime } from '../lib/sound'

// ── 스켈레톤 기반 목표 자세 가이드 ────────────────────────────────────
// 거울 미리보기 기준(사용자가 보는 방향)으로 그린다.
const GUIDES = {
  neck_side_left: { head: [96, 38] },
  neck_side_right: { head: [124, 38] },
  chin_tuck: {
    head: [110, 42],
    marks: ['M84 34 l7 7 -7 7', 'M136 34 l-7 7 7 7'],
  },
  shoulder_shrug: {
    head: [110, 34],
    shoulders: [
      [80, 56],
      [140, 56],
    ],
    marks: ['M72 46 l7 -7 7 7', 'M134 46 l7 -7 7 7'],
  },
  chest_opener: {
    armL: [
      [80, 64],
      [48, 62],
      [18, 60],
    ],
    armR: [
      [140, 64],
      [172, 62],
      [202, 60],
    ],
  },
  arms_up: {
    armL: [
      [84, 64],
      [78, 36],
      [76, 12],
    ],
    armR: [
      [136, 64],
      [142, 36],
      [144, 12],
    ],
  },
}

function SkeletonGuide({ id, className = '' }) {
  const g = GUIDES[id] || {}
  const head = g.head || [110, 36]
  const sh = g.shoulders || [
    [80, 64],
    [140, 64],
  ]
  const shY = sh[0][1]
  const armL = g.armL || [sh[0], [sh[0][0] - 8, shY + 22], [sh[0][0] - 12, shY + 42]]
  const armR = g.armR || [sh[1], [sh[1][0] + 8, shY + 22], [sh[1][0] + 12, shY + 42]]
  const poly = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')

  return (
    <svg viewBox="0 0 220 150" className={className} fill="none" aria-hidden>
      <g stroke="#3ec98f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${sh[0][0]} ${shY} L${sh[1][0]} ${sh[1][1]}`} />
        <path d={`M110 ${shY} L110 112`} />
        <path d="M88 112 L132 112" opacity="0.5" />
        <path d={`M110 ${shY} L${head[0]} ${head[1] + 8}`} />
        <path d={poly(armL)} />
        <path d={poly(armR)} />
      </g>
      <circle cx={head[0]} cy={head[1]} r="11" fill="#3ec98f" />
      {(g.marks || []).map((d) => (
        <path key={d} d={d} stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

// ── 진행 링 ──────────────────────────────────────────────────────────
function TimerRing({ remaining, total, label }) {
  const R = 56
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-36 w-36 shrink-0">
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
  const rule = STRETCH_RULES[stretch.id]
  const pose = usePoseLandmarker(true)
  const camOn = camera.status === 'active'
  const camBlocked = ['denied', 'notfound', 'busy', 'error'].includes(camera.status)
  const tracking = Boolean(rule) && camOn && pose.status === 'ready'
  // 판정 룰이 없거나(턱 당기기) 카메라/모델을 못 쓰면 타이머로 진행
  const timerMode = !rule || pose.status === 'error' || camBlocked
  const holdTarget = stretch.hold * 1000

  const [done, setDone] = useState(false)
  const [heldMs, setHeldMs] = useState(0)
  const [remaining, setRemaining] = useState(stretch.hold)
  const [running, setRunning] = useState(true)
  const [live, setLive] = useState({ conds: null, hint: null, detected: false })
  const heldRef = useRef(0)
  const remRef = useRef(stretch.hold)
  const ruleCtxRef = useRef({})
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // 모든 스트레칭은 카메라를 켠 채 진행 — 꺼져 있으면 자동으로 켠다
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStarted.current && camera.status === 'idle') {
      autoStarted.current = true
      camera.start()
    }
  }, [camera])

  const complete = useCallback(() => {
    playChime('wood')
    setDone(true)
  }, [])

  const restart = () => {
    heldRef.current = 0
    remRef.current = stretch.hold
    ruleCtxRef.current = {}
    setHeldMs(0)
    setRemaining(stretch.hold)
    setRunning(true)
    setDone(false)
  }

  // 실시간 판정 루프 — 조건을 유지한 시간이 hold 목표에 닿으면 완료
  useEffect(() => {
    if (!tracking || done) return
    const id = setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const result = pose.detect(video)
      const lm = result?.landmarks?.[0] ?? null
      const ev = lm ? rule(lm, { ref: ruleCtxRef.current }) : null
      drawPose(canvasRef.current, video, lm, Boolean(ev?.all))
      if (ev?.all) heldRef.current = Math.min(holdTarget, heldRef.current + TICK_MS)
      else heldRef.current = Math.max(0, heldRef.current - TICK_MS * 1.5)
      setHeldMs(heldRef.current)
      setLive({ conds: ev?.conds ?? null, hint: ev?.hint ?? null, detected: Boolean(lm) })
      if (heldRef.current >= holdTarget) complete()
    }, TICK_MS)
    return () => clearInterval(id)
  }, [tracking, done, rule, pose.detect, holdTarget, complete])

  // 타이머 폴백
  useEffect(() => {
    if (!timerMode || done || !running) return
    const id = setInterval(() => {
      remRef.current -= 1
      if (remRef.current <= 0) complete()
      else setRemaining(remRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [timerMode, done, running, complete])

  // 판정이 없는 모드에서도 스켈레톤은 계속 시각화한다
  useEffect(() => {
    if (!camOn || pose.status !== 'ready' || tracking || done) return
    const id = setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const result = pose.detect(video)
      drawPose(canvasRef.current, video, result?.landmarks?.[0] ?? null, false)
    }, 200)
    return () => clearInterval(id)
  }, [camOn, pose.status, pose.detect, tracking, done])

  const holdLeft = Math.max(0, Math.ceil((holdTarget - heldMs) / 1000))
  const statusChip = !rule
    ? { text: '타이머 모드', tone: 'text-dim' }
    : pose.status === 'loading'
      ? { text: '모델 로딩 중…', tone: 'text-warn1' }
      : pose.status === 'error'
        ? { text: '모델 로딩 실패 — 타이머 모드', tone: 'text-warn2' }
        : !camOn
          ? { text: '카메라 준비 중…', tone: 'text-dim' }
          : live.detected
            ? { text: '인식 중', tone: 'text-good' }
            : { text: '사람을 찾는 중…', tone: 'text-dim' }

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="rise col-span-7 flex flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <MicroLabel>진행 중</MicroLabel>
            <h2 className="mt-1 text-xl font-bold">{stretch.name}</h2>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {stretch.targets.map((t) => (
              <span key={t} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-mid">
                {TARGET_LABEL[t]}
              </span>
            ))}
          </div>
        </div>

        {/* 스켈레톤 기반 자세 가이드 */}
        <div className="rounded-xl border border-line bg-raised/60 p-4">
          <div className="flex items-center justify-between">
            <MicroLabel>스켈레톤 자세 가이드</MicroLabel>
            <span className="font-mono text-[11px] text-dim">{stretch.hold}초 유지</span>
          </div>
          <SkeletonGuide id={stretch.id} className="mx-auto h-44" />
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
          <TimerRing
            remaining={done ? 0 : tracking ? holdLeft : remaining}
            total={stretch.hold}
            label={tracking ? 'Hold' : 'Sec'}
          />
          <div className="flex flex-1 flex-col gap-3">
            {done ? (
              <div className="flex items-center gap-2 text-sm text-good">
                <Icon name="check" size={16} />
                수고했어요! 목과 어깨가 한결 가벼워졌을 거예요.
              </div>
            ) : tracking ? (
              <p className="text-xs leading-relaxed text-mid">
                가이드 자세와 일치한 상태를 <span className="font-mono text-hi">{stretch.hold}초</span> 유지하면
                자동으로 완료돼요.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-mid">
                {rule
                  ? '카메라와 판정 모델이 준비되면 자동 판정으로 전환돼요.'
                  : '이 동작은 정면 판정이 어려워 타이머로 진행해요. 카메라로 자세는 계속 보여드려요.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {done ? (
                <>
                  <Btn size="sm" kind="outline" onClick={restart}>
                    <Icon name="refresh" size={13} />한 번 더
                  </Btn>
                  <Btn size="sm" kind="primary" onClick={onExit}>
                    목록으로
                  </Btn>
                </>
              ) : (
                <>
                  {timerMode && (
                    <Btn size="sm" kind="outline" onClick={() => setRunning(!running)}>
                      <Icon name={running ? 'pause' : 'play'} size={13} />
                      {running ? '일시정지' : '계속'}
                    </Btn>
                  )}
                  <Btn size="sm" kind="ghost" onClick={complete}>
                    건너뛰기
                  </Btn>
                  <Btn size="sm" kind="ghost" onClick={onExit}>
                    <Icon name="x" size={13} />
                    종료
                  </Btn>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 실시간 내 자세 — 모든 동작에서 카메라 사용 */}
      <Card className="rise d2 col-span-5 flex flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <MicroLabel>실시간 내 자세</MicroLabel>
          <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${statusChip.tone}`}>
            {statusChip.text}
          </span>
        </div>
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
                style={{ width: `${(heldMs / holdTarget) * 100}%` }}
              />
            </div>
            <p className="min-h-4 text-xs text-mid">{live.hint ?? (heldMs > 0 ? '좋아요 — 그대로 유지하세요' : ' ')}</p>
          </div>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-dim">
            {pose.status === 'loading'
              ? '판정 모델을 불러오는 중이에요. 최초 1회, 몇 초 걸려요.'
              : camBlocked
                ? '카메라를 사용할 수 없어 타이머로 진행해요. 위 화면에서 카메라 상태를 확인해 주세요.'
                : rule
                  ? '스켈레톤이 초록색으로 바뀌면 가이드 자세와 일치한 거예요.'
                  : '스켈레톤으로 내 자세를 보면서 가이드를 따라해 보세요.'}
          </p>
        )}
      </Card>
    </div>
  )
}

export default function Stretch() {
  const { posture, stretchLeft, startStretchNow, localDetection, aiEnabled } = useApp()
  const [activeId, setActiveId] = useState(null)
  const active = STRETCHES.find((s) => s.id === activeId)

  // AI 모드면 방금 감지된 issue code로, 아니면 취약 부위 매핑으로 추천
  const liveIssues = aiEnabled && localDetection.issues?.length ? localDetection.issues : null
  const issueSet = liveIssues ?? REGION_TO_ISSUES[weakestRegion(posture)] ?? []
  const isRecommended = (s) => s.targets.some((t) => issueSet.includes(t))
  const sorted = [...STRETCHES].sort((a, b) => Number(isRecommended(b)) - Number(isRecommended(a)))

  if (active) return <ActiveSession stretch={active} onExit={() => setActiveId(null)} />

  return (
    <div>
      <ScreenHeader
        title="스트레칭"
        desc={`앉아서 하는 상반신 동작 6종 · ${liveIssues ? '방금 감지된 자세 문제' : '현재 취약 부위'} 기준으로 추천해요.`}
        right={
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <Icon name="clock" size={15} className="text-dim" />
            <span className="text-xs text-mid">다음 제안까지</span>
            <span className="font-mono text-sm font-semibold">{fmtClock(stretchLeft)}</span>
          </Card>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        {sorted.map((s, i) => {
          const recommended = isRecommended(s)
          const hasRule = Boolean(STRETCH_RULES[s.id])
          return (
            <Card
              key={s.id}
              className={`rise d${Math.min(i + 1, 6)} flex flex-col p-5 ${recommended ? 'border-good/30 bg-good/[0.04]' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-bold leading-snug">{s.name}</h3>
                {recommended && <Chip tone="good">추천</Chip>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-mid">
                  {s.hold}초 유지
                </span>
                <span className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-mid">
                  <Icon name="camera" size={10} />
                  {hasRule ? '실시간 판정' : '타이머'}
                </span>
              </div>
              <p className="mt-2.5 flex-1 text-xs leading-relaxed text-dim">
                {s.targets.map((t) => TARGET_LABEL[t]).join(' · ')}
              </p>
              <Btn
                size="sm"
                kind={recommended ? 'primary' : 'outline'}
                className="mt-3 self-start"
                onClick={() => setActiveId(s.id)}
              >
                <Icon name="play" size={13} />
                시작하기
              </Btn>
            </Card>
          )
        })}
      </div>

      <Card className="rise d6 mt-4 flex items-center gap-3 px-6 py-4">
        <Icon name="clock" size={16} className="shrink-0 text-dim" />
        <p className="flex-1 text-xs leading-relaxed text-mid">
          모든 동작은 카메라를 켠 채 진행돼요 — 스켈레톤 가이드와 내 자세를 비교하면서 따라해 보세요.
        </p>
        <Btn size="sm" kind="ghost" onClick={startStretchNow}>
          타이머 리셋하고 지금 하기
        </Btn>
      </Card>
    </div>
  )
}
