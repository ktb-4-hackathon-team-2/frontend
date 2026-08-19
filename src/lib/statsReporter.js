// 1분 단위 모니터링 집계를 앱 서버(Spring)로 보내는 전송기.
// 엔드포인트: POST /api/monitor/stats (Authorization: Bearer) — 백엔드 스펙에 아직 없는
// 신규 API이므로, 서버가 준비되기 전에는 조용히 큐에 쌓였다가 다음 주기에 재시도한다.
//
// payload 스키마 (백엔드 팀 전달용):
// {
//   window_start: ISO8601, window_end: ISO8601,
//   ticks: number,            // 창 안의 판정 횟수 (2초에 1틱)
//   good_ratio: number|null,  // 바른 자세 비율 0~1
//   avg_score: number|null,   // 평균 편차 점수 (0=완벽, 1↑=임계 초과)
//   alerts: number,           // 경고(레벨1+) 발생 횟수
//   issue_counts: { neck_tilt: n, shoulder_tilt: n, ... },
//   paused_sec: number
// }

import { API_BASE, getAccessToken } from './api'

const MAX_QUEUE = 30 // 최대 30분치 보관 — 초과 시 오래된 것부터 버림
const queue = []
let sending = false

export function enqueueStats(payload) {
  queue.push(payload)
  if (queue.length > MAX_QUEUE) queue.shift()
}

export async function flushStats({ keepalive = false } = {}) {
  if (sending || queue.length === 0) return
  const token = getAccessToken()
  if (!token) return // 로그아웃 상태 — 큐에 보관해 두고 로그인 후 재시도
  sending = true
  try {
    while (queue.length > 0) {
      const payload = queue[0]
      let res
      try {
        res = await fetch(`${API_BASE}/api/monitor/stats`, {
          method: 'POST',
          keepalive, // 탭 종료 중에도 전송이 이어지도록 (sendBeacon은 인증 헤더 불가)
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
      } catch {
        return // 네트워크 실패 — 다음 주기에 재시도
      }
      if (!res.ok) return // 4xx/5xx(엔드포인트 미구현 포함) — 큐 유지, 다음 주기에 재시도
      queue.shift()
    }
  } finally {
    sending = false
  }
}
