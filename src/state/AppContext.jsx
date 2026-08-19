import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from './RouterContext'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { POSTURE_META } from '../data/dummy'
import { maybeChime } from '../lib/sound'
import { assessPosture } from '../lib/postureDetector'

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
  const pose = usePoseLandmarker(calibrated && screen === 'monitor' && camera.status === 'active')
  const demoTimer = useRef(null)
  const postureSince = useRef(Date.now())
  const badPostureRef = useRef({ rawLevel: 0, since: 0 })

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

  // 로컬 감지 루프 — 캘리브레이션 기준과 현재 프레임을 브라우저 안에서만 비교한다.
  useEffect(() => {
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
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
