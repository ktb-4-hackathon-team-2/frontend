import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { useRouter } from '../state/RouterContext'
import { STRETCHES, TARGET_LABEL } from '../data/dummy'
import { CameraView } from '../components/CameraView'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { STRETCH_RULES, drawPose } from '../lib/poseRules'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader } from '../components/ui'
import { fmtClock } from '../lib/format'
import { playChime } from '../lib/sound'

// ── 모션 가이드 — 시작 자세 ↔ 목표 자세 두 키프레임을 왕복하는 루프 애니메이션.
// 동작 데이터(뷰 각도·움직이는 부위·화살표·체크포인트)를 분리해 재사용한다.
// 그림으로 표현할 수 없는 항목(시선·호흡 등)은 체크포인트 텍스트로 분리.
const JADE = '#3ec98f'
const DIM = 'rgba(62, 201, 143, 0.3)'
const ARROW = 'rgba(255, 255, 255, 0.6)'

// 동시에 지켜야 할 체크포인트 (순서 아님)
const MOTION_META = {
  neck_side_left: { checkpoints: ['한쪽 손을 머리 위로 넘겨 머리 옆에 가볍게 대기', '귀가 어깨에 닿는다는 느낌으로 천천히 기울이기', '반대쪽 어깨는 끌려 올라가지 않게'] },
  neck_side_right: { checkpoints: ['한쪽 손을 머리 위로 넘겨 머리 옆에 가볍게 대기', '귀가 어깨에 닿는다는 느낌으로 천천히 기울이기', '반대쪽 어깨는 끌려 올라가지 않게'] },
  chin_tuck: { checkpoints: ['시선은 정면 유지', '뒤통수를 뒤로 민다는 느낌', '이중턱이 만들어지면 잘 된 것'] },
  shoulder_shrug: { checkpoints: ['귀에 닿을 만큼 끌어올리기', '내릴 땐 힘을 툭 풀기', '호흡은 편안하게'] },
  chest_opener: {
    checkpoints: ['팔꿈치를 굽혀 손을 가슴 앞에 두고 시작', '팔꿈치를 옆으로 벌려 어깨 높이로 펼치기', '어깨를 으쓱하지 말고 시선은 정면'],
  },
  arms_up: { checkpoints: ['손끝을 하늘로 민다는 느낌', '몸통이 좌우로 기울지 않게', '어깨는 귀에서 멀게'] },
}

// CSS 애니메이션 지정 헬퍼 — 이름과 회전/이동 기준점(viewBox 좌표)
const ga = (name, origin) => ({ animationName: name, transformOrigin: origin })

// 정면 몸통 (톤 다운) — 움직이는 부위만 본색으로 강조된다
function FrontBase({ arms = true, head = true }) {
  return (
    <g stroke={DIM} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M84 62 L136 62" strokeWidth="22" />
      <path d="M110 64 L110 100" strokeWidth="38" />
      {arms && (
        <>
          <path d="M80 62 L73 86 L70 108" strokeWidth="11" />
          <path d="M140 62 L147 86 L150 108" strokeWidth="11" />
        </>
      )}
      {head && (
        <>
          <path d="M110 58 L110 49" strokeWidth="12" />
          <circle cx="110" cy="34" r="15" fill={DIM} stroke="none" />
        </>
      )}
    </g>
  )
}

// 측면 몸통 (톤 다운) — 깊이 방향 동작(턱 당기기 등)용
function SideBase({ arm = true, head = true }) {
  return (
    <g stroke={DIM} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M114 64 L106 102" strokeWidth="34" />
      {arm && <path d="M112 66 L122 92 L128 112" strokeWidth="11" />}
      {head && (
        <>
          <path d="M113 60 L120 47" strokeWidth="12" />
          <circle cx="123" cy="36" r="15" fill={DIM} stroke="none" />
        </>
      )}
    </g>
  )
}

