import { useApp } from '../state/AppContext'
import { Btn, Card, Icon, PostureFigure, ScreenHeader } from '../components/ui'

const STAGES = [
  {
    level: 1,
    name: '위젯 신호',
    tone: 'text-warn1',
    border: 'border-warn1/30',
    desc: '구석 위젯의 색과 실루엣만 조용히 바뀝니다. 업무 흐름은 끊지 않아요.',
    hint: '트리거 후 우측 하단 위젯을 보세요',
  },
  {
    level: 2,
    name: '토스트 알림',
    tone: 'text-warn2',
    border: 'border-warn2/30',
    desc: '무너진 자세가 이어지면, 작은 토스트가 무엇이 문제인지 알려줘요.',
    hint: '화면 우측 상단에 나타나요',
  },
  {
    level: 3,
    name: '전체 화면 개입',
    tone: 'text-warn3',
    border: 'border-warn3/30',
    desc: '그래도 안 고쳐지면 화면 전체를 덮습니다. 고치기 전엔 일 못 해요.',
    hint: '설정에서 옵트인해야 실제로 동작',
  },
]

function EscalationDiagram() {
  const nodes = [
    { label: '바른 자세', tone: 'text-good', state: 'good' },
    { label: '1단계 · 위젯', tone: 'text-warn1', state: 'warn1', after: '20초 지속' },
    { label: '2단계 · 토스트', tone: 'text-warn2', state: 'warn2', after: '60초 지속' },
    { label: '3단계 · 전체 화면', tone: 'text-warn3', state: 'warn3', after: '120초 지속' },
  ]
  return (
    <Card className="rise d1 mb-4 flex items-center justify-between gap-2 px-8 py-6">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex flex-1 items-center gap-2">
          {i > 0 && (
            <div className="flex flex-1 flex-col items-center gap-1 px-1">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">{n.after}</span>
              <div className="h-px w-full bg-line-strong" />
            </div>
          )}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <PostureFigure state={n.state} className={`h-10 w-10 ${n.tone}`} />
            <span className="whitespace-nowrap text-[11px] text-mid">{n.label}</span>
          </div>
        </div>
      ))}
    </Card>
  )
}

export default function AlertsDemo() {
  const { triggerDemo, settings, setScreen } = useApp()

  return (
    <div>
      <ScreenHeader
        title="알림 단계"
        desc="개입은 3단계로 점점 강해져요. 평상시엔 조용히, 무시할수록 세게."
      />
      <EscalationDiagram />

      <div className="grid grid-cols-3 gap-4">
        {STAGES.map((s, i) => (
          <Card key={s.level} className={`rise d${i + 2} flex flex-col p-6`}>
            <div className={`font-mono text-[10px] uppercase tracking-[0.22em] ${s.tone}`}>Level 0{s.level}</div>
            <h3 className="mt-2 text-lg font-bold">{s.name}</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mid">{s.desc}</p>
            {s.level === 3 && (
              <div
                className={`mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] ${
                  settings.maxAlertLevel >= 3 ? 'bg-good/10 text-good' : 'bg-white/[0.04] text-dim'
                }`}
              >
                <Icon name={settings.maxAlertLevel >= 3 ? 'check' : 'moon'} size={12} />
                {settings.maxAlertLevel >= 3 ? '옵트인 완료 — 실사용에서도 동작' : '현재 꺼짐 (기본값) — 데모는 가능'}
              </div>
            )}
            <Btn kind="outline" className={`mt-4 ${s.border}`} onClick={() => triggerDemo(s.level)}>
              데모 보기
            </Btn>
            <p className="mt-2.5 text-center text-[11px] text-dim">{s.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="rise d5 mt-4 flex items-center gap-3 px-6 py-4">
        <Icon name="moon" size={16} className="shrink-0 text-dim" />
        <p className="flex-1 text-xs leading-relaxed text-mid">
          알림 강도 상한(기본 2단계), 알림음, 조용한 시간대는 설정에서 조절할 수 있어요. 조용한 시간대에는 소리
          없이 위젯으로만 알려요.
        </p>
        <Btn size="sm" kind="ghost" onClick={() => setScreen('settings')}>
          설정으로
          <Icon name="chevronRight" size={13} />
        </Btn>
      </Card>
    </div>
  )
}
