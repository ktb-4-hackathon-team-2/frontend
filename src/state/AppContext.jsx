import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from './RouterContext'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { POSTURE_META } from '../data/dummy'
import { maybeChime } from '../lib/sound'
import { assessPosture } from '../lib/postureDetector'
import { aiApi, aiEnabled, captureFrame, AI_FRAME_INTERVAL_MS } from '../lib/aiApi'

// 화면 ↔ URL 매핑 — screen 상태의 원천은 URL이다
export const SCREEN_PATHS = {
  monitor: '/monitor',
  report: '/report',
  stretch: '/stretch',
  environment: '/environment',
  alerts: '/alerts',
  settings: '/settings',
}
const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREEN_PATHS).map(([s, p]) => [p, s]))

// rAF가 아니라 setInterval: 탭이 비활성화돼도 감지 루프는 계속 돌아야 한다.
export const DETECT_INTERVAL_MS = 500

export const WARN_LEVEL = { good: 0, warn1: 1, warn2: 2, warn3: 3 }

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const { path, navigate } = useRouter()

  // screen/widgetMode 는 URL에서 파생 — setScreen/setWidgetMode 는 내비게이션이다
  const screenFromPath = PATH_TO_SCREEN[path]
  const lastScreenRef = useRef('monitor')
  useEffect(() => {
    if (screenFromPath) lastScreenRef.current = screenFromPath
  }, [screenFromPath])
  const screen = screenFromPath ?? lastScreenRef.current
  const setScreen = useCallback((id) => navigate(SCREEN_PATHS[id] ?? '/monitor'), [navigate])
  const widgetMode = path === '/widget'
  const setWidgetMode = useCallback(
    (on) => {
      if (on) navigate('/widget')
      else navigate(SCREEN_PATHS[lastScreenRef.current] ?? '/monitor')
    },
    [navigate],
  )

  const [calibrated, setCalibrated] = useState(false)
  const [calibration, setCalibration] = useState(null) // { landmarks, at }
  const [posture, setPosture] = useState('good')
  const [paused, setPaused] = useState(false)
  const [demoAlert, setDemoAlert] = useState(0) // 알림 데모용 강제 단계 (0 = 없음)
  const [settings, setSettings] = useState({
    maxAlertLevel: 2, // 3단계는 옵트인
    soundOn: true,
    sound: 'chime', // chime | wood | none
    quietOn: false,
    quietFrom: '22:00',
    quietTo: '08:00',
    stretchMin: 50,
  })
  const [alertCount, setAlertCount] = useState(4)
  const [elapsedSec, setElapsedSec] = useState(4 * 3600 + 32 * 60) // 오늘 누적 (더미로 시작)
  const [stretchLeft, setStretchLeft] = useState(50 * 60)
  const [stretchSuggest, setStretchSuggest] = useState(false)
  const [tick, setTick] = useState(0)
  const [localDetection, setLocalDetection] = useState({ status: 'idle', score: null, rawLevel: 0, reason: null })
  const camera = useCamera()
  const detectionVideoRef = useRef(null)
  // AI 모드에서는 로컬 판정 모델이 필요 없다
  const pose = usePoseLandmarker(!aiEnabled && calibrated && screen === 'monitor' && camera.status === 'active')
  const demoTimer = useRef(null)
  const postureSince = useRef(Date.now())
  const badPostureRef = useRef({ rawLevel: 0, since: 0 })

  // AI 서버 판정용 — baseline은 재접속에도 유지, 세션은 탭 단위
  const [aiBaselineId, setAiBaselineId] = useState(() => localStorage.getItem('bandeut.baselineId') || '')
  const aiSessionId = useRef(`tab-${Math.random().toString(36).slice(2, 10)}`)
  const saveAiBaselineId = useCallback((id) => {
    setAiBaselineId(id)
    try {
      localStorage.setItem('bandeut.baselineId', id)
    } catch {
      // 저장 실패는 치명적이지 않음 — 세션 동안은 state 로 유지
    }
  }, [])

  // 1초 심장박동 — 모니터링 시간 + 스트레칭 카운트다운
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1)
      setStretchLeft((s) => {
        if (s <= 1) {
          setStretchSuggest(true)
          return settings.stretchMin * 60
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [paused, settings.stretchMin])

  // AI 서버 감지 루프 — VITE_AI_API_BASE 설정 시. 프레임을 1.5초 간격으로 보내고 판정을 받는다.
  useEffect(() => {
    if (!aiEnabled) return
    const enabled = calibrated && screen === 'monitor' && camera.status === 'active' && !paused
    if (!enabled) {
      if (camera.status !== 'active') setLocalDetection({ status: 'idle', score: null, rawLevel: 0, reason: null })
      return
    }
    if (!aiBaselineId) {
      setLocalDetection({
        status: 'uncalibrated',
        score: null,
        rawLevel: 0,
        reason: 'AI 서버 기준 자세가 없어요 — 재캘리브레이션을 진행해 주세요',
      })
      return
    }

    let inFlight = false // 서버가 느릴 때 요청이 겹쳐 쌓이지 않도록
    const id = setInterval(async () => {
      if (inFlight) return
      const video = detectionVideoRef.current
      if (!video || video.readyState < 2) return
      const image = captureFrame(video)
      if (!image) return
      inFlight = true
      try {
        const res = await aiApi.monitorFrame({
          image,
          baseline_id: aiBaselineId,
          session_id: aiSessionId.current,
        })
        if (!res.detected) {
          // 자리 비움은 나쁜 자세로 치지 않는다
          setPosture('good')
          setLocalDetection({ status: 'tracking', score: null, rawLevel: 0, reason: '자리 비움 — 화면에서 사람을 찾지 못했어요' })
        } else {
          // 서버 alert_level(0/1/2) → 우리 3단계: 1→토스트(warn2), 2→전체화면(warn3),
          // 0인데 posture_ok=false 면 위젯만 바뀌는 warn1
          const level = res.alert_level >= 2 ? 3 : res.alert_level === 1 ? 2 : res.posture_ok ? 0 : 1
          setPosture(level === 0 ? 'good' : `warn${level}`)
          setLocalDetection({
            status: 'tracking',
            score: res.score ?? null,
            rawLevel: level,
            reason: res.issues?.[0]?.message ?? (res.posture_ok ? '기준 자세를 잘 유지하고 있어요' : '기준 자세에서 벗어나고 있어요'),
            issues: res.issue_codes ?? [],
          })
        }
        setTick((t) => t + 1)
      } catch (err) {
        setLocalDetection({
          status: 'error',
          score: null,
          rawLevel: 0,
          reason: err?.status ? `AI 서버 오류 (HTTP ${err.status}): ${err.message}` : (err?.message ?? 'AI 서버에 연결하지 못했어요'),
        })
      } finally {
        inFlight = false
      }
    }, AI_FRAME_INTERVAL_MS)
    return () => clearInterval(id)
  }, [calibrated, camera.status, paused, screen, aiBaselineId])

  // 일시정지 시 서버의 경고 지속시간도 리셋
  useEffect(() => {
    if (aiEnabled && paused) aiApi.monitorReset(aiSessionId.current)
  }, [paused])

  // 로컬 감지 루프 — AI 서버 미설정 시. 캘리브레이션 기준과 현재 프레임을 브라우저 안에서만 비교한다.
  useEffect(() => {
    if (aiEnabled) return
    const enabled = calibrated && screen === 'monitor' && camera.status === 'active' && !paused
    if (!enabled) {
      if (camera.status !== 'active') setLocalDetection({ status: 'idle', score: null, rawLevel: 0, reason: null })
      badPostureRef.current = { rawLevel: 0, since: 0 }
      return
    }

    if (pose.status === 'loading') {
      setLocalDetection({ status: 'loading', score: null, rawLevel: 0, reason: '자세 모델을 준비하는 중이에요' })
      return
    }
    if (pose.status === 'error') {
      setLocalDetection({ status: 'error', score: null, rawLevel: 0, reason: '자세 모델을 불러오지 못했어요' })
      return
    }
    if (pose.status !== 'ready') return

    const id = setInterval(() => {
      const result = pose.detect(detectionVideoRef.current)
      const landmarks = result?.landmarks?.[0] ?? null
      const evaluation = assessPosture(landmarks, calibration?.landmarks)
      const now = Date.now()

      if (evaluation.status !== 'tracking') {
        setLocalDetection({ ...evaluation, status: evaluation.status })
        return
      }

      const rawLevel = evaluation.rawLevel
      if (rawLevel === 0) {
        badPostureRef.current = { rawLevel: 0, since: 0 }
        setPosture('good')
      } else {
        if (badPostureRef.current.rawLevel !== rawLevel || badPostureRef.current.since === 0) {
          badPostureRef.current = { rawLevel, since: now }
        }
        const heldMs = now - badPostureRef.current.since
        // 나쁜 상태가 이어질수록 warn1 → warn2 → warn3으로 단계적으로 올린다.
        const level = rawLevel >= 3 && heldMs >= 8000 ? 3 : rawLevel >= 2 && heldMs >= 3000 ? 2 : 1
        setPosture(`warn${level}`)
      }

      setLocalDetection({ ...evaluation, status: 'tracking' })
      setTick((t) => t + 1)
    }, DETECT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [calibrated, calibration, camera.status, paused, pose.detect, pose.status, screen])

  useEffect(() => {
    postureSince.current = Date.now()
  }, [posture])

  const warnLevel = WARN_LEVEL[posture]
  // 실제 개입 단계는 설정 상한으로 캡. 데모 트리거는 상한을 무시하고 보여준다.
  const effectiveLevel = demoAlert || Math.min(warnLevel, settings.maxAlertLevel)

  // 2단계 이상 경고가 새로 발생하면 알림 횟수 + 알림음
  const prevLevel = useRef(0)
  useEffect(() => {
    if (effectiveLevel >= 2 && prevLevel.current < 2) {
      setAlertCount((c) => c + 1)
      maybeChime(settings)
    }
    prevLevel.current = effectiveLevel
  }, [effectiveLevel, settings])

  const triggerDemo = useCallback((level) => {
    clearTimeout(demoTimer.current)
    setDemoAlert(level)
    // 1·2단계 데모는 잠시 후 자동 해제, 3단계는 버튼으로 해제
    if (level === 1) demoTimer.current = setTimeout(() => setDemoAlert(0), 4500)
    if (level === 2) demoTimer.current = setTimeout(() => setDemoAlert(0), 7000)
  }, [])

  const clearDemo = useCallback(() => {
    clearTimeout(demoTimer.current)
    setDemoAlert(0)
  }, [])

  const resolvePosture = useCallback(() => {
    setPosture('good')
    clearDemo()
  }, [clearDemo])

  const postponeStretch = useCallback(() => {
    setStretchSuggest(false)
    setStretchLeft(10 * 60)
  }, [])

  const startStretchNow = useCallback(() => {
    setStretchSuggest(false)
    setStretchLeft(settings.stretchMin * 60)
    setScreen('stretch') // '/stretch' 로 이동하면 위젯 모드도 자연히 해제된다
  }, [settings.stretchMin, setScreen])

  const resetSession = useCallback(() => {
    setElapsedSec(0)
    setAlertCount(0)
    setStretchLeft(settings.stretchMin * 60)
    setStretchSuggest(false)
  }, [settings.stretchMin])

  const updateSetting = useCallback((key, value) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])

  const meta = POSTURE_META[posture]
  const postureSinceSec = Math.max(0, Math.floor((Date.now() - postureSince.current) / 1000))

  const value = {
    screen, setScreen,
    calibrated, setCalibrated,
    calibration, setCalibration,
    posture, setPosture, meta, warnLevel, effectiveLevel, postureSinceSec,
    demoAlert, triggerDemo, clearDemo, resolvePosture,
    paused, setPaused,
    widgetMode, setWidgetMode,
    settings, setSettings, updateSetting,
    alertCount, elapsedSec, stretchLeft, stretchSuggest, setStretchSuggest,
    postponeStretch, startStretchNow, resetSession,
    tick, camera, detectionVideoRef, localDetection,
    aiEnabled, aiBaselineId, saveAiBaselineId,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
