import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { useAuth } from '../state/AuthContext'
import { aiApi, aiEnabled, captureFrame } from '../lib/aiApi'
import { CameraView } from '../components/CameraView'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { Btn, Card, Icon, MicroLabel, PostureFigure } from '../components/ui'

const STEPS = ['시작', '카메라', '자세 가이드', '기준 자세', '완료']

const REQUIRED_LANDMARKS = [0, 7, 8, 11, 12]
const MIN_VISIBILITY = 0.55

function copyLandmarks(landmarks) {
  return landmarks.map(({ x, y, z }) => ({ x, y, z }))
}

// 캡처 순간에도 실루엣 안에 있는지 확인한다. 기준 자세는 이미지가 아니라
// 이 좌표만 저장하므로, 이후 모니터링에서 같은 카메라 위치를 유지할 수 있다.
function assessCalibrationPose(landmarks) {
  if (!landmarks) {
    return { aligned: false, message: '실루엣 안에 상반신을 맞춰 주세요' }
  }

  const requiredVisible = REQUIRED_LANDMARKS.every((index) => {
    const point = landmarks[index]
    return point && (point.visibility ?? 1) >= MIN_VISIBILITY
  })

  if (!requiredVisible) {
    return { aligned: false, message: '얼굴과 양쪽 어깨가 모두 보이게 앉아 주세요' }
  }

  const visible = landmarks.filter((point) => (point.visibility ?? 1) >= MIN_VISIBILITY)
  const xs = visible.map((point) => point.x)
  const ys = visible.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const centerX = (minX + maxX) / 2
  const inFrame = minX >= 0.08 && maxX <= 0.92 && minY >= 0.04 && maxY <= 0.98
  const centered = centerX >= 0.3 && centerX <= 0.7

  if (!inFrame || !centered) {
    return { aligned: false, message: '실루엣 중앙에 상반신을 맞춰 주세요' }
  }

  return { aligned: true, message: '좋아요. 이 위치를 유지해 주세요' }
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
      <rect x="463" y="96" width="10" height="90" rx="3" fill="rgba(255,255,255,0.3)" transform="rotate(-4 468 140)" />

      {/* 시선 — 수평 기준선과 15° 이내 */}
      <line x1="216" y1="115" x2="458" y2="115" stroke="rgba(255,255,255,0.16)" strokeWidth="1" strokeDasharray="3 5" />
      <line x1="216" y1="115" x2="458" y2="168" stroke="rgba(62,201,143,0.6)" strokeWidth="1.2" strokeDasharray="5 4" />
      <text x="340" y="132" fontSize="10" fill="#3ec98f" opacity="0.85" fontFamily="IBM Plex Mono, monospace">
        ≤15°
      </text>

      {/* 사람 — 바른 자세 (허리는 등받이에, 상체는 곧게) */}
      <g fill="none" stroke="#3ec98f" strokeWidth="5" strokeLinecap="round">
        <path d="M186 252 C187 220 190 180 194 140" />
        <path d="M196 152 L207 210" />
        <path d="M207 210 L296 206" />
        <path d="M186 252 L258 252" />
        <path d="M258 252 L262 360" />
        <path d="M250 364 L296 364" strokeWidth="4" />
      </g>
      <circle cx="202" cy="117" r="12" fill="#3ec98f" />
      {/* 고관절 각도 표시 */}
      <path d="M206 252 A20 20 0 0 0 189 235" fill="none" stroke="rgba(62,201,143,0.5)" strokeWidth="1.5" />

      {GUIDE_POINTS.map((p) => (
        <GuideMarker key={p.n} n={p.n} x={p.x} y={p.y} />
      ))}
    </svg>
  )
}

