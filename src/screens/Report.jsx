import { useState } from 'react'
import { DAYS14, HOURLY } from '../data/dummy'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader, TONE } from '../components/ui'
import { ChartCard, HourlyChart } from '../components/charts'

// 주 단위 리포트 — 첫 화면은 주간 날짜 스트립, 날짜 클릭 시 그날의 상세 리포트.
const TODAY = '8/19'
const DOW = ['월', '화', '수', '목', '금', '토', '일']
const WEEKS = [
  { label: '8월 1주', range: '8/3 – 8/9', days: ['8/3', '8/4', '8/5', '8/6', '8/7', '8/8', '8/9'] },
  { label: '8월 2주', range: '8/10 – 8/16', days: ['8/10', '8/11', '8/12', '8/13', '8/14', '8/15', '8/16'] },
  { label: '8월 3주', range: '8/17 – 8/23', days: ['8/17', '8/18', '8/19', '8/20', '8/21', '8/22', '8/23'] },
]
const BY_DATE = Object.fromEntries(DAYS14.map((d) => [d.d, d]))

const dateNum = (s) => {
  const [m, d] = s.split('/').map(Number)
  return m * 100 + d
}
const isFuture = (d) => dateNum(d) > dateNum(TODAY)

// 일자별 파생 더미 — 유지율이 낮을수록 알림이 많았던 것으로
const alertsFor = (day) => Math.max(0, Math.round((88 - day.rate) / 4))
const monitoredFor = (day) => `${6 + (day.rate % 3)}시간 ${(day.rate * 7) % 60}분`
const hourlyFor = (day) => HOURLY.map((h) => ({ ...h, rate: Math.max(30, Math.min(98, h.rate + (day.rate - 73))) }))

const rateTone = (v) => (v >= 80 ? TONE.good : v >= 65 ? TONE.warn1 : TONE.warn2)

