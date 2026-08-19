import { useApp } from '../state/AppContext'
import { DAYS14, HOURLY, WEEK_LAST, WEEK_THIS, WEEKDAYS, REPORT_STATS } from '../data/dummy'
import { Card, Icon, MicroLabel, ScreenHeader } from '../components/ui'
import { ChartCard, TrendChart, WeekCompareChart, HourlyChart, Spark } from '../components/charts'

const VIZ1 = '#2aa274'
const VIZ2 = '#5e87c9'

export default function Report() {
  const { alertCount } = useApp()
  const S = REPORT_STATS

  return (
    <div>
      <ScreenHeader title="자세 리포트" desc="최근 2주의 기록이에요. (프로토타입 — 더미 데이터)" />

      {/* 요약 스탯 */}
      <div className="mb-4 grid grid-cols-4 gap-4">
        <Card className="rise d1 flex flex-col gap-2 p-5">
          <MicroLabel>이번 주 평균 유지율</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{S.weekAvg}</span>
            <span className="text-sm text-mid">%</span>
          </div>
          <div className="text-xs text-good">▲ {S.weekDelta}%p · 지난주 대비</div>
        </Card>
        <Card className="rise d2 flex flex-col gap-2 p-5">
          <MicroLabel>시간당 평균 유지</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{S.avgHold}</span>
            <span className="text-sm text-mid">분</span>
          </div>
          <Spark data={DAYS14.map((d) => d.hold)} />
        </Card>
        <Card className="rise d3 flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between">
            <MicroLabel>연속 목표 달성</MicroLabel>
            <Icon name="flame" size={14} className="text-warn1" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{S.streak}</span>
            <span className="text-sm text-mid">일</span>
          </div>
          <div className="text-xs text-dim">목표: 유지율 {S.goal}% 이상</div>
        </Card>
        <Card className="rise d4 flex flex-col gap-2 p-5">
          <MicroLabel>오늘 알림</MicroLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-semibold leading-none">{alertCount}</span>
            <span className="text-sm text-mid">회</span>
          </div>
          <div className="text-xs text-good">▼ 3회 · 어제보다</div>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <ChartCard
          className="rise d3 col-span-7"
          title="일간 유지율 추이"
          sub="최근 14일 · 바른자세 유지율 %"
          footer={
            <details className="border-t border-line pt-3">
              <summary className="cursor-pointer text-xs text-dim transition-colors hover:text-mid">표로 보기</summary>
              <div className="mt-3 max-h-44 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-dim">
                      <th className="py-1 font-normal">날짜</th>
                      <th className="py-1 font-normal">요일</th>
                      <th className="py-1 text-right font-normal">유지율</th>
                      <th className="py-1 text-right font-normal">시간당 유지</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-mid">
                    {DAYS14.map((d) => (
                      <tr key={d.d} className={`border-t border-line ${d.today ? 'text-hi' : ''}`}>
                        <td className="py-1">{d.d}</td>
                        <td className="py-1">{d.dow}</td>
                        <td className="py-1 text-right">{d.rate}%</td>
                        <td className="py-1 text-right">{d.hold}분</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          }
        >
          <TrendChart data={DAYS14} goal={S.goal} />
        </ChartCard>

        <ChartCard
          className="rise d4 col-span-5"
          title="주간 비교"
          sub="요일별 유지율 · 이번 주는 수요일까지"
          legend={[
            { name: '이번 주', color: VIZ1 },
            { name: '지난주', color: VIZ2 },
          ]}
        >
          <WeekCompareChart thisWeek={WEEK_THIS} lastWeek={WEEK_LAST} weekdays={WEEKDAYS} />
        </ChartCard>

        <ChartCard
          className="rise d5 col-span-7"
          title="시간대별 패턴"
          sub="이번 주 시간대별 평균 유지율"
          footer={
            <p className="border-t border-line pt-3 text-xs leading-relaxed text-mid">
              <Icon name="clock" size={12} className="mr-1 inline text-warn1" />
              점심 직후 <span className="font-mono text-hi">13–14시</span>에 가장 무너져요. 오후 스트레칭 알림을
              활용해 보세요.
            </p>
          }
        >
          <HourlyChart data={HOURLY} />
        </ChartCard>

        <Card className="rise d6 col-span-5 flex flex-col justify-between p-6">
          <div>
            <MicroLabel>캘리브레이션 대비</MicroLabel>
            <p className="mt-3 text-[15px] font-semibold leading-relaxed">
              시작(8/6)보다 시간당 유지시간이
              <br />
              <span className="font-mono text-2xl text-good">+13분</span> 늘었어요
            </p>
            <p className="mt-3 text-xs leading-relaxed text-mid">
              반듯을 쓴 2주간 평균 유지율은 65% → 83%로. 기준 자세 자체도 처음보다 머리 전방 이동이 1.8cm
              줄었어요.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-good/[0.07] px-3.5 py-2.5 text-xs text-good">
            <Icon name="target" size={14} />
            다음 목표 — 유지율 85%를 5일 연속으로
          </div>
        </Card>
      </div>
    </div>
  )
}
