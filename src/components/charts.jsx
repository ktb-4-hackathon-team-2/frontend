import { useRef, useState } from 'react'
import { Card, MicroLabel } from './ui'

// 차트 팔레트 — dataviz validate_palette.js 통과 조합 (surface #121517 기준)
const VIZ1 = '#2aa274' // 이번 주 / 주 계열
const VIZ2 = '#5e87c9' // 지난주 (비교 계열)
const GRID = 'rgba(255,255,255,0.06)'
const BASE = 'rgba(255,255,255,0.16)'
const AXIS_TEXT = '#6b746e'
const INK_HI = '#e9edeb'
const SURFACE = '#121517'

function roundTop(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
}

// 마우스 위치 기반 공용 툴팁
function useTip() {
  const boxRef = useRef(null)
  const [tip, setTip] = useState(null)
  const show = (e, content) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.min(Math.max(e.clientX - rect.left, 56), rect.width - 56)
    setTip({ x, y: e.clientY - rect.top, ...content })
  }
  const hide = () => setTip(null)
  const el = tip && (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-raised px-3 py-2 shadow-xl"
      style={{ left: tip.x, top: tip.y - 14, transform: 'translate(-50%, -100%)' }}
    >
      <div className="mb-1 text-[11px] font-medium text-mid">{tip.title}</div>
      {tip.rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-mid">{r.name}</span>
          <span className="ml-auto pl-3 font-mono font-medium text-hi">{r.value}</span>
        </div>
      ))}
    </div>
  )
  return { boxRef, show, hide, el }
}