// 캡처 가이드용 상반신 실루엣 오버레이
function SilhouetteOverlay({ poseState }) {
  const tone = poseState?.aligned ? 'text-good' : 'text-warn1'
  const message = poseState?.message || '실루엣에 상반신을 맞춰 주세요'

  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
      <svg viewBox="0 0 200 200" className={`h-[92%] opacity-70 ${tone}`}>
        <circle cx="100" cy="62" r="30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 7" />
        <path
          d="M38 200 C38 132 68 106 100 106 C132 106 162 132 162 200"
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

// 온보딩 인트로의 살아있는 실루엣 — 상태를 순환하며 서비스를 한 컷으로 설명
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
  const { camera, setCalibrated, setCalibration, setScreen, resetSession, saveAiBaselineId } = useApp()
  const { member } = useAuth()
  const [step, setStep] = useState(0)
  const [count, setCount] = useState(null) // 3초 캡처 카운트다운
  const [flash, setFlash] = useState(false)
  const [referencePose, setReferencePose] = useState(null)
  const [poseState, setPoseState] = useState(null)
  // AI 서버 캘리브레이션 상태: idle | sending | ok | fail
  const [aiCal, setAiCal] = useState({ status: 'idle', message: null })
  const videoRef = useRef(null)
  const countRef = useRef(null)
  const pose = usePoseLandmarker(camera.status === 'active')

  useEffect(() => () => clearInterval(countRef.current), [])

  // 기준 자세 캡처 화면에서만 현재 스켈레톤을 확인한다.
  useEffect(() => {
    if (step !== 3 || camera.status !== 'active' || pose.status !== 'ready') {
      setPoseState(null)
      return
    }

    const id = setInterval(() => {
      const result = pose.detect(videoRef.current)
      const landmarks = result?.landmarks?.[0] ?? null
      setPoseState({ ...assessCalibrationPose(landmarks), detected: Boolean(landmarks) })
    }, 150)

    return () => clearInterval(id)
  }, [camera.status, pose.detect, pose.status, step])

  const snap = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const result = pose.detect(video)
    const landmarks = result?.landmarks?.[0] ?? null
    const nextPoseState = assessCalibrationPose(landmarks)
    if (!nextPoseState.aligned) {
      setPoseState({ ...nextPoseState, detected: Boolean(landmarks) })
      return
    }

    // 영상/이미지는 저장하지 않고, 캡처 시점의 스켈레톤 좌표만 보관한다.
    setReferencePose(copyLandmarks(landmarks))
    setFlash(true)
    setTimeout(() => setFlash(false), 500)

    // AI 서버 모드면 같은 프레임으로 서버 캘리브레이션 → baseline_id 발급.
    // 서버도 스켈레톤만 저장하고 이미지는 저장하지 않는다 (스펙 명시).
    if (aiEnabled) {
      setAiCal({ status: 'sending', message: null })
      aiApi
        .calibrate({ image: captureFrame(video, 640, 0.75), userId: member?.id })
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

  // 기준 자세를 3초간 유지한 뒤 마지막 프레임의 스켈레톤 좌표를 저장한다.
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
    setCalibration({ landmarks: referencePose, at: '2026.8.19' })
    setCalibrated(true)
    setScreen('monitor')
    resetSession()
  }

  const skip = () => {
    setCalibrated(true)
    setScreen('monitor')
  }

  const captureStep = () => (
    <div className="rise grid w-full grid-cols-12 gap-6">
      <div className="relative col-span-7">
        <CameraView
          videoRef={videoRef}
          className="aspect-[4/3]"
          showControls={false}
          overlay={
            <>
              <SilhouetteOverlay poseState={poseState} />
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
        <MicroLabel>Calibration</MicroLabel>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">실제 사용할 자세를 보여주세요</h2>
        <p className="mt-2 text-sm leading-relaxed text-mid">
          앞으로 모니터링할 때 유지할 자세로 앉아 주세요. 실루엣 안에 위치를 맞추면 한 번 캡처하고 스켈레톤 좌표만 기준으로 저장해요.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {['귀 — 어깨 — 골반이 일직선', '어깨는 뒤로, 힘은 빼고', '화면과 팔 길이만큼 거리'].map((c) => (
            <li key={c} className="flex items-start gap-2.5 text-sm text-mid">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-good" />
              {c}
            </li>
          ))}
        </ul>
        <Card className="mt-5 border-good/20 bg-good/[0.05] p-3.5 text-xs leading-relaxed text-mid">
          <div className="flex items-center gap-2 text-good">
            <Icon name="activity" size={14} />
            <span className="font-medium">{pose.status === 'loading' ? '자세 모델 로딩 중…' : pose.status === 'error' ? '자세 모델을 불러오지 못했어요' : poseState?.detected ? '스켈레톤 인식 중' : '카메라 안에 상반신을 보여 주세요'}</span>
          </div>
          <p className="mt-1.5">사진이나 영상은 저장하지 않고, 인식된 관절 좌표만 기준 자세로 사용합니다.</p>
        </Card>
        <div className="mt-auto flex flex-col gap-3 pt-6">
          {referencePose ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-good/40 bg-good/10">
                  <PostureFigure state="good" className="h-10 w-10 text-good" />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-good">
                  <Icon name="check" size={15} />
                  좌표 저장 완료
                </div>
                <Btn size="sm" kind="ghost" className="ml-auto" onClick={startCapture}>
                  다시 찍기
                </Btn>
              </div>
              {aiEnabled && aiCal.status !== 'idle' && (
                <p
                  className={`text-[11px] ${
                    aiCal.status === 'fail' ? 'text-warn2' : aiCal.status === 'ok' ? 'text-good' : 'text-dim'
                  }`}
                >
                  {aiCal.status === 'sending'
                    ? 'AI 서버 캘리브레이션 중…'
                    : aiCal.status === 'ok'
                      ? 'AI 서버 기준 자세 등록 완료'
                      : aiCal.message}
                </p>
              )}
            </div>
          ) : (
            <Btn kind="primary" onClick={startCapture} disabled={camera.status !== 'active' || pose.status !== 'ready' || !poseState?.aligned || count !== null}>
              <Icon name="camera" size={16} />
              {count !== null ? '캡처 중…' : '기준 자세 캡처'}
            </Btn>
          )}
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => setStep(step - 1)}>
              이전
            </Btn>
            <Btn kind="outline" className="flex-1" disabled={!referencePose} onClick={() => setStep(4)}>
              다음
              <Icon name="chevronRight" size={15} />
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
                  <Icon name="person" size={15} className="text-good" /> 취약 부위 맞춤 스트레칭
                </li>
              </ul>
              <div className="mt-8 flex gap-3">
                <Btn kind="primary" size="lg" onClick={() => setStep(1)}>
                  시작하기
                  <Icon name="arrowRight" size={16} />
                </Btn>
                <Btn kind="ghost" size="lg" onClick={skip}>
                  데모용 건너뛰기
                </Btn>
              </div>
            </div>
            <FigureCycle />
          </div>
        )}

        {step === 1 && (
          <div className="rise grid w-full max-w-4xl grid-cols-12 gap-6">
            <div className="col-span-7">
              <CameraView videoRef={videoRef} className="aspect-[4/3]" />
            </div>
            <div className="col-span-5 flex flex-col">
              <MicroLabel>Camera Setup</MicroLabel>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">카메라를 연결해 주세요</h2>
              <p className="mt-2 text-sm leading-relaxed text-mid">
                상반신이 프레임에 들어오면 충분해요. 노트북 내장 캠도, 외장 웹캠도 좋아요.
              </p>
              <Card className="mt-5 flex items-start gap-2.5 border-good/20 bg-good/[0.05] p-3.5 text-xs leading-relaxed text-mid">
                <Icon name="check" size={14} className="mt-0.5 shrink-0 text-good" />
                모든 영상 처리는 이 기기 안에서 끝나요. 서버 전송도, 저장도 없어요.
              </Card>
              <div className="mt-auto flex gap-2 pt-6">
                <Btn kind="ghost" onClick={() => setStep(0)}>
                  이전
                </Btn>
                <Btn kind="primary" className="flex-1" disabled={camera.status !== 'active'} onClick={() => setStep(2)}>
                  {camera.status === 'active' ? '다음' : '카메라를 켜 주세요'}
                  <Icon name="chevronRight" size={15} />
                </Btn>
              </div>
            </div>
          </div>
        )}

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

        {step === 3 &&
          captureStep()}

        {step === 4 && (
          <div className="rise flex w-full max-w-2xl flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-good/40 bg-good/10">
              <Icon name="check" size={28} className="text-good" />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">기준 자세가 저장됐어요</h2>
            <p className="mt-2 text-sm text-mid">이제 이 기준으로 하루 종일 조용히 지켜볼게요.</p>

            <Card className="mt-8 w-full p-6">
              <div className="flex items-center justify-center gap-4">
                <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-good/40 bg-good/10">
                  <PostureFigure state="good" className="h-16 w-16 text-good" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5 text-sm text-good">
                    <Icon name="check" size={15} />
                    기준 스켈레톤 저장 완료
                  </div>
                  <p className="mt-1 text-xs text-mid">관절 {referencePose?.length ?? 0}개 좌표를 저장했어요.</p>
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
