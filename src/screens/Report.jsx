import { useEffect, useState } from 'react'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader, TONE } from '../components/ui'
import { ChartCard, HourlyChart } from '../components/charts'
import { api, getAccessToken } from '../lib/api'
import { useApp } from '../state/AppContext'

// 오늘 날짜 계산 (예: '8/19')
const now = new Date()
const TODAY = `${now.getMonth() + 1}/${now.getDate()}`
const DOW = ['월', '화', '수', '목', '금', '토', '일']

// 이번 주 월요일 ~ 일요일 계산
function getCurrentWeekDays() {
  const curr = new Date()
  const first = curr.getDate() - (curr.getDay() === 0 ? 6 : curr.getDay() - 1)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(curr.setDate(first + i))
    days.push(`${d.getMonth() + 1}/${d.getDate()}`)
  }
  return days
}

const THIS_WEEK_DAYS = getCurrentWeekDays()
const WEEKS = [
  { label: '이번 주', range: `${THIS_WEEK_DAYS[0]} – ${THIS_WEEK_DAYS[6]}`, days: THIS_WEEK_DAYS },
]

const dateNum = (s) => {
  if (!s) return 0
  const [m, d] = s.split('/').map(Number)
  return m * 100 + d
}
const isFuture = (d) => dateNum(d) > dateNum(TODAY)

const rateTone = (v) => (v >= 80 ? TONE.good : v >= 65 ? TONE.warn1 : TONE.warn2)

