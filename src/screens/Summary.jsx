import { useApp } from '../state/AppContext'
import { Btn, Card, Icon, MicroLabel } from '../components/ui'
import { fmtDur } from '../lib/format'

function RatioRing({ pct }) {
  const R = 74
  const C = 2 * Math.PI * R
  const value = pct ?? 0
  return (
    <div className="relative h-[184px] w-[184px] shrink-0">
      <svg viewBox="0 0 184 184" className="h-full w-full -rotate-90">
        <circle cx="92" cy="92" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle
          cx="92"
          cy="92"
          r={R}
          fill="none"
          stroke="#3ec98f"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - value / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <div className="font-mono text-4xl font-semibold leading-none tracking-tight">
          {pct != null ? pct : '—'}
          {pct != null && <span className="text-lg text-mid">%</span>}
        </div>
        <MicroLabel>자세 유지율</MicroLabel>
      </div>
    </div>
  )
}

export default function Summary() {
  const { sessionSummary, setScreen, camera, resetSession } = useApp()

  const restart = () => {
    resetSession()
    camera.start()
    setScreen('monitor')
  }

  if (!sessionSummary) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <Icon name="videoOff" size={28} className="text-dim" />
        <p className="text-sm text-mid">요약할 세션이 없어요 — 모니터링을 먼저 진행해 주세요.</p>
        <Btn kind="primary" onClick={() => setScreen('monitor')}>
          모니터링으로
        </Btn>
      </div>
    )
  }

  const s = sessionSummary
  const pct = s.goodRatio != null ? Math.round(s.goodRatio * 100) : null
  const ended = new Date(s.endedAt)
  const dateLabel = ended.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  const timeLabel = ended.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rise mb-6 text-center">
        <MicroLabel>Session Summary</MicroLabel>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">오늘의 모니터링 요약</h1>
        <p className="mt-1.5 text-sm text-mid">
          {dateLabel} · {timeLabel} 종료
        </p>
      </div>

      {/* 핵심 수치 — 유지율 + 알림 횟수 */}
      <Card className="rise d1 flex items-center gap-8 p-8">
        <RatioRing pct={pct} />
        <div className="grid flex-1 grid-cols-2 gap-6">
          <div>
            <MicroLabel>경고 알림</MicroLabel>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-[32px] font-semibold leading-none">{s.alerts}</span>
              <span className="text-sm text-mid">회</span>
            </div>
          </div>
          <div>
            <MicroLabel>모니터링 시간</MicroLabel>
            <div className="mt-2 font-mono text-[32px] font-semibold leading-none">{fmtDur(s.monitoredSec)}</div>
          </div>
          <p className="col-span-2 text-xs leading-relaxed text-dim">
            {pct == null
              ? '이번 세션에는 판정 기록이 없어요. 캘리브레이션 후 모니터링하면 유지율이 집계됩니다.'
              : pct >= 80
                ? '오늘 자세가 잘 유지됐어요. 이 페이스를 내일도 이어가 보세요.'
                : pct >= 60
                  ? '무너지는 순간이 종종 있었어요. 스트레칭 주기를 조금 앞당겨 보는 건 어떨까요?'
                  : '오늘은 자세가 많이 흔들렸어요. 환경 가이드를 다시 점검해 보세요.'}
          </p>
        </div>
      </Card>

      <div className="rise d3 mt-6 flex justify-center gap-3">
        <Btn kind="primary" onClick={restart}>
          <Icon name="video" size={15} />
          다시 모니터링 시작
        </Btn>
        <Btn kind="outline" onClick={() => setScreen('report')}>
          <Icon name="chart" size={15} />
          리포트 보기
        </Btn>
      </div>
    </div>
  )
}
