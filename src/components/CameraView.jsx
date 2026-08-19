import { useEffect, useRef } from 'react'
import { useApp } from '../state/AppContext'
import { Btn, Icon } from './ui'

const STATUS_META = {
  idle: {
    icon: 'videoOff',
    title: '카메라가 꺼져 있어요',
    desc: '켜면 이 자리에서 자세를 지켜봅니다. 영상은 기기 밖으로 나가지 않아요.',
    action: '카메라 켜기',
  },
  requesting: {
    icon: 'video',
    title: '카메라 권한을 기다리는 중',
    desc: '브라우저 상단의 권한 요청에서 "허용"을 눌러 주세요.',
    action: null,
  },
  denied: {
    icon: 'videoOff',
    title: '카메라 권한이 거부되었어요',
    desc: '주소창 오른쪽 카메라 아이콘 → "허용"으로 바꾼 뒤 다시 시도해 주세요.',
    action: '다시 시도',
  },
  notfound: {
    icon: 'videoOff',
    title: '연결된 카메라를 찾을 수 없어요',
    desc: '웹캠 연결을 확인하거나, 다른 카메라를 연결해 주세요.',
    action: '다시 검색',
  },
  busy: {
    icon: 'alert',
    title: '다른 앱이 카메라를 사용 중이에요',
    desc: 'Zoom 등 회의 앱을 종료한 뒤 다시 시도해 주세요.',
    action: '다시 시도',
  },
  error: {
    icon: 'alert',
    title: '카메라를 시작하지 못했어요',
    desc: '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
    action: '다시 시도',
  },
}

export function CameraView({ videoRef, overlay = null, className = '', showControls = true }) {
  const { camera, detectionVideoRef } = useApp()
  const localRef = useRef(null)
  const ref = videoRef || detectionVideoRef || localRef
  const active = camera.status === 'active'

  useEffect(() => {
    if (ref.current) ref.current.srcObject = camera.stream
  }, [camera.stream, ref])

  const meta = STATUS_META[camera.status] || STATUS_META.error

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-line bg-black/50 ${className}`}>
      <div className="relative min-h-0 flex-1">
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-0'}`}
        />
        {active && overlay}
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {camera.status === 'requesting' ? (
              <span className="relative flex h-10 w-10 items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-good/40 ring-ping" />
                <Icon name="video" size={22} className="text-good" />
              </span>
            ) : (
              <Icon name={meta.icon} size={26} className="text-dim" />
            )}
            <div className="text-sm font-medium text-hi">{meta.title}</div>
            <p className="max-w-[260px] text-xs leading-relaxed text-dim">{meta.desc}</p>
            {meta.action && (
              <Btn size="sm" kind="outline" onClick={() => camera.start()}>
                <Icon name="refresh" size={13} />
                {meta.action}
              </Btn>
            )}
          </div>
        )}
        {active && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-good backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-good blink-dot" />
            Live
          </span>
        )}
      </div>

      {showControls && (
        <div className="flex items-center gap-2 border-t border-line bg-surface/90 px-3 py-2.5">
          <Btn
            size="sm"
            kind={active ? 'ghost' : 'outline'}
            onClick={() => (active ? camera.stop() : camera.start())}
          >
            <Icon name={active ? 'videoOff' : 'video'} size={14} />
            {active ? '끄기' : '켜기'}
          </Btn>
          <div className="relative min-w-0 flex-1">
            <select
              value={camera.deviceId}
              onChange={(e) => camera.selectDevice(e.target.value)}
              disabled={camera.devices.length === 0}
              className="w-full cursor-pointer appearance-none truncate rounded-lg border border-line bg-raised py-1.5 pl-3 pr-8 text-xs text-mid outline-none transition-colors hover:text-hi focus:border-good/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {camera.devices.length === 0 && <option value="">카메라 검색 중…</option>}
              {camera.devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `카메라 ${i + 1}`}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-dim" />
          </div>
        </div>
      )}
    </div>
  )
}
