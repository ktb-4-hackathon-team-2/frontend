import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { CameraView } from '../components/CameraView'
import { Btn, Card, Icon, MicroLabel, PostureFigure } from '../components/ui'

const STEPS = ['시작', '카메라', '자세 가이드', '바른 자세', '평소 자세', '완료']

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
function SilhouetteOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
      <svg viewBox="0 0 200 200" className="h-[92%] text-good/70">
        <circle cx="100" cy="62" r="30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 7" />
        <path
          d="M38 200 C38 132 68 106 100 106 C132 106 162 132 162 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 7"
        />
      </svg>
      <div className="absolute bottom-3 rounded-full bg-ink/70 px-3 py-1 text-[11px] text-mid backdrop-blur">
        실루엣에 상반신을 맞춰 주세요
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
  const { camera, setCalibrated, setCalibration, setScreen, resetSession } = useApp()
  const [step, setStep] = useState(0)
  const [count, setCount] = useState(null) // 3초 캡처 카운트다운
  const [flash, setFlash] = useState(false)
  const [shots, setShots] = useState({ good: null, usual: null })
  const videoRef = useRef(null)
  const countRef = useRef(null)

  useEffect(() => () => clearInterval(countRef.current), [])

  const snap = (kind) => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = Math.round((320 * video.videoHeight) / video.videoWidth)
    const ctx = canvas.getContext('2d')
    // 미리보기가 거울 모드이므로 캡처도 똑같이 뒤집는다
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setShots((s) => ({ ...s, [kind]: canvas.toDataURL('image/jpeg', 0.75) }))
    setFlash(true)
    setTimeout(() => setFlash(false), 500)
  }

  // StopSlouching 방식: 기준 자세를 3초간 보정
  const startCapture = (kind) => {
    if (camera.status !== 'active' || count !== null) return
    let n = 3
    setCount(n)
    countRef.current = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(countRef.current)
        setCount(null)
        snap(kind)
      } else {
        setCount(n)
      }
    }, 1000)
  }

  const finish = () => {
    setCalibration({ good: shots.good, usual: shots.usual, at: '2026.8.19' })
    setCalibrated(true)
    setScreen('monitor')
    resetSession()
  }

  const skip = () => {
    setCalibrated(true)
    setScreen('monitor')
  }

  const captureStep = (kind, title, desc, checklist, next) => (
    <div key={kind} className="rise grid w-full grid-cols-12 gap-6">
      <div className="relative col-span-7">
        <CameraView
          videoRef={videoRef}
          className="aspect-[4/3]"
          showControls={false}
          overlay={
            <>
              <SilhouetteOverlay />
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
        <h2 className="mt-2 text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-mid">{desc}</p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {checklist.map((c) => (
            <li key={c} className="flex items-start gap-2.5 text-sm text-mid">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-good" />
              {c}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-3 pt-6">
          {shots[kind] ? (
            <div className="flex items-center gap-3">
              <img src={shots[kind]} alt="" className="h-16 w-24 rounded-lg border border-good/40 object-cover" />
              <div className="flex items-center gap-1.5 text-sm text-good">
                <Icon name="check" size={15} />
                캡처 완료
              </div>
              <Btn size="sm" kind="ghost" className="ml-auto" onClick={() => startCapture(kind)}>
                다시 찍기
              </Btn>
            </div>
          ) : (
            <Btn kind="primary" onClick={() => startCapture(kind)} disabled={camera.status !== 'active' || count !== null}>
              <Icon name="camera" size={16} />
              {count !== null ? '캡처 중…' : '3초 캡처 시작'}
            </Btn>
          )}
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => setStep(step - 1)}>
              이전
            </Btn>
            <Btn kind="outline" className="flex-1" disabled={!shots[kind]} onClick={next}>
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
          captureStep(
            'good',
            '바른 자세를 3초간 보여주세요',
            '이 자세가 당신의 기준점이 됩니다. 방금 본 가이드대로, 지금 할 수 있는 가장 바른 자세로 앉아 주세요.',
            ['귀 — 어깨 — 골반이 일직선', '어깨는 뒤로, 힘은 빼고', '화면과 팔 길이만큼 거리'],
            () => setStep(4),
          )}

        {step === 4 &&
          captureStep(
            'usual',
            '이번엔 평소처럼 앉아 보세요',
            '기준 자세와의 차이로 감지 민감도를 잡아요. 잘 보이려고 하지 말고, 평소처럼. 솔직할수록 정확해져요.',
            ['방금 전까지 일하던 그 자세로', '모니터를 보며 자연스럽게', '10초 뒤를 상상하면 쉬워요'],
            () => setStep(5),
          )}

        {step === 5 && (
          <div className="rise flex w-full max-w-2xl flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-good/40 bg-good/10">
              <Icon name="check" size={28} className="text-good" />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">기준 자세가 저장됐어요</h2>
            <p className="mt-2 text-sm text-mid">이제 이 기준으로 하루 종일 조용히 지켜볼게요.</p>

            <Card className="mt-8 w-full p-6">
              <div className="flex items-center justify-center gap-6">
                {['good', 'usual'].map((k) => (
                  <div key={k} className="flex flex-col items-center gap-2">
                    {shots[k] ? (
                      <img src={shots[k]} alt="" className="h-24 w-36 rounded-lg border border-line-strong object-cover" />
                    ) : (
                      <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-line-strong text-[11px] text-dim">
                        건너뜀
                      </div>
                    )}
                    <MicroLabel>{k === 'good' ? '바른 자세' : '평소 자세'}</MicroLabel>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 text-left">
                <div className="text-xs text-mid">
                  <span className="font-mono text-warn1">머리 +5.2cm</span> — 평소 자세에서 머리가 기준보다 앞으로
                </div>
                <div className="text-xs text-mid">
                  <span className="font-mono text-warn1">어깨 높이차 1.1cm</span> — 오른쪽이 살짝 낮아요
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