export function ChartCard({ title, sub, legend, children, className = '', footer }) {
  return (
    <Card className={`flex flex-col gap-4 p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {sub && <div className="mt-0.5 text-xs text-dim">{sub}</div>}
        </div>
        {legend && (
          <div className="flex items-center gap-3">
            {legend.map((l) => (
              <span key={l.name} className="flex items-center gap-1.5 text-xs text-mid">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
      {footer}
    </Card>
  )
}

// ── 14일 유지율 추이 (컬럼) ──────────────────────────────────────────
export function TrendChart({ data, goal }) {
  const { boxRef, show, hide, el } = useTip()
  const W = 660
  const H = 224
  const padL = 34
  const padR = 10
  const padT = 18
  const padB = 26
  const iw = W - padL - padR
  const ih = H - padT - padB
  const yFor = (v) => padT + (1 - v / 100) * ih
  const slot = iw / data.length
  const bw = Math.min(22, slot * 0.55)

  return (
    <div ref={boxRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yFor(v)} y2={yFor(v)} stroke={v === 0 ? BASE : GRID} strokeWidth="1" />
            <text x={padL - 8} y={yFor(v) + 3} textAnchor="end" fontSize="9.5" fill={AXIS_TEXT} fontFamily="IBM Plex Mono, monospace">
              {v}
            </text>
          </g>
        ))}
        {/* 목표 기준선 — 그리드가 아닌 데이터 주석 */}
        {goal && (
          <g>
            <line x1={padL} x2={W - padR} y1={yFor(goal)} y2={yFor(goal)} stroke={VIZ1} strokeWidth="1" strokeDasharray="4 5" opacity="0.5" />
            <text x={W - padR} y={yFor(goal) - 5} textAnchor="end" fontSize="9.5" fill={AXIS_TEXT} fontFamily="IBM Plex Mono, monospace">
              목표 {goal}%
            </text>
          </g>
        )}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2
          const y = yFor(d.rate)
          return (
            <g key={d.d}>
              <path d={roundTop(cx - bw / 2, y, bw, yFor(0) - y, 4)} fill={VIZ1} opacity={d.today ? 1 : 0.45} />
              {d.today && (
                <text x={cx} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill={INK_HI} fontFamily="IBM Plex Mono, monospace">
                  {d.rate}%
                </text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="9" fill={d.today ? INK_HI : AXIS_TEXT} fontFamily="IBM Plex Mono, monospace">
                {d.d}
              </text>
              <rect
                x={padL + slot * i}
                y={padT}
                width={slot}
                height={ih}
                fill="transparent"
                onMouseMove={(e) =>
                  show(e, {
                    title: `${d.d} (${d.dow})`,
                    rows: [
                      { name: '유지율', value: `${d.rate}%`, color: VIZ1 },
                      { name: '시간당 유지', value: `${d.hold}분` },
                    ],
                  })
                }
                onMouseLeave={hide}
              />
            </g>
          )
        })}
      </svg>
      {el}
    </div>
  )
}

// ── 주간 비교 (이번 주 vs 지난주 라인) ────────────────────────────────
export function WeekCompareChart({ thisWeek, lastWeek, weekdays }) {
  const { boxRef, show, hide, el } = useTip()
  const W = 420
  const H = 224
  const padL = 34
  const padR = 46
  const padT = 18
  const padB = 26
  const iw = W - padL - padR
  const ih = H - padT - padB
  const lo = 40
  const yFor = (v) => padT + (1 - (v - lo) / (100 - lo)) * ih
  const xFor = (i) => padL + (iw / 6) * i
  const linePath = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(v)}`).join(' ')

  return (
    <div ref={boxRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[40, 70, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yFor(v)} y2={yFor(v)} stroke={v === lo ? BASE : GRID} strokeWidth="1" />
            <text x={padL - 8} y={yFor(v) + 3} textAnchor="end" fontSize="9.5" fill={AXIS_TEXT} fontFamily="IBM Plex Mono, monospace">
              {v}
            </text>
          </g>
        ))}
        {weekdays.map((d, i) => (
          <text key={d} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill={AXIS_TEXT} fontFamily="IBM Plex Mono, monospace">
            {d}
          </text>
        ))}
        <path d={linePath(lastWeek.days)} fill="none" stroke={VIZ2} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {lastWeek.days.map((v, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(v)} r="4" fill={VIZ2} stroke={SURFACE} strokeWidth="2" />
        ))}
        <path d={linePath(thisWeek.days)} fill="none" stroke={VIZ1} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {thisWeek.days.map((v, i) => {
          const last = i === thisWeek.days.length - 1
          return <circle key={i} cx={xFor(i)} cy={yFor(v)} r={last ? 5 : 4} fill={VIZ1} stroke={SURFACE} strokeWidth="2" />
        })}
        {/* 엔드 라벨 — 텍스트는 잉크 토큰, 정체성은 옆의 마크가 */}
        <text
          x={xFor(thisWeek.days.length - 1) + 10}
          y={yFor(thisWeek.days[thisWeek.days.length - 1]) + 3}
          fontSize="10.5"
          fontWeight="600"
          fill={INK_HI}
          fontFamily="IBM Plex Mono, monospace"
        >
          {thisWeek.days[thisWeek.days.length - 1]}%
        </text>
        <text x={xFor(6) + 10} y={yFor(lastWeek.days[6]) + 3} fontSize="10.5" fill={AXIS_TEXT} fontFamily="IBM Plex Mono, monospace">
          {lastWeek.days[6]}%
        </text>
        {weekdays.map((d, i) => (
          <rect
            key={d}
            x={xFor(i) - iw / 12}
            y={padT}
            width={iw / 6}
            height={ih}
            fill="transparent"
            onMouseMove={(e) =>
              show(e, {
                title: `${d}요일`,
                rows: [
                  ...(thisWeek.days[i] != null ? [{ name: '이번 주', value: `${thisWeek.days[i]}%`, color: VIZ1 }] : []),
                  { name: '지난주', value: `${lastWeek.days[i]}%`, color: VIZ2 },
                ],
              })
            }
            onMouseLeave={hide}
          />
        ))}
      </svg>
      {el}
    </div>
  )
}

