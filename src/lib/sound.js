// 알림음 — 차임/우드는 WebAudio 합성, 커스텀 알람은 번들된 WAV 재생.
import funnyAlarmUrl from '../../static/funny_alarm.wav'

let audioCtx = null
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

let funnyAudio = null
function playFunnyAlarm() {
  try {
    if (!funnyAudio) {
      funnyAudio = new Audio(funnyAlarmUrl)
      funnyAudio.volume = 0.7
    }
    funnyAudio.currentTime = 0
    funnyAudio.play().catch(() => {})
  } catch {
    // 재생 실패는 치명적이지 않음
  }
}

export function isQuietNow({ quietOn, quietFrom, quietTo }) {
  if (!quietOn) return false
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [fh, fm] = quietFrom.split(':').map(Number)
  const [th, tm] = quietTo.split(':').map(Number)
  const from = fh * 60 + fm
  const to = th * 60 + tm
  // 22:00–08:00처럼 자정을 넘는 구간 처리
  return from <= to ? cur >= from && cur < to : cur >= from || cur < to
}

export function playChime(kind = 'chime') {
  if (kind === 'none') return
  if (kind === 'funny') {
    playFunnyAlarm()
    return
  }
  try {
    const a = ctx()
    const t0 = a.currentTime
    const notes =
      kind === 'wood'
        ? [{ f: 880, d: 0.09 }, { f: 660, d: 0.12 }]
        : [{ f: 523.25, d: 0.4 }, { f: 783.99, d: 0.55 }]
    notes.forEach((n, i) => {
      const osc = a.createOscillator()
      const gain = a.createGain()
      osc.type = kind === 'wood' ? 'triangle' : 'sine'
      osc.frequency.value = n.f
      const st = t0 + i * (kind === 'wood' ? 0.1 : 0.13)
      gain.gain.setValueAtTime(0.0001, st)
      gain.gain.exponentialRampToValueAtTime(0.14, st + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, st + n.d)
      osc.connect(gain).connect(a.destination)
      osc.start(st)
      osc.stop(st + n.d + 0.05)
    })
  } catch {
    // 오디오 실패는 치명적이지 않음
  }
}

export function maybeChime(settings) {
  if (settings.soundOn && settings.sound !== 'none' && !isQuietNow(settings)) {
    playChime(settings.sound)
  }
}
