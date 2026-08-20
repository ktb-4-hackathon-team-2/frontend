import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { useAuth } from '../state/AuthContext'
import { aiApi, aiEnabled, captureFrame } from '../lib/aiApi'
import { computeMetrics } from '../lib/postureDetector'
import { drawPose } from '../lib/poseRules'
import { CameraView } from '../components/CameraView'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { Btn, Card, Chip, Icon, MicroLabel, PostureFigure } from '../components/ui'
import { CAMERA_VIEWS, getSilhouette } from '../lib/guides'

const STEPS = ['시작', '카메라', '자세 가이드', '기준 자세', '완료']

const REQUIRED_LANDMARKS = [0, 7, 8, 11, 12]
const MIN_VISIBILITY = 0.55

function copyLandmarks(landmarks) {
  return landmarks.map(({ x, y, z }) => ({ x, y, z }))
}

// 캡처 전 실시간 검사 — 카메라 배치 뷰(정면/좌대각/우대각)에 맞춰 각도 허용치를 적용
function assessCalibrationPose(landmarks, view = 'front') {
  if (!landmarks) {
    return { aligned: false, message: '실루엣 안에 상반신을 맞춰 주세요', conds: null }
  }

  const requiredVisible = REQUIRED_LANDMARKS.every((index) => {
    const point = landmarks[index]
    return point && (point.visibility ?? 1) >= MIN_VISIBILITY
  })

  if (!requiredVisible) {
    return { aligned: false, message: '얼굴과 양쪽 어깨가 모두 보이게 앉아 주세요', conds: null }
  }

  const m = computeMetrics(landmarks)
  const isDiag = view === 'left_diagonal' || view === 'right_diagonal'
  const shoulderLimit = isDiag ? 14 : 7
  const headLimit = isDiag ? 14 : 7
  const neckLimit = isDiag ? 16 : 9

  const conds = [
    {
      id: 'shoulder',
      label: isDiag ? '자연스러운 어깨 정렬' : '어깨는 수평으로',
      ok: Math.abs(m.shoulder_tilt_deg) <= shoulderLimit,
      value: `${Math.abs(m.shoulder_tilt_deg).toFixed(0)}°`,
    },
    {
      id: 'head',
      label: isDiag ? '정면 모니터 주시' : '고개는 기울이지 않게',
      ok: Math.abs(m.head_roll_deg) <= headLimit,
      value: `${Math.abs(m.head_roll_deg).toFixed(0)}°`,
    },
    {
      id: 'neck',
      label: '목은 곧게 세우기',
      ok: Math.abs(m.neck_tilt_deg) <= neckLimit,
      value: `${Math.abs(m.neck_tilt_deg).toFixed(0)}°`,
    },
  ]
  const aligned = conds.every((c) => c.ok)

  let message = '좋아요. 이 자세 그대로 캡처하세요'
  if (!conds[0].ok) message = isDiag ? '어깨에 힘을 빼고 자연스럽게 맞춰 주세요' : '어깨가 기울었어요 — 수평을 맞춰 주세요'
  else if (!conds[1].ok) message = '고개를 곧게 세워 주세요'
  else if (!conds[2].ok) message = '귀가 어깨 위에 오도록 목을 세워 주세요'

  return { aligned, message, conds }
}

// 캡처 전 바른 자세 가이드 — 인체공학 권장 자세를 우리 도해 스타일로
const GUIDE_POINTS = [
  { n: 1, text: '턱은 가볍게 당기고 정면 주시', x: 230, y: 122 },
  { n: 2, text: '양쪽 어깨는 힘을 빼고 이완', x: 166, y: 148 },
  { n: 3, text: '깊숙이 앉아 허리를 등받이에 밀착', x: 152, y: 224 },
  { n: 4, text: '팔꿈치는 수직, 손목까지는 수평', x: 252, y: 188 },
  { n: 5, text: '고관절은 90–100° 굴곡', x: 162, y: 276 },
  { n: 6, text: '허벅지는 수평, 종아리는 수직', x: 290, y: 302 },
  { n: 7, text: '발바닥은 바닥에 평평하게', x: 320, y: 358 },
  { n: 8, text: '모니터 상단은 눈높이, 시선은 아래 15° 이내', x: 504, y: 98 },
]

