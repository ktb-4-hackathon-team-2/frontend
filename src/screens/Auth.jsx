import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { useRouter } from '../state/RouterContext'
import { Btn, Card, Icon, MicroLabel, PostureFigure } from '../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputCls = (invalid) =>
  `w-full rounded-xl border bg-raised px-4 py-3 text-sm outline-none transition-colors placeholder:text-dim ${
    invalid ? 'border-warn3/60 focus:border-warn3' : 'border-line focus:border-good/50'
  }`

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-mid">{label}</label>
      {children}
      {error && <p className="text-xs text-warn3">{error}</p>}
    </div>
  )
}

function ErrorBanner({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warn3/30 bg-warn3/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-warn3">
      <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
      {children}
    </div>
  )
}

// ── 1단계: 제품 키 게이트 ────────────────────────────────────────────
function KeyCard() {
  const { verifyKey } = useAuth()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [shakeN, setShakeN] = useState(0)

  const submit = async (e) => {
    e.preventDefault()
    if (!key.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const ok = await verifyKey(key.trim())
      if (!ok) {
        setError('제품 키가 올바르지 않아요. 다시 확인해 주세요.')
        setShakeN((n) => n + 1)
      }
    } catch (err) {
      setError(err?.message ?? '확인 중 문제가 생겼어요.')
      setShakeN((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rise d1 w-full max-w-sm p-8">
      <div className="mb-1 flex items-center gap-2">
        <Icon name="key" size={15} className="text-good" />
        <MicroLabel>Product Key</MicroLabel>
      </div>
      <h1 className="text-xl font-bold tracking-tight">제품 키를 입력해 주세요</h1>
      <p className="mt-1.5 text-xs leading-relaxed text-mid">
        키가 확인되면 회원가입과 로그인으로 넘어갈 수 있어요.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <div key={shakeN} className={shakeN ? 'shake' : ''}>
          <input
            autoFocus
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              setError(null)
            }}
            placeholder="····"
            maxLength={32}
            className={`w-full rounded-xl border bg-raised px-4 py-3 text-center font-mono text-xl tracking-[0.45em] outline-none transition-colors placeholder:text-dim ${
              error ? 'border-warn3/60 focus:border-warn3' : 'border-line focus:border-good/50'
            }`}
          />
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Btn kind="primary" className="w-full" disabled={!key.trim() || busy}>
          {busy ? '확인 중…' : '확인'}
        </Btn>
      </form>
      <p className="mt-4 text-center font-mono text-[10px] tracking-[0.14em] text-dim">
        DEV — 로컬 기본 키는 9999
      </p>
    </Card>
  )
}

// ── 2단계: 로그인 / 회원가입 ─────────────────────────────────────────
function AuthCard() {
  const { login, signup } = useAuth()
  const { path, navigate } = useRouter()
  const mode = path === '/signup' ? 'signup' : 'login' // 탭 상태의 원천은 URL
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErr, setFieldErr] = useState({})

  // 뒤로가기 등으로 탭이 바뀌어도 에러는 초기화
  useEffect(() => {
    setError(null)
    setFieldErr({})
  }, [mode])

  const switchMode = (m) => navigate(m === 'signup' ? '/signup' : '/login')

  // 서버 제약(이메일 형식, 비밀번호 8–64자)을 미리 클라이언트에서 검사
  const validate = () => {
    const fe = {}
    if (!EMAIL_RE.test(email)) fe.email = '이메일 형식이 올바르지 않아요'
    if (pw.length < 8 || pw.length > 64) fe.pw = '비밀번호는 8자 이상 64자 이하예요'
    if (mode === 'signup' && pw !== pw2) fe.pw2 = '비밀번호가 서로 달라요'
    setFieldErr(fe)
    return Object.keys(fe).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!validate()) return
    setBusy(true)
    try {
      if (mode === 'login') await login(email, pw)
      else await signup(email, pw)
    } catch (err) {
      const code = err?.code
      setError(
        code === 'LOGIN_FAILED'
          ? '이메일 또는 비밀번호가 올바르지 않아요.'
          : code === 'DUPLICATE_EMAIL'
            ? '이미 가입된 이메일이에요 — 로그인 탭에서 시도해 보세요.'
            : (err?.message ?? '요청을 처리하지 못했어요.'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rise d1 w-full max-w-sm p-8">
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-line bg-raised p-1">
        {[
          { id: 'login', label: '로그인' },
          { id: 'signup', label: '회원가입' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchMode(t.id)}
            className={`cursor-pointer rounded-lg py-2 text-sm transition-all ${
              mode === t.id ? 'bg-white/[0.08] font-semibold text-hi' : 'text-dim hover:text-mid'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="이메일" error={fieldErr.email}>
          <input
            autoFocus
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={100}
            className={inputCls(Boolean(fieldErr.email))}
          />
        </Field>

        <Field label="비밀번호" error={fieldErr.pw}>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="8자 이상"
              maxLength={64}
              className={`${inputCls(Boolean(fieldErr.pw))} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-dim transition-colors hover:text-mid"
              title={showPw ? '숨기기' : '표시'}
            >
              <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </div>
        </Field>

        {mode === 'signup' && (
          <Field label="비밀번호 확인" error={fieldErr.pw2}>
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="한 번 더 입력"
              maxLength={64}
              className={inputCls(Boolean(fieldErr.pw2))}
            />
          </Field>
        )}

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Btn kind="primary" className="mt-1 w-full" disabled={busy}>
          {busy ? (mode === 'login' ? '로그인 중…' : '가입 중…') : mode === 'login' ? '로그인' : '가입하고 시작하기'}
        </Btn>
      </form>

      {mode === 'signup' && (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-dim">
          가입하면 바로 로그인돼요. 비밀번호는 서버에 해시로만 저장됩니다.
        </p>
      )}
    </Card>
  )
}

export default function Auth() {
  const { path } = useRouter()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="rise mb-8 flex flex-col items-center gap-2.5">
        <PostureFigure state="good" className="h-12 w-12 text-good" stroke={6} />
        <div className="text-2xl font-bold tracking-tight">반듯</div>
        <MicroLabel>Posture Guard</MicroLabel>
      </div>
      {path === '/key' ? <KeyCard /> : <AuthCard />}
      <p className="rise d3 mt-6 max-w-xs text-center text-[11px] leading-relaxed text-dim">
        카메라 영상은 항상 기기 안에서만 처리돼요. 계정은 리포트 저장에만 사용됩니다.
      </p>
    </div>
  )
}