function DayCell({ date, data, onSelect }) {
  const future = isFuture(date)
  const today = date === TODAY
  const dayNumber = date.split('/')[1]
  const hasData = Boolean(data && data.hasData && data.rate != null)
  const tone = hasData ? rateTone(data.rate) : null

  return (
    <button
      disabled={!hasData}
      onClick={() => onSelect(date)}
      className={`flex min-h-[132px] flex-col rounded-xl border p-3 text-left transition-all duration-150 ${
        hasData ? 'cursor-pointer' : 'cursor-default opacity-40'
      } ${
        today
          ? 'border-good/50 bg-good/[0.07]'
          : hasData
            ? 'border-line bg-surface hover:border-line-strong hover:bg-white/[0.03]'
            : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-lg font-semibold">{dayNumber}</span>
        {today && <span className="rounded bg-good/15 px-1.5 py-0.5 text-[10px] font-medium text-good">오늘</span>}
      </div>
      {hasData ? (
        <>
          <div className="mt-auto flex items-baseline gap-0.5">
            <span className="font-mono text-xl font-semibold leading-none">{data.rate}</span>
            <span className="text-xs text-mid">%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className={`h-full rounded-full ${tone?.bg ?? 'bg-good'}`} style={{ width: `${data.rate}%` }} />
          </div>
          <span className="mt-1.5 text-[11px] text-dim">알림 {data.alertCount ?? 0}회</span>
        </>
      ) : (
        <span className="mt-auto text-[11px] text-dim">{future ? '—' : '기록 없음'}</span>
      )}
    </button>
  )
}

function DayReport({ date, dayData, onBack }) {
  const { requestStretch } = useApp()
  const [dailyDetail, setDailyDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchDailyDetail = () => {
    if (!getAccessToken()) {
      setLoading(false)
      return
    }
    const [m, d] = date.split('/')
    const year = new Date().getFullYear()
    const formattedDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

    api.getDailyReport(formattedDate)
      .then((res) => {
        setDailyDetail(res)
      })
      .catch((e) => console.warn('일일 리포트 상세 조회 실패:', e))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDailyDetail()
  }, [date])

  // AI 분석 요청 버튼 핸들러
  const handleRequestAiAnalysis = async () => {
    setAnalyzing(true)
    try {
      const [m, d] = date.split('/')
      const year = new Date().getFullYear()
      const formattedDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

      const res = await api.analyzeDailyReport(formattedDate)
      setDailyDetail(res)
    } catch (err) {
      alert(err.message || 'AI 분석 요청에 실패했습니다. AI 서버가 켜져 있는지 확인해 주세요.')
    } finally {
      setAnalyzing(false)
    }
  }

  const hasData = Boolean(dailyDetail?.hasData || (dayData && dayData.hasData))
  const rate = dailyDetail?.rate ?? dayData?.rate ?? 0
  const alerts = dailyDetail?.totalAlerts ?? dayData?.alertCount ?? 0
  
  // 모니터링 시간 계산 (분 단위)
  const totalMin = dailyDetail?.totalMonitoredMin ?? dayData?.totalMin ?? 0
  const monitoredHours = Math.floor(totalMin / 60)
  const monitoredMins = Math.round(totalMin % 60)
  const monitoredStr = monitoredHours > 0 ? `${monitoredHours}시간 ${monitoredMins}분` : `${monitoredMins}분`
  const holdMin = dailyDetail?.avgHoldMin ?? dayData?.hold ?? Math.round(rate * 0.6)
  const tone = rateTone(rate)

  // 시간대별 실측 통계
  const hourlyList = dailyDetail?.hourlyStats && dailyDetail.hourlyStats.length > 0 ? dailyDetail.hourlyStats : []
  const issueStats = dailyDetail?.issueStats || []
  const aiComment = dailyDetail?.llmSummary || dailyDetail?.llmCommentary
  const highlights = dailyDetail?.llmHighlights || []
  const adviceList = dailyDetail?.llmAdvice || []
  const grade = dailyDetail?.grade

  return (
    <div>
      <div className="rise mb-6 flex items-end justify-between gap-4">
        <div>
          <button onClick={onBack} className="flex cursor-pointer items-center gap-1 text-xs text-dim transition-colors hover:text-mid">
            <Icon name="chevronRight" size={12} className="rotate-180" />
            주간 리포트로
          </button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {date} ({dayData?.dow ?? '오늘'}) 상세 리포트
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {grade && (
            <Chip tone={grade === 'EXCELLENT' ? 'good' : grade === 'GOOD' ? 'good' : 'warn1'}>
              등급: {grade}
            </Chip>
          )}
          {hasData ? (
            <Chip tone={tone === TONE.good ? 'good' : tone === TONE.warn1 ? 'warn1' : 'warn2'}>
              유지율 {rate}%
            </Chip>
          ) : (
            <Chip tone="dim">기록 없음</Chip>
          )}
        </div>
      </div>

      {!hasData && !loading ? (
        <Card className="rise p-12 text-center">
          <Icon name="clock" size={32} className="mx-auto text-dim mb-3" />
          <p className="text-sm text-mid">이 날짜에는 측정된 모니터링 기록이 없어요.</p>
          <p className="mt-1 text-xs text-dim">모니터링 화면에서 자세를 측정해 보세요.</p>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-4">
            <Card className="rise d1 flex flex-col gap-2 p-5">
              <MicroLabel>자세 유지율</MicroLabel>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[28px] font-semibold leading-none">{hasData ? rate : '—'}</span>
                {hasData && <span className="text-sm text-mid">%</span>}
              </div>
            </Card>
            <Card className="rise d2 flex flex-col gap-2 p-5">
              <MicroLabel>경고 알림</MicroLabel>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[28px] font-semibold leading-none">{hasData ? alerts : '—'}</span>
                {hasData && <span className="text-sm text-mid">회</span>}
              </div>
            </Card>
            <Card className="rise d3 flex flex-col gap-2 p-5">
              <MicroLabel>시간당 평균 유지</MicroLabel>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[28px] font-semibold leading-none">{hasData ? holdMin : '—'}</span>
                {hasData && <span className="text-sm text-mid">분</span>}
              </div>
            </Card>
            <Card className="rise d4 flex flex-col gap-2 p-5">
              <MicroLabel>모니터링 시간</MicroLabel>
              <div className="font-mono text-[28px] font-semibold leading-none">{hasData ? monitoredStr : '—'}</div>
            </Card>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {/* 시간대별 유지율 차트 (좌측 7컬럼) */}
            <div className="col-span-12 lg:col-span-7">
              <ChartCard className="rise d4 h-full" title="시간대별 유지율" sub={`${date} · 실측 시간대별 유지율`}>
                {hourlyList.length > 0 ? (
                  <HourlyChart data={hourlyList} />
                ) : (
                  <div className="py-12 text-center text-xs text-dim">
                    해당 일자에는 시간대별 측정 데이터가 없습니다.
                  </div>
                )}
              </ChartCard>
            </div>

            {/* 🚨 경고 알림 원인 분석 카드 (우측 5컬럼) */}
            <div className="col-span-12 lg:col-span-5">
              <Card className="rise d4 h-full p-6 flex flex-col">
                <div className="flex items-center justify-between">
                  <MicroLabel>경고 알림 원인 분석</MicroLabel>
                  <Icon name="bell" size={14} className="text-warn1" />
                </div>
                
                {issueStats.length > 0 ? (
                  <div className="mt-4 space-y-3.5 flex-1">
                    <p className="text-xs text-dim">
                      오늘 주로 감지된 나쁜 자세 유형과 교정 스트레칭입니다.
                    </p>
                    {issueStats.map((item, idx) => (
                      <div key={item.code} className="rounded-xl border border-line bg-surface/50 p-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-hi flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-warn1/20 text-[10px] font-mono text-warn1">
                              {idx + 1}
                            </span>
                            {item.label}
                          </span>
                          <span className="font-mono text-dim font-medium">
                            {item.count}회 ({item.ratio}%)
                          </span>
                        </div>
                        {/* 프로그레스 바 */}
                        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden mb-2">
                          <div className="h-full bg-warn1 rounded-full" style={{ width: `${item.ratio}%` }} />
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-line/60">
                          <span className="text-[11px] text-dim">{item.recommendedStretch}</span>
                          {item.stretchId && requestStretch && (
                            <button
                              onClick={() => requestStretch(item.stretchId)}
                              className="cursor-pointer text-[11px] font-medium text-good hover:underline flex items-center gap-0.5"
                            >
                              스트레칭 시작
                              <Icon name="chevronRight" size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="my-auto py-10 text-center text-xs text-dim">
                    <Icon name="target" size={24} className="mx-auto text-good/40 mb-2" />
                    <p className="text-hi font-medium">특이 경고 없음</p>
                    <p className="mt-1">바른 자세를 모범적으로 잘 유지하셨습니다!</p>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* AI 분석 코멘트 카드 */}
          <Card className="rise d5 mt-4 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MicroLabel>AI 분석 코멘트</MicroLabel>
                {aiComment && (
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-good">
                    <span className="h-1.5 w-1.5 rounded-full bg-good" />
                    분석 완료
                  </span>
                )}
              </div>

              {/* AI 분석 요청 / 재생성 버튼 */}
              <Btn 
                size="sm" 
                kind={aiComment ? "outline" : "primary"}
                disabled={analyzing || !hasData}
                onClick={handleRequestAiAnalysis}
              >
                {analyzing ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    AI 분석 요청 중...
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" size={13} />
                    {aiComment ? 'AI 분석 재생성' : 'AI 분석 리포트 생성'}
                  </>
                )}
              </Btn>
            </div>

            {aiComment ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-relaxed text-mid whitespace-pre-line bg-surface/40 p-4 rounded-xl border border-line">
                  {aiComment}
                </p>

                {/* 하이라이트 요약 배지 */}
                {highlights.length > 0 && (
                  <div>
                    <div className="text-[11px] font-mono text-dim uppercase tracking-wider mb-2">Highlights</div>
                    <div className="flex flex-wrap gap-2">
                      {highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-line px-3 py-1.5 text-xs text-mid">
                          <span className="text-good">✓</span> {h}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI 개선 조언 */}
                {adviceList.length > 0 && (
                  <div>
                    <div className="text-[11px] font-mono text-dim uppercase tracking-wider mb-2">Advice</div>
                    <div className="space-y-1.5">
                      {adviceList.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-dim">
                          <span className="text-warn1 mt-0.5">•</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs leading-relaxed text-dim">
                  상단의 <strong>[AI 분석 리포트 생성]</strong> 버튼을 누르면 AI가 오늘의 자세 측정 데이터를 정밀 분석하여 맞춤 피드백과 조언을 제공합니다.
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default function Report() {
  const [weekIdx, setWeekIdx] = useState(WEEKS.length - 1)
  const [selected, setSelected] = useState(null)
  const [dbDaysMap, setDbDaysMap] = useState({})

  // 백엔드 대시보드 데이터 조회
  useEffect(() => {
    if (!getAccessToken()) return
    api.getReportDashboard()
      .then((data) => {
        if (data && data.days14 && data.days14.length > 0) {
          const map = {}
          data.days14.forEach((item) => {
            map[item.d] = item
          })
          setDbDaysMap(map)
        }
      })
      .catch((err) => {
        console.warn('대시보드 리포트 조회 실패:', err)
      })
  }, [])

  if (selected) {
    return (
      <DayReport 
        date={selected} 
        dayData={dbDaysMap[selected]} 
        onBack={() => setSelected(null)} 
      />
    )
  }

  const week = WEEKS[weekIdx]
  const weekData = week.days.map((d) => dbDaysMap[d]).filter(Boolean)
  const validData = weekData.filter((x) => x && x.hasData && x.rate != null)
  
  const avg = validData.length ? Math.round(validData.reduce((a, x) => a + x.rate, 0) / validData.length) : null
  const totalAlerts = validData.reduce((a, x) => a + (x.alertCount ?? 0), 0)
  const goalDays = validData.filter((x) => x.rate >= 70).length

  return (
    <div>
      <ScreenHeader title="자세 리포트" desc="주 단위 실측 기록이에요 — 날짜를 누르면 그날의 상세 리포트로 들어갑니다." />

      {/* 주간 날짜 카드 */}
      <Card className="rise d1 mb-4 flex items-center justify-between px-4 py-3">
        <div className="font-semibold text-sm">{week.label} ({week.range})</div>
        <div className="font-mono text-xs text-dim">실측 데이터 모드</div>
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
          <DayCell key={d} date={d} data={dbDaysMap[d]} onSelect={setSelected} />
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
            <span className="font-mono text-[28px] font-semibold leading-none">{validData.length > 0 ? totalAlerts : '—'}</span>
            {validData.length > 0 && <span className="text-sm text-mid">회</span>}
          </div>
        </Card>
        <Card className="rise d5 flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between">
            <MicroLabel>목표(70%) 달성일</MicroLabel>
            <Icon name="flame" size={14} className="text-warn1" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{validData.length > 0 ? goalDays : '—'}</span>
            {validData.length > 0 && <span className="text-sm text-mid">일</span>}
          </div>
        </Card>
      </div>
    </div>
  )
}
