import { useApp } from '../state/AppContext'
import { ENV_CHECKS } from '../data/dummy'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader } from '../components/ui'

// 캘리브레이션 프레임에서 진단한 책상 셋업 — 측면 모식도
function DeskDiagram() {
  return (
    <svg viewBox="0 0 560 210" className="w-full">
      {/* 바닥 */}
      <line x1="30" y1="190" x2="530" y2="190" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />

      {/* 의자 */}
      <g stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M92 128 L150 128" />
        <path d="M94 128 L90 78" />
        <path d="M120 128 L120 168 M104 190 L136 190 M120 168 L120 190" />
      </g>

      {/* 사람 — 평소 자세(살짝 앞으로) */}
      <g fill="none" stroke="#3ec98f" strokeWidth="5" strokeLinecap="round">
        <path d="M140 128 L190 128 L190 189" opacity="0.45" />
        <path d="M140 128 C142 106 156 90 167 80" />
      </g>
      <circle cx="174" cy="68" r="10.5" fill="#3ec98f" />

      {/* 책상 + 모니터 */}
      <g stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M230 120 L480 120" />
        <path d="M242 120 L242 189 M468 120 L468 189" />
        <path d="M400 107 L400 120 M386 120 L414 120" />
      </g>
      <rect x="396" y="55" width="7" height="52" rx="2" fill="rgba(255,255,255,0.3)" />

      {/* 시선 — 수평 기준선 vs 실제 시선 */}
      <line x1="186" y1="68" x2="396" y2="68" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 5" />
      <line x1="186" y1="68" x2="396" y2="86" stroke="#e6b345" strokeWidth="1.2" strokeDasharray="5 4" />
      <text x="300" y="60" textAnchor="middle" fontSize="10" fill="#e6b345" fontFamily="IBM Plex Mono, monospace">
        시선 −8°
      </text>

      {/* 화면 거리 */}
      <g stroke="#e6b345" strokeWidth="1.2">
        <line x1="192" y1="168" x2="394" y2="168" />
        <path d="M198 164 L192 168 L198 172" fill="none" />
        <path d="M388 164 L394 168 L388 172" fill="none" />
      </g>
      <text x="293" y="161" textAnchor="middle" fontSize="10" fill="#e6b345" fontFamily="IBM Plex Mono, monospace">
        48cm · 권장 60–70cm
      </text>

      {/* 모니터 높이 */}
      <g stroke="#e6b345" strokeWidth="1.2">
        <line x1="430" y1="55" x2="430" y2="68" />
        <path d="M426 61 L430 55 L434 61" fill="none" />
      </g>
      <text x="438" y="65" fontSize="10" fill="#e6b345" fontFamily="IBM Plex Mono, monospace">
        +15cm
      </text>
    </svg>
  )
}

export default function Environment() {
  const { setCalibrated, calibration } = useApp()
  const needFix = ENV_CHECKS.filter((c) => !c.ok).length

  return (
    <div>
      <ScreenHeader
        title="환경 가이드"
        desc="캘리브레이션 프레임을 분석해 작업 환경을 진단했어요. (프로토타입 — 더미 진단)"
        right={
          <Btn kind="outline" size="sm" onClick={() => setCalibrated(false)}>
            <Icon name="refresh" size={13} />
            다시 진단하기
          </Btn>
        }
      />

      <Card className="rise d1 mb-4 p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MicroLabel>측면 모식도</MicroLabel>
            <Chip tone={needFix > 0 ? 'warn1' : 'good'}>
              {needFix > 0 ? `${ENV_CHECKS.length}개 중 ${needFix}개 조정 필요` : '모두 적정'}
            </Chip>
          </div>
          <span className="text-[11px] text-dim">{calibration?.at || '2026.8.19'} 캘리브레이션 기준</span>
        </div>
        <DeskDiagram />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {ENV_CHECKS.map((c, i) => (
          <Card key={c.id} className={`rise d${i + 2} flex flex-col p-6 ${c.ok ? '' : 'border-warn1/25'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">{c.name}</h3>
                <div className="mt-1 font-mono text-xs text-mid">{c.value}</div>
              </div>
              <Chip tone={c.ok ? 'good' : 'warn1'}>{c.ok ? '적정' : '조정 필요'}</Chip>
            </div>
            <p className="mt-3 flex-1 text-[13px] leading-relaxed text-mid">{c.finding}</p>
            <div
              className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 text-xs leading-relaxed ${
                c.ok ? 'bg-white/[0.03] text-dim' : 'bg-warn1/[0.07] text-mid'
              }`}
            >
              <Icon name={c.ok ? 'check' : 'arrowRight'} size={13} className={`mt-0.5 shrink-0 ${c.ok ? 'text-good' : 'text-warn1'}`} />
              {c.fix}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