function DayCell({ date, onSelect }) {
  const data = BY_DATE[date]
  const future = isFuture(date)
  const today = date === TODAY
  const dayNumber = date.split('/')[1]
  const tone = data ? rateTone(data.rate) : null

  return (
    <button
      disabled={!data}
      onClick={() => onSelect(date)}
      className={`flex min-h-[132px] cursor-pointer flex-col rounded-xl border p-3 text-left transition-all duration-150 disabled:cursor-default ${
        today
          ? 'border-good/40 bg-good/[0.06]'
          : data
            ? 'border-line bg-surface hover:border-line-strong hover:bg-white/[0.03]'
            : 'border-line bg-surface opacity-45'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-lg font-semibold">{dayNumber}</span>
        {today && <span className="rounded bg-good/15 px-1.5 py-0.5 text-[10px] font-medium text-good">오늘</span>}
      </div>
      {data ? (
        <>
          <div className="mt-auto flex items-baseline gap-0.5">
            <span className="font-mono text-xl font-semibold leading-none">{data.rate}</span>
            <span className="text-xs text-mid">%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className={`h-full rounded-full ${tone.bg}`} style={{ width: `${data.rate}%` }} />
          </div>
          <span className="mt-1.5 text-[11px] text-dim">알림 {alertsFor(data)}회</span>
        </>
      ) : (
        <span className="mt-auto text-[11px] text-dim">{future ? '—' : '기록 없음'}</span>
      )}
    </button>
  )
}

function DayReport({ date, onBack }) {
  const day = BY_DATE[date]
  const alerts = alertsFor(day)
  const tone = rateTone(day.rate)

  return (
    <div>
      <div className="rise mb-6 flex items-end justify-between gap-4">
        <div>
          <button onClick={onBack} className="flex cursor-pointer items-center gap-1 text-xs text-dim transition-colors hover:text-mid">
            <Icon name="chevronRight" size={12} className="rotate-180" />
            주간 리포트로
          </button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {date} ({day.dow}) 리포트
          </h1>
        </div>
        <Chip tone={tone === TONE.good ? 'good' : tone === TONE.warn1 ? 'warn1' : 'warn2'}>
          유지율 {day.rate}%
        </Chip>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-4">
        <Card className="rise d1 flex flex-col gap-2 p-5">
          <MicroLabel>자세 유지율</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{day.rate}</span>
            <span className="text-sm text-mid">%</span>
          </div>
        </Card>
        <Card className="rise d2 flex flex-col gap-2 p-5">
          <MicroLabel>경고 알림</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{alerts}</span>
            <span className="text-sm text-mid">회</span>
          </div>
        </Card>
        <Card className="rise d3 flex flex-col gap-2 p-5">
          <MicroLabel>시간당 평균 유지</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{day.hold}</span>
            <span className="text-sm text-mid">분</span>
          </div>
        </Card>
        <Card className="rise d4 flex flex-col gap-2 p-5">
          <MicroLabel>모니터링 시간</MicroLabel>
          <div className="font-mono text-[28px] font-semibold leading-none">{monitoredFor(day)}</div>
        </Card>
      </div>

      <ChartCard className="rise d4" title="시간대별 유지율" sub={`${date} (${day.dow}) · 더미 데이터`}>
        <HourlyChart data={hourlyFor(day)} />
      </ChartCard>

      {/* AI 코멘트 — 리포트 분석 API 연동 시 채워지는 자리 */}
      <Card className="rise d5 mt-4 p-6">
        <div className="flex items-center justify-between">
          <MicroLabel>AI 코멘트</MicroLabel>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn1" />
            분석 대기 중
          </span>
        </div>
        <div className="mt-4 flex animate-pulse flex-col gap-2.5" aria-hidden>
          <div className="h-3 w-11/12 rounded bg-white/[0.06]" />
          <div className="h-3 w-3/5 rounded bg-white/[0.06]" />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-dim">
          이 날의 기록에 대한 AI 분석 코멘트가 이 자리에 채워질 예정이에요.
        </p>
      </Card>
    </div>
  )
}

export default function Report() {
  const [weekIdx, setWeekIdx] = useState(WEEKS.length - 1)
  const [selected, setSelected] = useState(null)

  if (selected) return <DayReport date={selected} onBack={() => setSelected(null)} />

  const week = WEEKS[weekIdx]
  const weekData = week.days.map((d) => BY_DATE[d]).filter(Boolean)
  const avg = weekData.length ? Math.round(weekData.reduce((a, x) => a + x.rate, 0) / weekData.length) : null
  const totalAlerts = weekData.reduce((a, x) => a + alertsFor(x), 0)
  const goalDays = weekData.filter((x) => x.rate >= 70).length

  return (
    <div>
      <ScreenHeader title="자세 리포트" desc="주 단위 기록이에요 — 날짜를 누르면 그날의 리포트로 들어갑니다." />

      {/* 주 이동 내비게이션 */}
      <Card className="rise d1 mb-4 flex items-center justify-between px-4 py-3">
        <Btn size="sm" kind="ghost" disabled={weekIdx === 0} onClick={() => setWeekIdx((i) => i - 1)}>
          <Icon name="chevronRight" size={14} className="rotate-180" />
          지난주
        </Btn>
        <div className="text-center">
          <div className="text-sm font-semibold">{week.label}</div>
          <div className="mt-0.5 font-mono text-[11px] text-dim">{week.range}</div>
        </div>
        <Btn size="sm" kind="ghost" disabled={weekIdx === WEEKS.length - 1} onClick={() => setWeekIdx((i) => i + 1)}>
          다음 주
          <Icon name="chevronRight" size={14} />
        </Btn>
      </Card>

      {/* 요일별 날짜 카드 */}
      <div className="rise d2 mb-1 grid grid-cols-7 gap-2.5">
        {DOW.map((d) => (
          <div key={d} className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
            {d}
          </div>
        ))}
      </div>
      <div className="rise d2 grid grid-cols-7 gap-2.5">
        {week.days.map((d) => (
          <DayCell key={d} date={d} onSelect={setSelected} />
        ))}
      </div>

      {/* 주간 요약 */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="rise d3 flex flex-col gap-2 p-5">
          <MicroLabel>주 평균 유지율</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{avg ?? '—'}</span>
            {avg != null && <span className="text-sm text-mid">%</span>}
          </div>
        </Card>
        <Card className="rise d4 flex flex-col gap-2 p-5">
          <MicroLabel>경고 알림 합계</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{totalAlerts}</span>
            <span className="text-sm text-mid">회</span>
          </div>
        </Card>
        <Card className="rise d5 flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between">
            <MicroLabel>목표(70%) 달성일</MicroLabel>
            <Icon name="flame" size={14} className="text-warn1" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{goalDays}</span>
            <span className="text-sm text-mid">일</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
