// 공용 프리미티브 — 아이콘, 카드, 라벨, 버튼, 자세 실루엣

export const TONE = {
  good: { text: 'text-good', bg: 'bg-good', soft: 'bg-good/10', border: 'border-good/30', hex: '#3ec98f' },
  warn1: { text: 'text-warn1', bg: 'bg-warn1', soft: 'bg-warn1/10', border: 'border-warn1/30', hex: '#e6b345' },
  warn2: { text: 'text-warn2', bg: 'bg-warn2', soft: 'bg-warn2/10', border: 'border-warn2/40', hex: '#ef8b4e' },
  warn3: { text: 'text-warn3', bg: 'bg-warn3', soft: 'bg-warn3/10', border: 'border-warn3/40', hex: '#e0393e' },
  neutral: { text: 'text-mid', bg: 'bg-mid', soft: 'bg-white/5', border: 'border-line-strong', hex: '#a3ada7' },
}

const ICONS = {
  activity: <path d="M22 12h-4l-3 8-6-16-3 8H2" />,
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M8 17V9" />
      <path d="M13 17V5" />
      <path d="M18 17v-6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v7" />
      <path d="M12 13l-4 7" />
      <path d="M12 13l4 7" />
      <path d="M12 9 7 5" />
      <path d="M12 9l5-4" />
    </>
  ),
  desk: (
    <>
      <path d="M5 4h14v9H5z" />
      <path d="M12 13v4" />
      <path d="M8 17h8" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="10" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  video: (
    <>
      <path d="M15.6 10.3 21 7v10l-5.4-3.3" />
      <path d="M3 8a2 2 0 0 1 2-2h8.6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  videoOff: (
    <>
      <path d="M15.6 10.3 21 7v10l-5.4-3.3" />
      <path d="M3 8a2 2 0 0 1 2-2h8.6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="m2 2 20 20" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5v14" strokeWidth="2.2" />
      <path d="M15 5v14" strokeWidth="2.2" />
    </>
  ),
  play: <path d="m7 5 12 7-12 7z" fill="currentColor" stroke="none" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.9-6.6" />
      <path d="M21 3v6h-6" />
    </>
  ),
  alert: (
    <>
      <path d="m10.3 3.9-8.4 14.5A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0" />
      <path d="M12 9v5" />
      <path d="M12 17.5h.01" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8" />,
  volume: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  flame: <path d="M12 3c1 3 4 4.5 4 8.5a4.5 4.5 0 0 1-9 0c0-1.8.8-3.2 1.8-4.3 0 1.6.8 2.6 1.7 2.8C10.2 7.6 11 5.3 12 3z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  pip: (
    <>
      <path d="M3 5h18v14H3z" />
      <path d="M12 12h6v4h-6z" fill="currentColor" stroke="none" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18a2.1 2.1 0 0 0 3 3l5.7-5.7a4.5 4.5 0 0 0 6-6L14.5 12 12 9.5z" />,
  arrowRight: (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
}

export function Icon({ name, size = 18, strokeWidth = 1.7, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name] || null}
    </svg>
  )
}

// 앉은 사람 실루엣 — 상태가 나빠질수록 실제로 구부정해진다. 앱의 시그니처 마크.
const FIGURE = {
  good: { head: [33, 15], spine: 'M31 46 C31 38 32 30 33 22.5' },
  warn1: { head: [36, 17], spine: 'M31 46 C31 38 33 31 35 24.5' },
  warn2: { head: [41, 21], spine: 'M31 46 C31 39 35 33 39.5 27.5' },
  warn3: { head: [46, 27], spine: 'M31 46 C32 41 38 36.5 43.5 32.5' },
}

export function PostureFigure({ state = 'good', className = '', stroke = 4.5 }) {
  const f = FIGURE[state] || FIGURE.good
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path
        d="M30 48 L46 48 L46 59"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path
        d={f.spine}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{ transition: 'd 0.5s ease' }}
      />
      <circle
        cx={f.head[0]}
        cy={f.head[1]}
        r="5.5"
        fill="currentColor"
        style={{ transition: 'cx 0.5s ease, cy 0.5s ease' }}
      />
    </svg>
  )
}

export function MicroLabel({ children, className = '' }) {
  return (
    <div className={`font-mono text-[10px] uppercase tracking-[0.22em] text-dim ${className}`}>
      {children}
    </div>
  )
}

export function Card({ children, className = '', ...rest }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function Chip({ tone = 'good', children, className = '' }) {
  const t = TONE[tone] || TONE.neutral
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${t.soft} ${t.border} ${t.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.bg}`} />
      {children}
    </span>
  )
}

const BTN_KIND = {
  primary: 'bg-good text-ink font-semibold hover:brightness-110 active:brightness-95',
  outline: 'border border-line-strong text-hi hover:bg-white/5',
  ghost: 'text-mid hover:text-hi hover:bg-white/5',
  danger: 'bg-warn3 text-white font-semibold hover:brightness-110',
}
const BTN_SIZE = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
}

export function Btn({ kind = 'outline', size = 'md', className = '', children, ...rest }) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center transition-all duration-150 focus-visible:outline-2 focus-visible:outline-good/60 disabled:cursor-not-allowed disabled:opacity-40 ${BTN_KIND[kind]} ${BTN_SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ScreenHeader({ title, desc, right }) {
  return (
    <div className="rise mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1.5 text-sm text-mid">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

export function StatTile({ label, value, unit, sub, delta, deltaGood, children, className = '' }) {
  return (
    <Card className={`flex flex-col gap-2 p-5 ${className}`}>
      <MicroLabel>{label}</MicroLabel>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[28px] font-semibold leading-none tracking-tight">{value}</span>
        {unit && <span className="text-sm text-mid">{unit}</span>}
      </div>
      {delta && (
        <div className={`flex items-center gap-1 text-xs ${deltaGood ? 'text-good' : 'text-warn2'}`}>
          <span>{delta}</span>
          {sub && <span className="text-dim">· {sub}</span>}
        </div>
      )}
      {!delta && sub && <div className="text-xs text-dim">{sub}</div>}
      {children}
    </Card>
  )
}

// 커스텀 토글 스위치
export function Toggle({ on, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-40 ${
        on ? 'bg-good' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all duration-200 ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
