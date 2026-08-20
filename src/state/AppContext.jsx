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
import { enqueueStats, flushStats } from '../lib/statsReporter'
import { pipSupported, openPipWindow } from '../lib/pip'
import { api, getAccessToken } from '../lib/api'
import { useAuth } from './AuthContext'

// 화면 ↔ URL 매핑 — screen 상태의 원천은 URL이다
export const SCREEN_PATHS = {
  monitor: '/monitor',
  report: '/report',
  stretch: '/stretch',
  environment: '/environment',
  posture: '/posture',
  alerts: '/alerts',
  settings: '/settings',
  summary: '/summary', // 모니터링 종료 후 세션 요약 (사이드바에는 없음)
}
const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREEN_PATHS).map(([s, p]) => [p, s]))

// rAF가 아니라 setInterval: 탭이 비활성화돼도 감지 루프는 계속 돌아야 한다.
// 2초 1틱 — 1분 집계(30샘플) 전송과 짝을 맞춘 주기. 모니터 화면의 스켈레톤은
// 별도의 그리기 루프(0.3초)가 담당하므로 판정 주기와 무관하게 부드럽다.
export const DETECT_INTERVAL_MS = 2000

// 지표 EMA 평활화 — 틱 주기에 맞춰 계수를 조정한다 (2초 틱 기준 α=0.6, 시상수 약 2초.
// 틱을 되돌리면 α도 같이: 500ms 틱이면 0.25).
const SMOOTH_ALPHA = 0.6
// 나쁜 자세가 이 시간 이상 이어져야 warn1(위젯 신호)을 띄운다 — 순간 떨림으로 인한 깜빡임 방지
const WARN1_AFTER_SEC = 1.5
// 자리 비움이 이 시간 이상 이어지면 자동 일시정지 (카메라 끄기 + 전용 안내)
const ABSENCE_PAUSE_SEC = 5

