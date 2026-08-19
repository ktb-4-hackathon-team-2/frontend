import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from './RouterContext'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { POSTURE_META } from '../data/dummy'
import { maybeChime } from '../lib/sound'
import {
  AlertTracker,
  computeMetrics,
  evaluateAgainstBaseline,
  toDisplayScore,
  toRegionScores,
  visibilityOk,
} from '../lib/postureDetector'

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

// 스무딩 — 서버는 1~2초 간격 프레임이라 자연히 뭉개지지만, 로컬은 0.5초마다 보므로
// 지표를 EMA로 평활화한다 (α=0.25, 500ms 틱 기준 시상수 약 2초).
const SMOOTH_ALPHA = 0.25
// 나쁜 자세가 이 시간 이상 이어져야 warn1(위젯 신호)을 띄운다 — 순간 떨림으로 인한 깜빡임 방지
const WARN1_AFTER_SEC = 1.5

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
  const [localDetection, setLocalDetection] = useState({ status: 'idle', score: null, reason: null })
  const camera = useCamera()
  const detectionVideoRef = useRef(null)
  const pose = usePoseLandmarker(calibrated && screen === 'monitor' && camera.status === 'active')
  const demoTimer = useRef(null)
  const postureSince = useRef(Date.now())
  // 경고 상태머신 (posture.py AlertTracker 포팅판) — 5초 지속 시 팝업, 15초 지속 시 강한 경고
  const trackerRef = useRef(new AlertTracker())
  // 지표 EMA 상태
  const emaRef = useRef(null)

  // 기준 자세 지표 — 캘리브레이션 랜드마크에서 한 번만 계산.
  // 저장된 기준 좌표는 캡처 시점에 이미 가시성 검사를 통과했고 visibility 필드가
  // 제거된 상태이므로(copyLandmarks), 여기서 visibilityOk를 다시 검사하면 안 된다.
  const baselineMetrics = useMemo(() => {
    const lm = calibration?.landmarks
    if (!lm) return null
    try {
      return computeMetrics(lm)
    } catch {
      return null
    }
  }, [calibration])

  // AI 서버 baseline — 캘리브레이션 한 컷 등록용 (실시간 판정에는 쓰지 않음)
  const [aiBaselineId, setAiBaselineId] = useState(() => localStorage.getItem('bandeut.baselineId') || '')
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

  // 감지 루프 — 판정은 전부 이 기기 안에서 (AI 레포 posture.py 포팅판).
  // 프레임/랜드마크를 서버로 보내지 않는다.
  useEffect(() => {
    const enabled = calibrated && screen === 'monitor' && camera.status === 'active' && !paused
    if (!enabled) {
      if (camera.status !== 'active') setLocalDetection({ status: 'idle', score: null, reason: null })
      trackerRef.current = new AlertTracker()
      emaRef.current = null
      return
    }

    if (pose.status === 'loading') {
      setLocalDetection({ status: 'loading', score: null, reason: '자세 모델을 준비하는 중이에요' })
      return
    }
    if (pose.status === 'error') {
      setLocalDetection({ status: 'error', score: null, reason: '자세 모델을 불러오지 못했어요' })
      return
    }
    if (pose.status !== 'ready') return
    if (!baselineMetrics) {
      setLocalDetection({ status: 'uncalibrated', score: null, reason: '기준 자세가 없어요 — 재캘리브레이션을 진행해 주세요' })
      return
    }

    const id = setInterval(() => {
      const result = pose.detect(detectionVideoRef.current)
      const landmarks = result?.landmarks?.[0] ?? null
      const now = Date.now() / 1000

      if (!landmarks || !visibilityOk(landmarks)) {
        // 자리 비움/가림 — 비운 시간은 나쁜 자세 지속시간에서 제외 (note_absence)
        trackerRef.current.noteAbsence(now)
        setLocalDetection((d) => ({ ...d, status: 'lost', reason: '얼굴과 양쪽 어깨를 찾는 중이에요' }))
        return
      }

      const raw = computeMetrics(landmarks)
      // 지표 EMA — 프레임 단위 좌표 떨림을 흡수한 뒤 판정에 넘긴다
      const prev = emaRef.current
      const metrics = prev
        ? Object.fromEntries(
            Object.entries(raw).map(([k, v]) => [k, prev[k] * (1 - SMOOTH_ALPHA) + v * SMOOTH_ALPHA]),
          )
        : raw
      emaRef.current = metrics

      const ev = evaluateAgainstBaseline(metrics, baselineMetrics, 'medium')
      const alert = trackerRef.current.update(ev.posture_ok, now)
      // 서버와 같은 매핑: alert_level 1→토스트(warn2), 2→전체화면(warn3).
      // warn1(위젯 신호)은 나쁜 자세가 WARN1_AFTER_SEC 이상 이어졌을 때만 — 깜빡임 방지.
      const level =
        alert.alert_level >= 2 ? 3
        : alert.alert_level === 1 ? 2
        : ev.posture_ok ? 0
        : alert.bad_duration_sec >= WARN1_AFTER_SEC ? 1
        : 0
      setPosture(level === 0 ? 'good' : `warn${level}`)
      setLocalDetection({
        status: 'tracking',
        score: ev.score,
        displayScore: toDisplayScore(ev.score),
        regionScores: toRegionScores(ev.deviations),
        postureOk: ev.posture_ok,
        // 심각도 높은 순으로 — 첫 번째가 경고 문구·스트레칭 추천의 기준이 된다
        issues: [...ev.issues].sort((a, b) => b.severity - a.severity).map((i) => i.code),
        badDurationSec: alert.bad_duration_sec,
        reason: ev.issues[0]?.message ?? '기준 자세를 잘 유지하고 있어요',
      })
      setTick((t) => t + 1)
    }, DETECT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [calibrated, baselineMetrics, camera.status, paused, pose.detect, pose.status, screen])

  // 일시정지/재개 시 경고 지속시간 리셋
  useEffect(() => {
    trackerRef.current = new AlertTracker()
  }, [paused])

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

  // 경고에서 특정 스트레칭 세션으로 바로 진입 (예: 거북목 경고 → 턱 당기기)
  const [pendingStretchId, setPendingStretchId] = useState(null)
  const requestStretch = useCallback(
    (id) => {
      setPendingStretchId(id)
      setScreen('stretch')
    },
    [setScreen],
  )
  const clearPendingStretch = useCallback(() => setPendingStretchId(null), [])

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
    pendingStretchId, requestStretch, clearPendingStretch,
    tick, camera, detectionVideoRef, localDetection,
    aiBaselineId, saveAiBaselineId,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
