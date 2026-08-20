import { useMemo } from 'react'
import { useApp } from '../state/AppContext'
import { analyzeEnvironment } from '../lib/environmentDetector'
import { Btn, Card, Chip, Icon, MicroLabel, ScreenHeader } from '../components/ui'

// 캘리브레이션 측정값 기반 실시간 동적 측면 모식도
function DynamicDeskDiagram({ data }) {
  const headX = 174 + (data?.headXOffset || 0)
  const gazeAngle = data?.gazeAngle ?? -6
  // 시선 점선 y 좌표 (음수 각도일수록 화면 아래쪽으로 내려감)
  const gazeTargetY = Math.min(108, Math.max(55, 68 - gazeAngle * 1.8))

  const isDistOk = data?.distanceStatus === 'ok'
  const distColor = isDistOk ? '#3ec98f' : '#e6b345'
  const distCm = data?.distanceCm || 65

  const isGazeOk = data?.gazeStatus === 'ok'
  const gazeColor = isGazeOk ? '#3ec98f' : '#e6b345'

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

      {/* 사람 — 동적 등 곡선 & 머리 위치 */}
      <g fill="none" stroke="#3ec98f" strokeWidth="5" strokeLinecap="round">
        <path d="M140 128 L190 128 L190 189" opacity="0.45" />
        <path d={`M140 128 C142 106 ${156 + (data?.headXOffset || 0) * 0.7} 90 ${headX - 7} 80`} />
      </g>
      <circle cx={headX} cy="68" r="10.5" fill="#3ec98f" />

      {/* 책상 + 맥북 화면 */}
      <g stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M230 120 L480 120" />
        <path d="M242 120 L242 189 M468 120 L468 189" />
        <path d="M400 107 L400 120 M386 120 L414 120" />
      </g>
      <rect x="396" y="55" width="7" height="52" rx="2" fill="rgba(255,255,255,0.3)" />

      {/* 시선 — 수평 기준선 vs 실제 측정 시선 */}
      <line x1={headX + 12} y1="68" x2="396" y2="68" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 5" />
      <line x1={headX + 12} y1="68" x2="396" y2={gazeTargetY} stroke={gazeColor} strokeWidth="1.3" strokeDasharray="5 4" />
      <text x="300" y="60" textAnchor="middle" fontSize="10" fill={gazeColor} fontFamily="IBM Plex Mono, monospace">
        시선 {gazeAngle > 0 ? '+' : ''}{gazeAngle}°
      </text>

      {/* 화면 거리 측정선 & 화살표 */}
      <g stroke={distColor} strokeWidth="1.2">
        <line x1="192" y1="168" x2="394" y2="168" />
        <path d="M198 164 L192 168 L198 172" fill="none" />
        <path d="M388 164 L394 168 L388 172" fill="none" />
      </g>
      <text x="293" y="161" textAnchor="middle" fontSize="10" fill={distColor} fontFamily="IBM Plex Mono, monospace">
        {distCm}cm · 권장 60–70cm
      </text>

      {/* 모니터 거치대 권장 높이 */}
      <g stroke={gazeColor} strokeWidth="1.2">
        <line x1="430" y1="55" x2="430" y2="68" />
        <path d={gazeAngle < -10 ? "M426 61 L430 55 L434 61" : "M426 62 L430 68 L434 62"} fill="none" />
      </g>
      <text x="438" y="65" fontSize="10" fill={gazeColor} fontFamily="IBM Plex Mono, monospace">
        {gazeAngle < -10 ? '+거치대 권장' : '적정 높이'}
      </text>
    </svg>
  )
}

export default function Environment() {
  const { setCalibrated, calibration } = useApp()

  // 캘리브레이션 랜드마크 기반 실시간 환경 진단
  const envData = useMemo(() => analyzeEnvironment(calibration), [calibration])
  const needFix = envData.needsFixCount

  return (
    <div>
      <ScreenHeader
        title="환경 가이드"
        desc="캘리브레이션 프레임의 실측 랜드마크를 분석해 맥북 작업 환경을 진단했어요."
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
            <MicroLabel>실시간 측면 모식도</MicroLabel>
            <Chip tone={needFix > 0 ? 'warn1' : 'good'}>
              {needFix > 0 ? `${envData.checks.length}개 중 ${needFix}개 조정 필요` : '모두 적정'}
            </Chip>
          </div>
          <span className="text-[11px] text-dim">{calibration?.at || '실시간 웹캠'} 캘리브레이션 기준</span>
        </div>
        <DynamicDeskDiagram data={envData} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {envData.checks.map((c, i) => (
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