export const WARN_LEVEL = { good: 0, warn1: 1, warn2: 2, warn3: 3 }

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const { path, navigate } = useRouter()

  // screen/widgetMode 는 URL에서 파생 — setScreen/setWidgetMode 는 내비게이션이다.
  // '/stretch/<동작id>' 같은 서브 경로는 스트레칭 화면으로 매핑된다.
  const screenFromPath = PATH_TO_SCREEN[path] ?? (path.startsWith('/stretch/') ? 'stretch' : undefined)
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

  const [cameraView, setCameraViewState] = useState(() => localStorage.getItem('bandeut_camera_view') || 'front')
  const setCameraView = useCallback((v) => {
    setCameraViewState(v)
    try {
      localStorage.setItem('bandeut_camera_view', v)
    } catch {}
  }, [])

  const [calibrated, setCalibrated] = useState(false)
  const [calibration, setCalibration] = useState(null) // { landmarks, at, view }
  const [posture, setPosture] = useState('good')
  const [paused, setPausedRaw] = useState(false)
  // 자리 비움 자동 일시정지 상태 — 전용 전체화면 안내를 띄운다
  const [awayPaused, setAwayPaused] = useState(false)
  const [demoAlert, setDemoAlert] = useState(0) // 알림 데모용 강제 단계 (0 = 없음)
  const [settings, setSettings] = useState({
    maxAlertLevel: 2, // 3단계는 옵트인
    soundOn: true,
    sound: 'chime', // chime | wood | funny | none — 기본값은 서버(api-spec 7-1)와 일치해야 함
    quietOn: false,
    quietFrom: '22:00',
    quietTo: '08:00',
    stretchMin: 50,
    sensitivity: 50, // 판정 민감도 슬라이더 (0=느슨 ~ 100=민감) → strictness 배율로 변환
  })
  const [alertCount, setAlertCount] = useState(4)
  const [elapsedSec, setElapsedSec] = useState(4 * 3600 + 32 * 60) // 오늘 누적 (더미로 시작)
  const [stretchLeft, setStretchLeft] = useState(50 * 60)
  const [stretchSuggest, setStretchSuggest] = useState(false)
  const [tick, setTick] = useState(0)
  const [localDetection, setLocalDetection] = useState({ status: 'idle', score: null, reason: null })
  const camera = useCamera()

  // 감지 전용 히든 비디오 — 화면에 카메라 뷰가 없어도(리포트·설정·위젯 모드)
  // 프레임을 계속 공급해서 어디서든 측정이 이어지게 한다.
  const detectionVideoRef = useRef(null)
  useEffect(() => {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.setAttribute('aria-hidden', 'true')
    v.style.cssText = 'position:fixed;left:-9999px;width:2px;height:2px;opacity:0;pointer-events:none'
    document.body.appendChild(v)
    detectionVideoRef.current = v
    return () => {
      v.srcObject = null
      v.remove()
      detectionVideoRef.current = null
    }
  }, [])
  useEffect(() => {
    const v = detectionVideoRef.current
    if (!v) return
    v.srcObject = camera.stream
    if (camera.stream) v.play().catch(() => {})
  }, [camera.stream])

  // 스트레칭 화면에서는 모니터링을 쉰다 — 스트레칭 동작을 나쁜 자세로 오판하지 않도록
  const monitoringOn = calibrated && screen !== 'stretch' && camera.status === 'active'
  const pose = usePoseLandmarker(monitoringOn)

  // 일시정지 ↔ 카메라 동기화: 일시정지하면 카메라를 끄고, 재개하면 켠다
  const setPaused = useCallback(
    (next) => {
      setPausedRaw(next)
      if (next) {
        camera.stop()
      } else {
        setAwayPaused(false)
        if (camera.status !== 'active') camera.start()
      }
    },
    [camera.stop, camera.start, camera.status], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // 반대 방향 동기화: 카메라 버튼/OS로 카메라가 꺼지면 일시정지, 켜지면 재개
  const prevCamStatus = useRef(camera.status)
  useEffect(() => {
    const prev = prevCamStatus.current
    prevCamStatus.current = camera.status
    if (!calibrated) return
    if (prev === 'active' && camera.status === 'idle') setPausedRaw(true)
    if (prev !== 'active' && camera.status === 'active') {
      setPausedRaw(false)
      setAwayPaused(false)
    }
  }, [camera.status, calibrated])
  const demoTimer = useRef(null)
  const postureSince = useRef(Date.now())
  // 경고 상태머신 (posture.py AlertTracker 포팅판) — 5초 지속 시 팝업, 15초 지속 시 강한 경고
  const trackerRef = useRef(new AlertTracker())
  // 자리 비움 시작 시각 — 5초 이상 이어지면 자동 일시정지
  const absenceSinceRef = useRef(null)
  // 지표 EMA 상태
  const emaRef = useRef(null)
  // 마지막으로 인식된 랜드마크 — 화면 오버레이(스켈레톤)용, 리렌더 없이 ref로 공유
  const lastLandmarksRef = useRef(null)
  // 1분 집계 전송용 버퍼
  const statsRef = useRef({ samples: [], issues: {}, alerts: 0, lastLevel: 0, windowStart: Date.now(), pausedSince: null, pausedMs: 0 })
  // 세션 누적 집계 (종료 요약용) + 종료 요약 스냅샷
  const sessionAggRef = useRef({ good: 0, total: 0 })
  const [sessionSummary, setSessionSummary] = useState(null)

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

  // 서버에 저장된 사용자 설정 불러오기 (민감도·알림음·알림 단계·스트레칭 주기)
  // — 앱 로드 시(토큰 보유) 그리고 로그인 완료 순간에 불러온다
  const { status: authStatus } = useAuth()
  useEffect(() => {
    if (authStatus !== 'authed' || !getAccessToken()) return
    api
      .getSettings()
      .then((s) => {
        if (!s) return
        setSettings((prev) => ({
          ...prev,
          ...(s.sensitivity != null ? { sensitivity: s.sensitivity } : {}),
          ...(s.sound ? { sound: s.sound, soundOn: s.sound !== 'none' } : {}),
          ...(s.maxAlertLevel != null ? { maxAlertLevel: s.maxAlertLevel } : {}),
          ...(s.stretchMin != null ? { stretchMin: s.stretchMin } : {}),
        }))
        if (s.stretchMin != null) setStretchLeft(s.stretchMin * 60)
      })
      .catch(() => {
        // 네트워크·서버 오류 — 기본값 유지 (GET은 미저장이어도 항상 200, api-spec 7-1)
      })
  }, [authStatus])

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
  // 프레임/랜드마크를 서버로 보내지 않는다. 스트레칭 화면을 제외한 모든 화면에서 동작.
  useEffect(() => {
    const enabled = monitoringOn && !paused
    if (!enabled) {
      if (camera.status !== 'active') setLocalDetection((d) => (d.status === 'idle' ? d : { status: 'idle', score: null, reason: d.reason }))
      trackerRef.current = new AlertTracker()
      emaRef.current = null
      absenceSinceRef.current = null
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

      lastLandmarksRef.current = landmarks

      if (!landmarks || !visibilityOk(landmarks)) {
        // 자리 비움/가림 — 비운 시간은 나쁜 자세 지속시간에서 제외 (note_absence)
        trackerRef.current.noteAbsence(now)
        // 자리 비움이 5초 이상 이어지면 자동 일시정지: 카메라 끄기 + 전용 안내
        if (absenceSinceRef.current == null) {
          absenceSinceRef.current = now
        } else if (now - absenceSinceRef.current >= ABSENCE_PAUSE_SEC) {
          absenceSinceRef.current = null
          setAwayPaused(true)
          setPausedRaw(true)
          camera.stop()
          setLocalDetection({ status: 'idle', score: null, reason: '자리 비움으로 모니터링을 일시정지했어요' })
          return
        }
        setLocalDetection((d) => ({ ...d, status: 'lost', reason: '얼굴과 양쪽 어깨를 찾는 중이에요' }))
        return
      }
      absenceSinceRef.current = null

      const raw = computeMetrics(landmarks)
      // 지표 EMA — 프레임 단위 좌표 떨림을 흡수한 뒤 판정에 넘긴다
      const prev = emaRef.current
      const metrics = prev
        ? Object.fromEntries(
            Object.entries(raw).map(([k, v]) => [k, prev[k] * (1 - SMOOTH_ALPHA) + v * SMOOTH_ALPHA]),
          )
        : raw
      emaRef.current = metrics

      // 민감도 슬라이더(0~100) → 임계값 배율. 지수 매핑으로 0=2.0×(매우 느슨),
      // 50=1.0×(서버 medium과 동일), 100=0.5×(매우 민감) — 체감되는 4배 폭.
      const strictScale = Math.pow(2, (50 - settings.sensitivity) / 50)
      const ev = evaluateAgainstBaseline(metrics, baselineMetrics, strictScale)
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
      // 1분 집계 버퍼에 샘플 적재
      const s = statsRef.current
      s.samples.push({ ok: ev.posture_ok, score: ev.score })
      for (const issue of ev.issues) s.issues[issue.code] = (s.issues[issue.code] ?? 0) + 1
      if (alert.alert_level >= 1 && s.lastLevel < 1) s.alerts += 1
      s.lastLevel = alert.alert_level

      // 세션 누적 (오늘 유지율 실시간 표시 + 종료 요약)
      sessionAggRef.current.total += 1
      if (ev.posture_ok) sessionAggRef.current.good += 1

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
        sessionRatio: sessionAggRef.current.total > 0 ? sessionAggRef.current.good / sessionAggRef.current.total : null,
      })
      setTick((t) => t + 1)
    }, DETECT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [calibrated, baselineMetrics, camera.status, paused, pose.detect, pose.status, screen, settings.sensitivity])

  // 일시정지/재개 시 경고 지속시간 리셋 + 일시정지 시간 집계
  useEffect(() => {
    trackerRef.current = new AlertTracker()
    const s = statsRef.current
    const now = Date.now()
    if (paused) {
      s.pausedSince = now
    } else if (s.pausedSince) {
      s.pausedMs += now - s.pausedSince
      s.pausedSince = null
    }
  }, [paused])

  // 현재 집계 창을 닫아 큐에 넣고 전송을 시도한다
  const flushWindow = useCallback((keepalive = false) => {
    const s = statsRef.current
    const now = Date.now()
    let pausedMs = s.pausedMs
    if (s.pausedSince) {
      pausedMs += now - s.pausedSince
      s.pausedSince = now
    }
    if (s.samples.length > 0 || pausedMs > 0) {
      const good = s.samples.filter((x) => x.ok).length
      const n = s.samples.length
      enqueueStats({
        window_start: new Date(s.windowStart).toISOString(),
        window_end: new Date(now).toISOString(),
        ticks: n,
        good_ratio: n ? Math.round((good / n) * 1000) / 1000 : null,
        avg_score: n ? Math.round((s.samples.reduce((a, x) => a + x.score, 0) / n) * 1000) / 1000 : null,
        alerts: s.alerts,
        issue_counts: s.issues,
        paused_sec: Math.round(pausedMs / 1000),
      })
    }
    s.samples = []
    s.issues = {}
    s.alerts = 0
    s.windowStart = now
    s.pausedMs = 0
    flushStats({ keepalive })
  }, [])

  // 1분마다 집계를 앱 서버로 전송 (POST /api/monitor/stats — 백엔드 신규 API,
  // 서버가 아직 없으면 큐에 쌓였다가 다음 주기에 재시도). 탭 종료 시 keepalive 플러시.
  useEffect(() => {
    const id = setInterval(() => flushWindow(false), 60_000)
    const onPageHide = () => flushWindow(true)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [flushWindow])

  // 모니터링 종료 — 잔여 집계를 즉시 전송하고 카메라를 끈 뒤 세션 요약 화면으로.
  // 유지율·알림 횟수는 즉시 보여주고, AI 코멘트는 추후 리포트 분석이 채운다.
  const endMonitoring = useCallback(() => {
    flushWindow(false)
    const agg = sessionAggRef.current
    setSessionSummary({
      endedAt: Date.now(),
      monitoredSec: elapsedSec,
      ticks: agg.total,
      goodRatio: agg.total > 0 ? agg.good / agg.total : null,
      alerts: alertCount,
    })
    setPosture('good')
    clearTimeout(demoTimer.current)
    setDemoAlert(0)
    camera.stop()
    setScreen('summary')
  }, [flushWindow, camera.stop, elapsedSec, alertCount, setScreen]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // 다음 스트레칭까지 남은 시간 증감 (분 단위) — 1분 밑으로 내려 실수로 제안이 뜨지 않게 클램프
  const adjustStretch = useCallback((deltaMin) => {
    setStretchLeft((s) => Math.min(90 * 60, Math.max(60, s + deltaMin * 60)))
  }, [])

  const startStretchNow = useCallback(() => {
    setStretchSuggest(false)
    setStretchLeft(settings.stretchMin * 60)
    setScreen('stretch') // '/stretch' 로 이동하면 위젯 모드도 자연히 해제된다
  }, [settings.stretchMin, setScreen])

  // 경고에서 특정 스트레칭 세션으로 바로 진입 (예: 거북목 경고 → 턱 당기기)
  // 동작별 URL(/stretch/<id>)로 이동하면 세션이 바로 열린다.
  const requestStretch = useCallback((id) => navigate(`/stretch/${id}`), [navigate])

  const resetSession = useCallback(() => {
    setElapsedSec(0)
    setAlertCount(0)
    setStretchLeft(settings.stretchMin * 60)
    setStretchSuggest(false)
    sessionAggRef.current = { good: 0, total: 0 }
  }, [settings.stretchMin])

  const updateSetting = useCallback((key, value) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])

  // 플로팅 위젯 (Document PiP) — 다른 앱 위에 떠 있는 미니 위젯 창 (Chrome 전용 옵션)
  const [pipWindow, setPipWindow] = useState(null)
  const openFloatingWidget = useCallback(async () => {
    if (!pipSupported) return
    try {
      const w = await openPipWindow()
      w.addEventListener('pagehide', () => setPipWindow(null))
      setPipWindow(w)
    } catch {
      // 사용자 제스처 밖 호출 등 — 조용히 무시
    }
  }, [])
  const closeFloatingWidget = useCallback(() => {
    setPipWindow((w) => {
      w?.close()
      return null
    })
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
    awayPaused, clearAwayPaused: () => setAwayPaused(false),
    widgetMode, setWidgetMode,
    settings, setSettings, updateSetting,
    alertCount, elapsedSec, stretchLeft, stretchSuggest, setStretchSuggest,
    postponeStretch, startStretchNow, adjustStretch, resetSession, endMonitoring, sessionSummary,
    requestStretch,
    tick, camera, detectionVideoRef, lastLandmarksRef, localDetection, pose,
    pipWindow, openFloatingWidget, closeFloatingWidget,
    cameraView, setCameraView,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