function MotionGuide({ id, view = 'front', className = '' }) {
  const svgProps = { viewBox: '0 0 220 150', className, fill: 'none', 'aria-hidden': true }
  const front = view === 'front'

  if (id === 'neck_side_left' || id === 'neck_side_right') {
    const left = id === 'neck_side_left'
    if (front) {
      // 정면 — 판정(어깨 대비 머리 기울기)과 동일한 모습
      return (
        <svg {...svgProps}>
          <FrontBase head={false} />
          {left ? (
            <>
              <path
                className="neck-arm-left"
                d="M80 62 L73 86 L70 108"
                stroke={JADE}
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <g className="neck-hand-left" stroke={JADE} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="70" cy="108" r="6" fill={JADE} stroke="none" />
              </g>
            </>
          ) : (
            <>
              <path
                className="neck-arm-right"
                d="M140 62 L147 86 L150 108"
                stroke={JADE}
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <g className="neck-hand-right" stroke={JADE} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="150" cy="108" r="6" fill={JADE} stroke="none" />
              </g>
            </>
          )}
          <g className="ga" style={ga(left ? 'ga-tilt-l' : 'ga-tilt-r', '110px 60px')} stroke={JADE} strokeLinecap="round" fill="none">
            <path d="M110 58 L110 47" strokeWidth="12" />
            <circle cx="110" cy="34" r="15" fill={JADE} stroke="none" />
          </g>
          {left ? (
            <>
              <path d="M128 16 Q110 4 96 11" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
              <path d="M100 5 L89 13 L100 18 Z" fill={ARROW} />
            </>
          ) : (
            <>
              <path d="M92 16 Q110 4 124 11" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
              <path d="M120 5 L131 13 L120 18 Z" fill={ARROW} />
            </>
          )}
        </svg>
      )
    }
    // 측면 — 옆에서 보면 머리가 살짝 낮아지는 정도로 보인다
    return (
      <svg {...svgProps}>
        <SideBase head={false} />
        <path
          className="neck-arm-side"
          d="M112 66 L122 92 L128 112"
          stroke={JADE}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <g className="neck-hand-side" stroke={JADE} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="128" cy="112" r="6" fill={JADE} stroke="none" />
        </g>
        <g className="ga" style={ga('ga-tilt-side', '118px 52px')} stroke={JADE} strokeLinecap="round" fill="none">
          <path d="M113 60 L120 47" strokeWidth="12" />
          <circle cx="123" cy="36" r="15" fill={JADE} stroke="none" />
        </g>
        <path d="M152 20 Q140 10 128 14" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M132 8 L122 16 L133 20 Z" fill={ARROW} />
      </svg>
    )
  }

  if (id === 'chin_tuck') {
    if (front) {
      // 정면 — 깊이 방향 이동은 겹친 실루엣으로, 고개를 숙이지 않는 정렬은 수직 목선으로 보여준다.
      return (
        <svg {...svgProps}>
          <FrontBase head={false} />
          <path d="M78 16 L90 28" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M84 28 H90 V22" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M142 16 L130 28" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M136 28 H130 V22" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M110 58 L110 49" stroke={JADE} strokeWidth="12" strokeLinecap="round" />
          <circle cx="110" cy="34" r="15" fill={JADE} stroke="none" />
        </svg>
      )
    }
    // 측면 — 머리가 뒤로 미끄러지는 실제 동작
    return (
      <svg {...svgProps}>
        <SideBase head={false} />
        <g className="ga" style={ga('ga-tuck', '120px 45px')} stroke={JADE} strokeLinecap="round" fill="none">
          <path d="M113 60 L120 47" strokeWidth="12" />
          <circle cx="123" cy="36" r="15" fill={JADE} stroke="none" />
        </g>
        <path d="M168 30 L150 30" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M150 24 L140 30 L150 36 Z" fill={ARROW} />
      </svg>
    )
  }

  if (id === 'shoulder_shrug') {
    if (front) {
      return (
        <svg {...svgProps}>
          <g stroke={DIM} strokeLinecap="round" fill="none">
            <path d="M110 64 L110 100" strokeWidth="38" />
            <path d="M110 58 L110 49" strokeWidth="12" />
            <circle cx="110" cy="34" r="15" fill={DIM} stroke="none" />
          </g>
          <g className="ga" style={ga('ga-shrug', '110px 62px')} stroke={JADE} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M84 62 L136 62" strokeWidth="22" />
            <path d="M80 62 L73 86 L70 108" strokeWidth="11" />
            <path d="M140 62 L147 86 L150 108" strokeWidth="11" />
          </g>
          <path d="M56 72 L56 54" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M50 56 L56 45 L62 56 Z" fill={ARROW} />
          <path d="M164 72 L164 54" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M158 56 L164 45 L170 56 Z" fill={ARROW} />
        </svg>
      )
    }
    // 측면 — 어깨 블록과 팔이 함께 올라간다
    return (
      <svg {...svgProps}>
        <SideBase arm={false} />
        <g className="ga" style={ga('ga-shrug', '112px 64px')} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="112" cy="64" r="11" fill={JADE} />
          <path d="M112 66 L122 92 L128 112" stroke={JADE} strokeWidth="11" />
        </g>
        <path d="M152 70 L152 52" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M146 54 L152 43 L158 54 Z" fill={ARROW} />
      </svg>
    )
  }

  if (id === 'chest_opener') {
    // 정면 전용 — 팔꿈치를 굽힌 시작 자세에서 어깨 높이로 양팔을 펼친다.
    return (
      <svg {...svgProps}>
        <FrontBase arms={false} />
        <path
          className="chest-arm-left"
          d="M80 62 L63 75 L96 78"
          stroke={JADE}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          className="chest-arm-right"
          d="M140 62 L157 75 L124 78"
          stroke={JADE}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M72 42 H28" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M34 36 L24 42 L34 48 Z" fill={ARROW} />
        <path d="M148 42 H192" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M186 36 L196 42 L186 48 Z" fill={ARROW} />
      </svg>
    )
  }

  // arms_up
  if (front) {
    return (
      <svg {...svgProps}>
        <FrontBase arms={false} />
        <path
          className="arms-up-left"
          d="M80 62 L70 84 L67 108"
          stroke={JADE}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          className="arms-up-right"
          d="M140 62 L150 84 L153 108"
          stroke={JADE}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M52 32 L52 14" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M46 16 L52 5 L58 16 Z" fill={ARROW} />
        <path d="M168 32 L168 14" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M162 16 L168 5 L174 16 Z" fill={ARROW} />
      </svg>
    )
  }
  // 측면 — 팔이 몸 옆을 지나 귀 옆까지 올라간다
  return (
    <svg {...svgProps}>
      <SideBase arm={false} />
      <path
        className="arms-up-side"
        d="M112 66 L126 88 L130 112"
        stroke={JADE}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M142 30 L142 12" stroke={ARROW} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M136 14 L142 3 L148 14 Z" fill={ARROW} />
    </svg>
  )
}

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
  const frontOnlyGuide = stretch.id === 'chest_opener'
  const frontGuideLabel = frontOnlyGuide
    ? '정면 · 동작 순서'
    : stretch.id === 'chin_tuck'
      ? '정면 · 정렬 확인'
      : '정면 · 카메라 판정 기준'
  const sideGuideLabel = stretch.id === 'chin_tuck' ? '측면 · 실제 동작' : '측면 · 동작 이해'

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

        {/* 모션 가이드 — 가슴 열기는 정면 단일 가이드, 나머지는 정면·측면 가이드로 보여준다. */}
        <div className="rounded-xl border border-line bg-raised/60 p-4">
          <div className="flex items-center justify-between">
            <MicroLabel>모션 가이드</MicroLabel>
            <span className="font-mono text-[11px] text-dim">{stretch.hold}초 유지</span>
          </div>
          <div className={`mt-3 grid gap-3 ${frontOnlyGuide ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="rounded-lg border border-line bg-surface/60 p-2">
              <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.15em] text-dim">
                <Icon name="camera" size={10} />
                {frontGuideLabel}
              </div>
              <MotionGuide id={stretch.id} view="front" className={frontOnlyGuide ? 'h-40 w-full' : 'h-32 w-full'} />
            </div>
            {!frontOnlyGuide && (
              <div className="rounded-lg border border-line bg-surface/60 p-2">
                <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.15em] text-dim">
                  <Icon name="person" size={10} />
                  {sideGuideLabel}
                </div>
                <MotionGuide id={stretch.id} view="side" className="h-32 w-full" />
              </div>
            )}
          </div>
          <div className="mt-2 border-t border-line pt-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              체크포인트 — 동시에 지켜주세요
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {(MOTION_META[stretch.id]?.checkpoints ?? []).map((c) => (
                <li key={c} className="flex items-start gap-2 text-[12px] leading-snug text-mid">
                  <Icon name="check" size={13} className="mt-0.5 shrink-0 text-good/70" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

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
          className="aspect-[4/3]"
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
  const { stretchLeft, startStretchNow, localDetection } = useApp()
  const { path, navigate } = useRouter()

  // 동작별 URL 매핑 — /stretch/<id> 면 해당 세션, /stretch 면 목록
  const activeId = path.startsWith('/stretch/') ? decodeURIComponent(path.slice('/stretch/'.length)) : null
  const active = activeId ? STRETCHES.find((s) => s.id === activeId) : null

  // 존재하지 않는 동작 id 는 목록으로 교정
  useEffect(() => {
    if (activeId && !active) navigate('/stretch', { replace: true })
  }, [activeId, active, navigate])

  // 온디바이스 판정에서 방금 감지된 issue code로, 없으면 취약 부위 매핑으로 추천.
  // AI 서버 recommend와 같은 방식: 겹치는 문제 개수가 많은 순으로 정렬.
  // 추천은 온디바이스 판정이 실제로 감지한 문제가 있을 때만 — 폴백 없음.
  // 점수 = 매칭된 문제의 심각도 가중치 합 (심각한 순으로 n, n-1, … 1점) → 상위 2개만 추천.
  const issueSet = localDetection.issues?.length ? localDetection.issues : []
  const weightOf = (code) => {
    const i = issueSet.indexOf(code)
    return i === -1 ? 0 : issueSet.length - i
  }
  const scoreOf = (s) => s.targets.reduce((sum, t) => sum + weightOf(t), 0)
  const recommendedIds = STRETCHES.map((s) => ({ id: s.id, score: scoreOf(s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.id)
  const isRecommended = (s) => recommendedIds.includes(s.id)
  const sorted = [...STRETCHES].sort(
    (a, b) => Number(isRecommended(b)) - Number(isRecommended(a)) || scoreOf(b) - scoreOf(a),
  )

  if (active) return <ActiveSession key={active.id} stretch={active} onExit={() => navigate('/stretch')} />

  return (
    <div>
      <ScreenHeader
        title="스트레칭"
        desc={`앉아서 하는 상반신 동작 6종${issueSet.length ? ' · 감지된 문제에 가장 필요한 2가지를 추천했어요' : ' · 자세 문제가 감지되면 맞는 동작을 추천해요'}`}
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
                onClick={() => navigate(`/stretch/${s.id}`)}
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
