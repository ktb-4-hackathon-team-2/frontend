import { useApp } from '../state/AppContext'
import { useAuth } from '../state/AuthContext'
import { Btn, Card, Icon, MicroLabel, ScreenHeader, Toggle } from '../components/ui'
import { fmtClock } from '../lib/format'
import { playChime } from '../lib/sound'

const ALERT_LEVELS = [
  { value: 1, name: '1단계까지', desc: '위젯 신호만 — 가장 조용해요' },
  { value: 2, name: '2단계까지', desc: '위젯 + 토스트 (기본)', badge: '기본' },
  { value: 3, name: '3단계까지', desc: '전체 화면 개입 포함 — 강한 개입이에요', optIn: true },
]

const SOUNDS = [
  { value: 'chime', name: '차임' },
  { value: 'wood', name: '우드' },
  { value: 'funny', name: '펀니' },
  { value: 'none', name: '무음' },
]

function Row({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="mt-0.5 text-xs leading-relaxed text-dim">{desc}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export default function Settings() {
  const { settings, updateSetting, setCalibrated, stretchLeft, setStretchSuggest, calibration, cameraView, setCameraView } = useApp()
  const { member, logout } = useAuth()

  return (
    <div className="max-w-3xl">
      <ScreenHeader title="설정" desc="개입은 딱 필요한 만큼만. 나머지는 반듯이 알아서." />

      {/* 알림 */}
      <Card className="rise d1 mb-4 px-6 py-2">
        <div className="border-b border-line py-4">
          <MicroLabel>알림</MicroLabel>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {ALERT_LEVELS.map((l) => {
              const active = settings.maxAlertLevel === l.value
              return (
                <button
                  key={l.value}
                  onClick={() => updateSetting('maxAlertLevel', l.value)}
                  className={`cursor-pointer rounded-xl border p-3.5 text-left transition-all ${
                    active
                      ? l.optIn
                        ? 'border-warn3/50 bg-warn3/[0.07]'
                        : 'border-good/50 bg-good/[0.07]'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${active ? 'text-hi' : 'text-mid'}`}>{l.name}</span>
                    {l.badge && <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-dim">{l.badge}</span>}
                    {active && <Icon name="check" size={14} className={l.optIn ? 'text-warn3' : 'text-good'} />}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-dim">{l.desc}</div>
                </button>
              )
            })}
          </div>
          {settings.maxAlertLevel >= 3 && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-warn3/[0.07] px-3.5 py-2.5 text-xs text-warn3">
              <Icon name="alert" size={13} />
              3단계는 화면 전체를 덮는 강한 개입이에요. 회의·발표 중엔 일시정지를 활용하세요.
            </p>
          )}
        </div>

        <div className="border-b border-line">
          <Row label="알림음" desc="2단계 이상 알림에서 재생돼요">
            <div className="flex overflow-hidden rounded-lg border border-line">
              {SOUNDS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    updateSetting('sound', s.value)
                    updateSetting('soundOn', s.value !== 'none')
                    playChime(s.value)
                  }}
                  className={`cursor-pointer px-3.5 py-1.5 text-xs transition-colors ${
                    settings.sound === s.value ? 'bg-white/[0.08] font-medium text-hi' : 'text-dim hover:text-mid'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <Btn size="sm" kind="ghost" onClick={() => playChime(settings.sound)} disabled={settings.sound === 'none'}>
              <Icon name="volume" size={13} />
              미리 듣기
            </Btn>
          </Row>
        </div>

        <div className="border-b border-line">
          <Row
            label="판정 민감도"
            desc={`높일수록 작은 흐트러짐에도 빨리 반응해요 · 현재 ${
              settings.sensitivity < 34 ? '느슨' : settings.sensitivity < 67 ? '보통' : '민감'
            } (임계값 ${Math.pow(2, (50 - settings.sensitivity) / 50).toFixed(2)}×)`}
          >
            <span className="text-[11px] text-dim">느슨</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.sensitivity}
              onChange={(e) => updateSetting('sensitivity', Number(e.target.value))}
              className="w-40 accent-good"
            />
            <span className="text-[11px] text-dim">민감</span>
            <span className="w-8 text-right font-mono text-xs text-mid">{settings.sensitivity}</span>
          </Row>
        </div>

        <Row label="조용한 시간대" desc="이 시간엔 소리 없이 위젯으로만 알려요">
          {settings.quietOn && (
            <div className="flex items-center gap-1.5 font-mono text-xs text-mid">
              <input
                type="time"
                value={settings.quietFrom}
                onChange={(e) => updateSetting('quietFrom', e.target.value)}
                className="rounded-lg border border-line bg-raised px-2 py-1.5 outline-none focus:border-good/50"
              />
              –
              <input
                type="time"
                value={settings.quietTo}
                onChange={(e) => updateSetting('quietTo', e.target.value)}
                className="rounded-lg border border-line bg-raised px-2 py-1.5 outline-none focus:border-good/50"
              />
            </div>
          )}
          <Toggle on={settings.quietOn} onChange={(v) => updateSetting('quietOn', v)} />
        </Row>
      </Card>

      {/* 스트레칭 */}
      <Card className="rise d2 mb-4 px-6 py-2">
        <div className="py-2">
          <MicroLabel className="pt-2">스트레칭</MicroLabel>
        </div>
        <Row label="제안 주기" desc="바른 자세여도 정기적으로 몸을 풀어주는 게 좋아요">
          <div className="flex items-center gap-1">
            <Btn
              size="sm"
              kind="ghost"
              disabled={settings.stretchMin <= 30}
              onClick={() => updateSetting('stretchMin', settings.stretchMin - 10)}
            >
              −
            </Btn>
            <span className="w-16 text-center font-mono text-sm font-semibold">{settings.stretchMin}분</span>
            <Btn
              size="sm"
              kind="ghost"
              disabled={settings.stretchMin >= 90}
              onClick={() => updateSetting('stretchMin', settings.stretchMin + 10)}
            >
              +
            </Btn>
          </div>
        </Row>
        <div className="border-t border-line">
          <Row label="다음 제안" desc={`${fmtClock(stretchLeft)} 뒤에 제안할 예정이에요`}>
            <Btn size="sm" kind="ghost" onClick={() => setStretchSuggest(true)}>
              지금 제안 받기
            </Btn>
          </Row>
        </div>
      </Card>

      {/* 캘리브레이션 & 카메라 배치 */}
      <Card className="rise d3 mb-4 px-6 py-2">
        <div className="py-2">
          <MicroLabel className="pt-2">카메라 배치 & 캘리브레이션</MicroLabel>
        </div>
        <div className="border-b border-line py-3">
          <div className="text-sm font-medium mb-1">카메라 배치 환경</div>
          <div className="text-xs text-dim mb-3">작업 환경에 맞게 카메라 각도를 선택하면 맞춤 기준을 적용해요.</div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'front', label: '정면', desc: '모니터 정면 중앙' },
              { id: 'left_diagonal', label: '좌측 대각', desc: '노트북이 왼쪽 책상' },
              { id: 'right_diagonal', label: '우측 대각', desc: '노트북이 오른쪽 책상' },
            ].map((v) => {
              const active = cameraView === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => setCameraView(v.id)}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                    active
                      ? 'border-good/50 bg-good/[0.07] ring-1 ring-good/40'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${active ? 'text-good' : 'text-hi'}`}>{v.label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-good" />}
                  </div>
                  <div className="mt-1 text-[10px] text-dim">{v.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
        <Row
          label="기준 자세 재설정"
          desc={`${calibration?.at || '2026.8.19'} 촬영 (${cameraView === 'front' ? '정면' : cameraView === 'left_diagonal' ? '좌측 대각' : '우측 대각'}) · 데이터는 기기에만 저장돼요`}
        >
          <Btn size="sm" kind="outline" onClick={() => setCalibrated(false)}>
            <Icon name="refresh" size={13} />
            다시 촬영하기
          </Btn>
        </Row>
      </Card>

      {/* 계정 */}
      <Card className="rise d4 mb-4 px-6 py-2">
        <div className="py-2">
          <MicroLabel className="pt-2">계정</MicroLabel>
        </div>
        <Row label={member?.email ?? '로그인됨'} desc="계정은 리포트 저장에만 사용돼요">
          <Btn size="sm" kind="outline" onClick={logout}>
            <Icon name="logout" size={13} />
            로그아웃
          </Btn>
        </Row>
      </Card>

      <Card className="rise d5 flex items-start gap-3 border-dashed px-6 py-4">
        <Icon name="wrench" size={15} className="mt-0.5 shrink-0 text-dim" />
        <p className="text-xs leading-relaxed text-dim">
          프로토타입 범위 — 자세 판정(MediaPipe)·서버·계정은 아직 없어요. 자세 상태는 좌측 하단 DEV 패널로
          시뮬레이션하고, 점수와 리포트는 더미 데이터예요.
        </p>
      </Card>
    </div>
  )
}
