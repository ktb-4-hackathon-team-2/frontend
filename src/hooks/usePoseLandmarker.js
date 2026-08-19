import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

// wasm은 npm 패키지에서 public/으로 복사해 로컬 서빙 (Tauri 패키징 대비).
// 모델(.task, ~5.5MB)만 최초 1회 구글 CDN에서 받는다 — 오프라인 배포 시 로컬로 교체할 것.
const WASM_PATH = '/mediapipe-wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

// 모듈 레벨 캐시 — StrictMode 이중 마운트/화면 재진입에도 모델은 한 번만 로드
let landmarkerPromise = null

async function loadLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  try {
    return await PoseLandmarker.createFromOptions(fileset, options('GPU'))
  } catch {
    // 일부 환경은 GPU 델리게이트 초기화에 실패한다
    return await PoseLandmarker.createFromOptions(fileset, options('CPU'))
  }
}

/**
 * Pose Landmarker 로더.
 * status: idle | loading | ready | error
 * detect(video) → PoseLandmarkerResult | null
 */
export function usePoseLandmarker(enabled) {
  const [status, setStatus] = useState('idle')
  const ref = useRef(null)

  useEffect(() => {
    if (!enabled) return
    if (ref.current) {
      setStatus('ready')
      return
    }
    let cancelled = false
    setStatus('loading')
    if (!landmarkerPromise) landmarkerPromise = loadLandmarker()
    landmarkerPromise.then(
      (lm) => {
        if (cancelled) return
        ref.current = lm
        setStatus('ready')
      },
      () => {
        if (cancelled) return
        landmarkerPromise = null // 다음 시도에서 재로드
        setStatus('error')
      },
    )
    return () => {
      cancelled = true
    }
  }, [enabled])

  const detect = useCallback((video) => {
    if (!ref.current || !video || video.videoWidth === 0) return null
    try {
      return ref.current.detectForVideo(video, performance.now())
    } catch {
      return null
    }
  }, [])

  return { status, detect }
}