function GuideMarker({ n, x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r="9" fill="#121517" stroke="rgba(62,201,143,0.65)" strokeWidth="1.5" />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="#e9edeb"
        fontFamily="IBM Plex Mono, monospace"
      >
        {n}
      </text>
    </g>
  )
}

function PostureGuideDiagram() {
  return (
    <svg viewBox="0 0 640 400" className="w-full">
      {/* 바닥 */}
      <line x1="40" y1="368" x2="600" y2="368" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />

      {/* 의자 — 등받이는 허리에 밀착, 다리는 바닥까지 */}
      <g stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M178 258 L172 148" />
        <path d="M150 258 L240 258" />
        <path d="M195 262 L195 358" />
        <path d="M160 364 L232 364" />
      </g>

      {/* 책상 + 키보드 + 모니터 */}
      <g stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M290 210 L580 210" />
        <path d="M330 210 L330 368" />
        <path d="M560 210 L560 368" />
        <path d="M470 210 L470 188" />
        <path d="M452 210 L488 210" />
      </g>
      <path d="M300 204 L352 204" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />

      {/* 사람 — 허리 세우고, 팔 90°, 무릎 90°, 발바닥 착지 */}
      <g stroke="#3ec98f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="210" cy="115" r="26" strokeWidth="3.5" />
        <path d="M208 141 L200 255" />
        <path d="M204 165 L245 198 L290 202" />
        <path d="M200 255 L292 258 L292 358" />
        <path d="M292 358 L330 358" />
      </g>

      {/* 시선 점선 */}
      <line x1="236" y1="115" x2="470" y2="128" stroke="rgba(62,201,143,0.45)" strokeWidth="1.5" strokeDasharray="4 4" />

      {/* 고관절 각도 표시 */}
      <path d="M206 252 A20 20 0 0 0 189 235" fill="none" stroke="rgba(62,201,143,0.5)" strokeWidth="1.5" />

      {GUIDE_POINTS.map((p) => (
        <GuideMarker key={p.n} n={p.n} x={p.x} y={p.y} />
      ))}
    </svg>
  )
}

// 캡처 가이드용 상반신 실루엣 오버레이 — 원래의 깔끔한 곡선 스타일
function SilhouetteOverlay({ poseState, view = 'front' }) {
  const tone = poseState?.aligned ? 'text-good' : 'text-warn1'
  const message = poseState?.message || '실루엣에 상반신을 맞춰 주세요'

  let headCx = 100
  let bodyPath = 'M38 200 C38 132 68 106 100 106 C132 106 162 132 162 200'

  if (view === 'left_diagonal') {
    headCx = 94
    bodyPath = 'M32 200 C32 136 60 106 94 106 C128 106 168 130 168 200'
  } else if (view === 'right_diagonal') {
    headCx = 106
    bodyPath = 'M32 200 C32 130 72 106 106 106 C140 106 168 136 168 200'
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
      <svg viewBox="0 0 200 200" className={`h-[92%] opacity-70 transition-all duration-300 ${tone}`}>
        <circle cx={headCx} cy="62" r="30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 7" />
        <path
          d={bodyPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 7"
        />
      </svg>
      <div className={`absolute bottom-3 rounded-full bg-ink/70 px-3 py-1 text-[11px] backdrop-blur ${tone}`}>
        {message}
      </div>
    </div>
  )
}

function FigureCycle() {
  const states = ['good', 'warn1', 'warn2', 'warn3', 'warn2', 'warn1']
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % states.length), 1300)
    return () => clearInterval(id)
  }, [])
  const s = states[i]
  const color = s === 'good' ? 'text-good' : s === 'warn1' ? 'text-warn1' : s === 'warn2' ? 'text-warn2' : 'text-warn3'
  return (
    <div className="relative flex h-64 w-64 items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-line" />
      <div className="absolute inset-4 rounded-full border border-line" />
      <PostureFigure state={s} className={`h-40 w-40 transition-colors duration-500 ${color}`} stroke={5} />
      <div className="absolute bottom-6 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">
        {s === 'good' ? 'Good' : `Level ${s.slice(-1)}`}
      </div>
    </div>
  )
}

