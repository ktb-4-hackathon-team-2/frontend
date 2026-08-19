import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * getUserMedia 상태 머신.
 * status: idle | requesting | active | denied | notfound | busy | error
 * 스트림은 로컬에서만 사용하고 어디로도 전송하지 않는다.
 */
export function useCamera() {
  const [status, setStatus] = useState('idle')
  const [stream, setStream] = useState(null)
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const streamRef = useRef(null)
  const statusRef = useRef('idle')
  statusRef.current = status

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
    } catch {
      // 장치 목록은 부가 정보 — 실패해도 무시
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
    setStatus('idle')
  }, [])

  const start = useCallback(
    async (id) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        return
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setStream(null)
      setStatus('requesting')
      try {
        const target = id ?? deviceId
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(target ? { deviceId: { exact: target } } : {}),
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        streamRef.current = s
        setStream(s)
        setStatus('active')
        const track = s.getVideoTracks()[0]
        const usedId = track?.getSettings?.().deviceId
        if (usedId) setDeviceId(usedId)
        // OS나 다른 앱이 스트림을 끊는 경우
        track?.addEventListener('ended', stop)
        // 권한 승인 후에야 장치 라벨이 채워진다
        refreshDevices()
      } catch (e) {
        streamRef.current = null
        setStream(null)
        switch (e?.name) {
          case 'NotAllowedError':
          case 'SecurityError':
            setStatus('denied')
            break
          case 'NotFoundError':
          case 'OverconstrainedError':
            setStatus('notfound')
            break
          case 'NotReadableError':
          case 'AbortError':
            setStatus('busy')
            break
          default:
            setStatus('error')
        }
      }
    },
    [deviceId, refreshDevices, stop],
  )

  const selectDevice = useCallback(
    (id) => {
      setDeviceId(id)
      if (statusRef.current === 'active' || statusRef.current === 'requesting') start(id)
    },
    [start],
  )

  useEffect(() => {
    refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices)
  }, [refreshDevices])

  // 언마운트 시 스트림 정리
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  return { status, stream, devices, deviceId, start, stop, selectDevice }
}