// ── 시간대별 패턴 (오늘 vs 어제 비교 2중 컬럼 & 클릭 드릴다운) ────────────
export function HourlyChart({ data = [], yesterdayData = [], onSelectHour, selectedHour = null }) {
  const { boxRef, show, hide, el } = useTip()
  const W = 660
  const H = 200
  const padL = 34
  const padR = 10
  const padT = 22
  const padB = 26
  const iw = W - padL - padR
  const ih = H - padT - padB
  const yFor = (v) => padT + (1 - v / 100) * ih
  const slot = iw / (data.length || 1)
  const hasYesterday = yesterdayData && yesterdayData.length > 0

  // 어제 데이터를 시간(hour 또는 h)으로 빠른 매핑
  const yMap = new Map()
  if (hasYesterday) {
    yesterdayData.forEach((yd) => {
      const key = yd.hour != null ? yd.hour : yd.h
      yMap.set(key, yd)
    })
  }

  // 2중 막대 폭 계산
  const groupBw = Math.min(26, slot * 0.6)
  const singleBw = hasYesterday ? Math.max(7, (groupBw - 3) / 2) : Math.min(22, slot * 0.5)

  return (
    <div ref={boxRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yFor(v)} y2={yFor(v)} stroke={v === 0 ? BASE : GRID} strokeWidth="1" />
            <text x={padL - 8} y={yFor(v) + 3} textAnchor="end" fontSize="9.5" fill={AXIS_TEXT} fontFamily="IBM Plex Mono, monospace">
              {v}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2
          const yToday = yFor(d.rate)
          const yHour = d.hour != null ? d.hour : d.h
          const yData = yMap.get(yHour)
          const yYesterday = yData ? yFor(yData.rate) : null

          const isSelected = selectedHour != null && (selectedHour === d.hour || selectedHour === d.h)
          const delta = yData ? d.rate - yData.rate : null

          // 어제 막대 x좌표, 오늘 막대 x좌표
          const xYesterday = cx - groupBw / 2
          const xToday = hasYesterday ? cx - groupBw / 2 + singleBw + 3 : cx - singleBw / 2

          return (
            <g
              key={d.h || i}
              className="cursor-pointer transition-opacity"
              onClick={() => onSelectHour && onSelectHour(isSelected ? null : (d.hour != null ? d.hour : d.h))}
            >
              {/* 선택된 시간대 배경 하이라이트 */}
              {isSelected && (
                <rect
                  x={cx - slot / 2 + 2}
                  y={padT - 4}
                  width={slot - 4}
                  height={ih + 6}
                  fill="rgba(42, 162, 116, 0.12)"
                  stroke="rgba(42, 162, 116, 0.4)"
                  strokeWidth="1"
                  rx="6"
                />
              )}

              {/* 어제 막대 (VIZ2 블루) */}
              {hasYesterday && yYesterday != null && (
                <path
                  d={roundTop(xYesterday, yYesterday, singleBw, yFor(0) - yYesterday, 3)}
                  fill={VIZ2}
                  opacity={isSelected ? 0.9 : 0.45}
                />
              )}

              {/* 오늘 막대 (VIZ1 제이드 그린) */}
              <path
                d={roundTop(xToday, yToday, singleBw, yFor(0) - yToday, 3)}
                fill={VIZ1}
                opacity={isSelected ? 1 : 0.85}
              />

              {/* 오늘 수치 라벨 */}
              {isSelected && (
                <text
                  x={hasYesterday ? xToday + singleBw / 2 : cx}
                  y={yToday - 7}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill={INK_HI}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {d.rate}%
                </text>
              )}

              {/* x축 시간 라벨 */}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize="9"
                fontWeight={isSelected ? '600' : '400'}
                fill={isSelected ? INK_HI : AXIS_TEXT}
                fontFamily="IBM Plex Mono, monospace"
              >
                {d.h}
              </text>

              {/* 마우스 호버 및 클릭 인터랙션 영역 */}
              <rect
                x={padL + slot * i}
                y={padT}
                width={slot}
                height={ih}
                fill="transparent"
                onMouseMove={(e) => {
                  const mins = Math.round(
                    d.monitoredMin != null ? d.monitoredMin : d.minuteCount != null ? d.minuteCount : d.hold || 0,
                  )
                  const rows = [{ name: '오늘 유지율', value: `${d.rate}%`, color: VIZ1 }]
                  if (mins > 0) {
                    rows.push({ name: '측정 데이터', value: `${mins}분치` })
                  }
                  if (yData) {
                    rows.push({ name: '어제 유지율', value: `${yData.rate}%`, color: VIZ2 })
                    rows.push({
                      name: '전일 대비',
                      value: delta > 0 ? `+${delta}%p (개선)` : delta < 0 ? `${delta}%p (저하)` : '동일',
                    })
                  }
                  show(e, {
                    title: mins > 0 ? `${d.h} (${mins}분 측정 · 클릭 시 원인 분석)` : `${d.h} (클릭 시 원인 분석)`,
                    rows,
                  })
                }}
                onMouseLeave={hide}
              />
            </g>
          )
        })}
      </svg>
      {el}
    </div>
  )
}

// ── 스파크라인 (스탯 타일 보조) ──────────────────────────────────────
export function Spark({ data, width = 110, height = 30 }) {
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const xFor = (i) => 2 + (i / (data.length - 1)) * (width - 4)
  const yFor = (v) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (height - 6)
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(v)}`).join(' ')
  const lastX = xFor(data.length - 1)
  const lastY = yFor(data[data.length - 1])
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <path d={path} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d={data.slice(-2).map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(data.length - 2 + i)},${yFor(v)}`).join(' ')}
        fill="none"
        stroke={VIZ1}
        strokeWidth="1.5"
      />
      <circle cx={lastX} cy={lastY} r="3" fill={VIZ1} stroke={SURFACE} strokeWidth="1.5" />
    </svg>
  )
}
