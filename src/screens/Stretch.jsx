import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { STRETCHES, REGION_LABEL, weakestRegion } from '../data/dummy'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader } from '../components/ui'
import { fmtClock } from '../lib/format'
import { playChime } from '../lib/sound'

function TimerRing({ remaining, total }) {
  const R = 56
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90">
        <circle cx="68" cy="68" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="68"
          cy="68"
          r={R}
          fill="none"
          stroke="#3ec98f"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - remaining / total)}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold">{remaining}</span>
        <MicroLabel>Sec</MicroLabel>
      </div>
    </div>
  )
}

function ActiveSession({ stretch, onExit }) {
  const [remaining, setRemaining] = useState(stretch.dur)
  const [rep, setRep] = useState(1)
  const [running, setRunning] = useState(true)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          playChime('wood')
          setRep((cur) => {
            if (cur >= stretch.reps) {
              doneRef.current = true
              setRunning(false)
              return cur
            }
            return cur + 1
          })
          return stretch.dur
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, stretch])

  const done = doneRef.current && !running

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="rise col-span-7 flex flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <MicroLabel>진행 중</MicroLabel>
            <h2 className="mt-1 text-xl font-bold">{stretch.name}</h2>
          </div>
          <Chip tone="good">{stretch.tag}</Chip>
        </div>

        {/* 교본 일러스트 자리 */}
        <div className="flex aspect-[16/8] items-center justify-center rounded-xl border border-dashed border-line-strong bg-raised/60">
          <div className="flex flex-col items-center gap-2 text-center">
            <Icon name="person" size={30} className="text-dim" />
            <MicroLabel>교본 일러스트 · 영상 자리</MicroLabel>
          </div>
        </div>

        <ol className="mt-5 flex flex-col gap-2.5">
          {stretch.steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-sm text-mid">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[10px] text-hi">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        <div className="mt-6 flex items-center gap-6 border-t border-line pt-6">
          <TimerRing remaining={remaining} total={stretch.dur} />
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <MicroLabel>Set</MicroLabel>
              <div className="flex gap-1.5">
                {Array.from({ length: stretch.reps }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-6 rounded-full ${i < rep - (done ? 0 : 1) || done ? 'bg-good' : i === rep - 1 && !done ? 'bg-good/40' : 'bg-white/[0.08]'}`}
                  />
                ))}
              </div>
              <span className="font-mono text-xs text-mid">
                {done ? stretch.reps : rep}/{stretch.reps}
              </span>
            </div>
            {done ? (
              <div className="flex items-center gap-2 text-sm text-good">
                <Icon name="check" size={16} />
                수고했어요! 다음 제안은 50분 뒤에요.
              </div>
            ) : (
              <div className="flex gap-2">
                <Btn size="sm" kind="outline" onClick={() => setRunning(!running)}>
                  <Icon name={running ? 'pause' : 'play'} size={13} />
                  {running ? '일시정지' : '계속'}
                </Btn>
                <Btn
                  size="sm"
                  kind="ghost"
                  onClick={() => {
                    setRemaining(stretch.dur)
                    setRep((r) => Math.min(r + 1, stretch.reps))
                  }}
                >
                  다음 세트
                </Btn>
              </div>
            )}
            <Btn size="sm" kind="ghost" className="self-start" onClick={onExit}>
              <Icon name="x" size={13} />
              종료
            </Btn>
          </div>
        </div>
      </Card>

      {/* 카메라 비교 영역 — 자리만 */}
      <Card className="rise d2 col-span-5 flex flex-col p-5">
        <MicroLabel>실시간 자세 비교</MicroLabel>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-raised/40 p-6 text-center">
          <Icon name="camera" size={26} className="text-dim" />
          <p className="max-w-[240px] text-xs leading-relaxed text-dim">
            카메라로 내 동작과 교본을 나란히 비교하고, 각도가 맞으면 세트를 자동으로 세는 영역이에요.
          </p>
          <MicroLabel>판정 로직 연결 예정</MicroLabel>
        </div>
      </Card>
    </div>
  )
}

export default function Stretch() {
  const { posture, stretchLeft, startStretchNow } = useApp()
  const [activeId, setActiveId] = useState(null)
  const weak = weakestRegion(posture)
  const active = STRETCHES.find((s) => s.id === activeId)

  if (active) return <ActiveSession stretch={active} onExit={() => setActiveId(null)} />

  return (
    <div>
      <ScreenHeader
        title="스트레칭"
        desc="50분마다 제안해요. 지금 무너진 부위에 맞는 동작부터."
        right={
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <Icon name="clock" size={15} className="text-dim" />
            <span className="text-xs text-mid">다음 제안까지</span>
            <span className="font-mono text-sm font-semibold">{fmtClock(stretchLeft)}</span>
          </Card>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        {STRETCHES.map((s, i) => {
          const recommended = s.region === weak
          return (
            <Card
              key={s.id}
              className={`rise d${i + 1} flex flex-col p-6 ${recommended ? 'border-good/30 bg-good/[0.04]' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{s.name}</h3>
                    {recommended && <Chip tone="good">지금 추천</Chip>}
                  </div>
                  <div className="mt-1 text-xs text-dim">
                    {REGION_LABEL[s.region]} · {s.tag}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-mid">
                  {s.dur}초 × {s.reps}
                </span>
              </div>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-mid">{s.steps[0]} …</p>
              {recommended && (
                <p className="mt-2 text-xs text-good">
                  현재 {REGION_LABEL[weak]} 점수가 가장 낮아요 — 이 동작부터 해볼까요?
                </p>
              )}
              <Btn kind={recommended ? 'primary' : 'outline'} className="mt-4 self-start" onClick={() => setActiveId(s.id)}>
                <Icon name="play" size={14} />
                시작하기
              </Btn>
            </Card>
          )
        })}
      </div>

      <Card className="rise d5 mt-4 flex items-center gap-3 px-6 py-4">
        <Icon name="clock" size={16} className="shrink-0 text-dim" />
        <p className="flex-1 text-xs leading-relaxed text-mid">
          다음 제안을 기다리지 않아도 돼요. 타이머를 리셋하고 바로 시작할 수 있어요.
        </p>
        <Btn size="sm" kind="ghost" onClick={startStretchNow}>
          타이머 리셋하고 지금 하기
        </Btn>
      </Card>
    </div>
  )
}