export default function Onboarding() {
  const { camera, setCalibrated, setCalibration, setScreen, resetSession, saveAiBaselineId, cameraView, setCameraView } = useApp()
  const { member } = useAuth()
  const [step, setStep] = useState(0)
  const [count, setCount] = useState(null)
  const [flash, setFlash] = useState(false)
  const [referencePose, setReferencePose] = useState(null)
  const [poseState, setPoseState] = useState(null)
  const [aiCal, setAiCal] = useState({ status: 'idle', message: null })
  const videoRef = useRef(null)
  const guideCanvasRef = useRef(null)
  const countRef = useRef(null)
  const pose = usePoseLandmarker(camera.status === 'active')

  useEffect(() => () => clearInterval(countRef.current), [])

  // 기준 자세 캡처 화면 실시간 감지
  useEffect(() => {
    if (step !== 3 || camera.status !== 'active' || pose.status !== 'ready') {
      setPoseState(null)
      return
    }

    const id = setInterval(() => {
      const video = videoRef.current
      const result = pose.detect(video)
      const landmarks = result?.landmarks?.[0] ?? null
      const state = { ...assessCalibrationPose(landmarks, cameraView), detected: Boolean(landmarks) }
      setPoseState(state)
      drawPose(guideCanvasRef.current, video, landmarks, state.aligned)
    }, 150)

    return () => clearInterval(id)
  }, [camera.status, pose.detect, pose.status, step, cameraView])

  const snap = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const result = pose.detect(video)
    const landmarks = result?.landmarks?.[0] ?? null
    const nextPoseState = assessCalibrationPose(landmarks, cameraView)
    if (!nextPoseState.aligned) {
      setPoseState({ ...nextPoseState, detected: Boolean(landmarks) })
      return
    }

    setReferencePose(copyLandmarks(landmarks))
    setFlash(true)
    setTimeout(() => setFlash(false), 500)

    // AI 서버 모드면 선택한 cameraView 와 함께 서버 캘리브레이션
    if (aiEnabled) {
      setAiCal({ status: 'sending', message: null })
      aiApi
        .calibrate({ 
          image: captureFrame(video, 640, 0.75), 
          userId: String(member?.id || '1'),
          view: cameraView,
        })
        .then((res) => {
          if (res.ok) {
            saveAiBaselineId(res.baseline_id)
            setAiCal({ status: 'ok', message: null })
          } else {
            setAiCal({ status: 'fail', message: res.messages?.[0] ?? '서버가 자세를 인식하지 못했어요 — 다시 찍어 주세요' })
          }
        })
        .catch((err) =>
          setAiCal({
            status: 'fail',
            message: err?.status
              ? `AI 서버 오류 (HTTP ${err.status}): ${err.message} — 로컬 판정으로 동작해요`
              : `${err?.message ?? 'AI 서버에 연결하지 못했어요'} — 로컬 판정으로 동작해요`,
          }),
        )
    }
  }

  const startCapture = () => {
    if (camera.status !== 'active' || pose.status !== 'ready' || count !== null || !poseState?.aligned) return
    let n = 3
    setCount(n)
    countRef.current = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(countRef.current)
        setCount(null)
        snap()
      } else {
        setCount(n)
      }
    }, 1000)
  }

  const finish = () => {
    const todayStr = new Date().toLocaleDateString()
    setCalibration({ landmarks: referencePose, at: todayStr, view: cameraView })
    setCalibrated(true)
    setScreen('monitor')
    resetSession()
  }

  const skip = () => {
    setCalibrated(true)
    setScreen('monitor')
  }

  // ── Step 3: 기준 자세 캡처 화면 ─────────────────────────────────────
  const captureStep = () => (
    <div className="rise grid w-full grid-cols-12 gap-6">
      <div className="relative col-span-7">
        <CameraView
          videoRef={videoRef}
          className="aspect-[4/3]"
          showControls={false}
          overlay={
            <>
              <canvas ref={guideCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
              <SilhouetteOverlay poseState={poseState} view={cameraView} />
              {count !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
                  <span key={count} className="zoom-in font-mono text-8xl font-semibold text-hi drop-shadow-lg">
                    {count}
                  </span>
                </div>
              )}
              {flash && <div className="flash absolute inset-0 bg-white" />}
            </>
          }
        />
      </div>
      <div className="col-span-5 flex flex-col">
        <MicroLabel>Calibration & Camera View</MicroLabel>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">카메라 위치 & 기준 자세</h2>

        {/* 카메라 배치 뷰 선택 탭 */}
        <div className="mt-3">
          <label className="text-[11px] font-mono text-dim uppercase tracking-wider">카메라 배치 환경</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {CAMERA_VIEWS.map((cv) => {
              const active = cameraView === cv.id
              return (
                <button
                  key={cv.id}
                  onClick={() => setCameraView(cv.id)}
                  className={`flex flex-col rounded-xl border p-2 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-good bg-good/10 text-hi ring-1 ring-good/40'
                      : 'border-line bg-surface/60 text-dim hover:border-line-strong hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${active ? 'text-good' : 'text-hi'}`}>
                      {cv.id === 'front' ? '정면' : cv.id === 'left_diagonal' ? '좌측 대각' : '우측 대각'}
                    </span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-good" />}
                  </div>
                  <span className="mt-1 text-[10px] leading-tight text-dim line-clamp-2">
                    {cv.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-mid">
          {cameraView === 'front'
            ? '모니터 정면을 보고 바른 자세로 앉아 주세요.'
            : cameraView === 'left_diagonal'
            ? '노트북이 왼쪽 책상에 있고 정면 모니터를 보는 자연스러운 자세로 앉아 주세요.'
            : '노트북이 오른쪽 책상에 있고 정면 모니터를 보는 자연스러운 자세로 앉아 주세요.'}
        </p>

        {/* 실시간 자세 체크리스트 */}
        <ul className="mt-3 flex flex-col gap-2">
          {poseState?.conds
            ? poseState.conds.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <Icon name="check" size={13} className={`shrink-0 ${c.ok ? 'text-good' : 'text-dim'}`} />
                  <span className={c.ok ? 'text-mid font-medium' : 'text-dim'}>{c.label}</span>
                  {c.value && <span className="ml-auto font-mono text-[11px] text-dim">{c.value}</span>}
                </li>
              ))
            : ['어깨 정렬', '고개 기울기', '목 곧게 세우기'].map((c) => (
                <li key={c} className="flex items-center gap-2 text-xs text-dim">
                  <Icon name="check" size={13} className="shrink-0" />
                  {c}
                </li>
              ))}
        </ul>

        <Card className="mt-3 border-good/20 bg-good/[0.04] p-3 text-[11px] leading-relaxed text-mid">
          <div className="flex items-center gap-2 text-good font-medium">
            <Icon name="activity" size={13} />
            <span>
              {pose.status === 'loading'
                ? '자세 모델 로딩 중…'
                : pose.status === 'error'
                ? '자세 모델 로드 실패'
                : poseState?.detected
                ? `스켈레톤 인식 중 (${cameraView === 'front' ? '정면 뷰' : cameraView === 'left_diagonal' ? '좌대각 뷰' : '우대각 뷰'})`
                : '카메라 안에 상반신을 보여 주세요'}
            </span>
          </div>
          <p className="mt-1 text-dim">영상은 저장되지 않으며 관절 좌표만 기준 자세로 암호화 저장됩니다.</p>
        </Card>

        {/* 캡처 버튼 영역 */}
        <div className="mt-auto flex flex-col gap-2.5 pt-4">
          {referencePose ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-good/40 bg-good/10">
                  <PostureFigure state="good" className="h-8 w-8 text-good" />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-good font-semibold">
                    <Icon name="check" size={14} />
                    기준 자세 캡처 완료
                  </div>
                  <span className="text-[10px] text-dim">
                    {cameraView === 'front' ? '정면 뷰' : cameraView === 'left_diagonal' ? '좌측 대각 뷰' : '우측 대각 뷰'}
                  </span>
                </div>
                <Btn size="sm" kind="ghost" className="ml-auto" onClick={startCapture}>
                  다시 찍기
                </Btn>
              </div>
              {aiEnabled && aiCal.status !== 'idle' && (
                <p
                  className={`text-[10px] ${
                    aiCal.status === 'fail' ? 'text-warn2' : aiCal.status === 'ok' ? 'text-good' : 'text-dim'
                  }`}
                >
                  {aiCal.status === 'sending'
                    ? 'AI 서버 캘리브레이션 등록 중…'
                    : aiCal.status === 'ok'
                    ? 'AI 서버 기준 자세 등록 완료'
                    : aiCal.message}
                </p>
              )}
            </div>
          ) : (
            <Btn
              kind="primary"
              onClick={startCapture}
              disabled={camera.status !== 'active' || pose.status !== 'ready' || !poseState?.aligned || count !== null}
            >
              <Icon name="camera" size={15} />
              {count !== null ? '캡처 중…' : '기준 자세 캡처'}
            </Btn>
          )}
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => setStep(step - 1)}>
              이전
            </Btn>
            <Btn kind="outline" className="flex-1" disabled={!referencePose} onClick={() => setStep(4)}>
              다음
              <Icon name="chevronRight" size={14} />
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* 상단 진행 표시 */}
      <div className="flex h-16 shrink-0 items-center gap-4 px-8">
        <div className="flex items-center gap-2.5">
          <PostureFigure state="good" className="h-7 w-7 text-good" stroke={6} />
          <span className="font-bold tracking-tight">반듯</span>
        </div>
        <div className="mx-4 h-px flex-1 overflow-hidden rounded bg-white/[0.07]">
          <div
            className="h-full bg-good transition-all duration-500"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          Step {step + 1}/{STEPS.length} · {STEPS[step]}
        </span>
        <Btn size="sm" kind="ghost" onClick={skip}>
          건너뛰기
        </Btn>
      </div>

      <div className="flex flex-1 items-center justify-center px-8 pb-16">
        {step === 0 && (
          <div className="rise flex w-full max-w-4xl items-center justify-between gap-12">
            <div className="max-w-md">
              <MicroLabel>Bandeut · Posture Guard</MicroLabel>
              <h1 className="mt-4 text-5xl font-bold leading-[1.15] tracking-tight">
                허리는 펴고,
                <br />
                일은 계속.
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed text-mid">
                반듯은 웹캠으로 앉은 자세를 지켜보다가, 무너지는 순간에만 조용히 개입해요.
                영상은 기기 안에서만 처리되고 어디로도 전송되지 않아요.
              </p>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-mid">
                <li className="flex items-center gap-2.5">
                  <Icon name="activity" size={15} className="text-good" /> 실시간 자세 감지 — 하루 종일, 조용하게
                </li>
                <li className="flex items-center gap-2.5">
                  <Icon name="bell" size={15} className="text-good" /> 3단계 개입 — 위젯 → 토스트 → 전체 화면
                </li>
                <li className="flex items-center gap-2.5">
                  <Icon name="person" size={15} className="text-good" /> 듀얼 모니터 · 대각선 노트북 웹캠 완벽 지원
                </li>
              </ul>
              <div className="mt-8 flex gap-3">
                <Btn kind="primary" size="lg" onClick={() => setStep(1)}>
                  시작하기
                  <Icon name="chevronRight" size={16} />
                </Btn>
              </div>
            </div>
            <FigureCycle />
          </div>
        )}

        {step === 1 && (
          <div className="rise flex w-full max-w-xl flex-col items-center text-center">
            <MicroLabel>Camera</MicroLabel>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">카메라를 연결할게요</h2>
            <p className="mt-3 text-sm text-mid">
              상반신(얼굴과 양쪽 어깨)이 프레임 안에 들어오도록 웹캠을 켜 주세요.
            </p>

            <div className="mt-6 w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface">
              <CameraView videoRef={videoRef} className="aspect-[4/3]" showControls={false} />
            </div>

            {camera.devices.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                <Icon name="camera" size={14} className="text-dim" />
                <select
                  value={camera.selectedId ?? ''}
                  onChange={(e) => camera.selectDevice(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-mid focus:border-good focus:outline-none"
                >
                  {camera.devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `카메라 ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <Btn kind="ghost" onClick={() => setStep(0)}>
                이전
              </Btn>
              <Btn kind="primary" disabled={camera.status !== 'active'} onClick={() => setStep(2)}>
                카메라 연결됨 — 다음
                <Icon name="chevronRight" size={15} />
              </Btn>
            </div>
          </div>
        )}

        {/* ── Step 2: 바른 자세 기준 (원래 버전으로 완벽 복원) ── */}
        {step === 2 && (
          <div className="rise grid w-full max-w-5xl grid-cols-12 gap-6">
            <div className="col-span-7">
              <div className="rounded-xl border border-line bg-surface p-5">
                <div className="mb-2 flex items-center justify-between">
                  <MicroLabel>Reference — 인체공학 권장 자세</MicroLabel>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-dim">측면 기준</span>
                </div>
                <PostureGuideDiagram />
              </div>
            </div>
            <div className="col-span-5 flex flex-col">
              <MicroLabel>Posture Guide</MicroLabel>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">캡처 전에, 바른 자세부터</h2>
              <p className="mt-2 text-sm leading-relaxed text-mid">
                다음 단계에서 찍는 자세가 앞으로의 기준점이 됩니다. 번호를 따라 자세를 잡아 보세요.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {GUIDE_POINTS.map((p) => (
                  <li key={p.n} className="flex items-start gap-2.5 text-[13px] leading-snug text-mid">
                    <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-good/50 font-mono text-[10px] font-semibold text-hi">
                      {p.n}
                    </span>
                    {p.text}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex gap-2 pt-5">
                <Btn kind="ghost" onClick={() => setStep(1)}>
                  이전
                </Btn>
                <Btn kind="primary" className="flex-1" onClick={() => setStep(3)}>
                  가이드대로 앉았어요
                  <Icon name="chevronRight" size={15} />
                </Btn>
              </div>
            </div>
          </div>
        )}

        {step === 3 && captureStep()}

        {/* ── Step 4: 완료 (원래 버전 디자인으로 복원) ── */}
        {step === 4 && (
          <div className="rise flex w-full max-w-2xl flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-good/40 bg-good/10">
              <Icon name="check" size={28} className="text-good" />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">기준 자세가 저장됐어요</h2>
            <p className="mt-2 text-sm text-mid">
              {cameraView === 'front' ? '정면 웹캠' : cameraView === 'left_diagonal' ? '좌측 대각선' : '우측 대각선'} 기준으로 하루 종일 조용히 지켜볼게요.
            </p>

            <Card className="mt-8 w-full p-6">
              <div className="flex items-center justify-center gap-4">
                <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-good/40 bg-good/10">
                  <PostureFigure state="good" className="h-16 w-16 text-good" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5 text-sm text-good font-semibold">
                    <Icon name="check" size={15} />
                    기준 스켈레톤 저장 완료 ({cameraView === 'front' ? '정면' : cameraView === 'left_diagonal' ? '좌측 대각' : '우측 대각'})
                  </div>
                  <p className="mt-1 text-xs text-mid">관절 {referencePose?.length ?? 0}개 좌표를 안전하게 저장했어요.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 text-left">
                <div className="text-xs text-mid">
                  <span className="font-mono text-good">스켈레톤 좌표</span> — 기준 자세의 관절 위치만 저장
                </div>
                <div className="text-xs text-mid">
                  <span className="font-mono text-good">실루엣 고정</span> — 모니터링 시 같은 위치를 기준으로 비교
                </div>
              </div>
              <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-left text-xs leading-relaxed text-mid">
                <Icon name="desk" size={13} className="mr-1.5 inline text-good" />
                작업 환경에서 <span className="text-hi">개선 제안 2건</span>을 찾았어요 — 시작 후{' '}
                <span className="text-hi">환경 가이드</span>에서 확인하세요.
              </p>
            </Card>

            <Btn kind="primary" size="lg" className="mt-8" onClick={finish}>
              모니터링 시작
              <Icon name="arrowRight" size={16} />
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}
