import { useEffect, useState } from 'react'
import { MessageCircle, Mail, User as UserIcon, Lock, Loader2, MailCheck, KeyRound } from 'lucide-react'
import { useAuth } from '../auth'
import InstallButton from './InstallButton'
import ResetPassword from './ResetPassword'
import Terms from './Terms'
import { passwordManagerSupported, readSignin, savedPassword, setSignin, storePassword } from '../signinPrefs'

const field =
  'flex items-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 ring-1 ring-transparent focus-within:ring-[rgb(var(--accent))]'
const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]'
const input = 'w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-tertiary))]'

// Remember an unfinished sign-up so the code screen comes back if the app is closed or reloaded.
const PENDING_KEY = 'chatter.pendingConfirm'
const readPending = () => {
  try {
    return localStorage.getItem(PENDING_KEY) ?? ''
  } catch {
    return ''
  }
}
const writePending = (email: string | null) => {
  try {
    if (email) localStorage.setItem(PENDING_KEY, email)
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    /* storage unavailable: the screen still works, it just won't survive a restart */
  }
}

export default function AuthScreen() {
  const { signIn, signUp, verifySignupCode, resendSignupCode } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [forgot, setForgot] = useState(false)
  const [email, setEmail] = useState(readPending)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmSent, setConfirmSent] = useState(() => !!readPending())
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [savePw, setSavePw] = useState(() => readSignin().save)

  // Auto sign-in with the password saved in the browser's password manager (if the user turned it on)
  useEffect(() => {
    let off = false
    void savedPassword().then(async (c) => {
      if (!c || off) return
      setEmail(c.email)
      setBusy(true)
      setNotice('Signing in with your saved password…')
      const res = await signIn(c.email, c.password)
      if (off) return
      setBusy(false)
      setNotice(null)
      if (!res.ok) setError('Your saved password didn’t work. Sign in again to update it.')
    })
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'register' && !agreed) {
      setError('Please tick the box to agree to the Terms and Conditions.')
      return
    }
    setBusy(true)
    const res = mode === 'login' ? await signIn(email, password) : await signUp(email, password, name)
    setBusy(false)
    if (res.ok && !res.needsConfirm && mode === 'login') void storePassword(email.trim().toLowerCase(), password)
    if (!res.ok) {
      setError(res.error)
      // signing in to an unconfirmed account: jump straight to the code screen
      if (res.unconfirmed) {
        writePending(email.trim().toLowerCase())
        setConfirmSent(true)
        setError(null)
        setNotice('Enter the code from your sign-up email, or tap “Resend code” for a new one.')
      }
    } else if (res.needsConfirm) {
      writePending(email.trim().toLowerCase())
      setConfirmSent(true)
      if (res.existing) setNotice('This email already has an account. If it isn’t confirmed yet, enter the new code we just sent. Already confirmed? Go back and sign in.')
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Enter the code from the email.')
    setBusy(true)
    const res = await verifySignupCode(email, code)
    setBusy(false)
    if (!res.ok) setError(res.error)
    else writePending(null)
  }

  const resend = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    const res = await resendSignupCode(email)
    setBusy(false)
    if (res.ok) setNotice(`A new code is on its way to ${email}.`)
    else setError(res.error)
  }

  if (showTerms) return <Terms onBack={() => setShowTerms(false)} />

  if (forgot) {
    return (
      <ResetPassword
        onBack={() => {
          setForgot(false)
          setError(null)
        }}
      />
    )
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[rgb(var(--bg-app))] p-4">
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[rgb(var(--accent))] opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[rgb(var(--accent-soft))] opacity-80 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl bg-[rgb(var(--bg-panel))] p-8 shadow-2xl ring-1 ring-[rgb(var(--border))] sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow-lg">
            {confirmSent ? <MailCheck size={30} /> : <MessageCircle size={30} />}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{confirmSent ? 'Check your inbox' : 'Welcome to Chatter'}</h1>
          <p className="mt-1.5 text-sm text-[rgb(var(--text-secondary))]">
            {confirmSent
              ? `We emailed a code to ${email}. Enter it below to finish creating your account.`
              : mode === 'login'
                ? 'Sign in to pick up your chats.'
                : 'Create your account in seconds.'}
          </p>
          {!confirmSent && <InstallButton className="mt-4" />}
        </div>

        {confirmSent ? (
          <form onSubmit={verify} className="space-y-4">
            <label className="block">
              <span className={label}>Confirmation code</span>
              <span className={field}>
                <KeyRound size={16} className="text-[rgb(var(--text-tertiary))]" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`${input} tracking-[0.3em]`}
                  autoFocus
                />
              </span>
            </label>
            {notice && <p className="text-sm text-[rgb(var(--text-secondary))]">{notice}</p>}
            {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] shadow-md transition hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />} Confirm account
            </button>
            <div className="flex items-center justify-between text-sm font-semibold">
              <button type="button" onClick={resend} disabled={busy} className="text-[rgb(var(--accent))] disabled:opacity-60">
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  writePending(null)
                  setConfirmSent(false)
                  setMode('login')
                  setPassword('')
                  setCode('')
                  setError(null)
                  setNotice(null)
                }}
                className="text-[rgb(var(--text-secondary))]"
              >
                Back to sign in
              </button>
            </div>
          </form>
        ) : (
          <>
            <div role="tablist" className="mb-6 grid grid-cols-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m)
                    setError(null)
                  }}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    mode === m ? 'bg-[rgb(var(--bg-panel))] text-[rgb(var(--text-primary))] shadow-sm' : 'text-[rgb(var(--text-secondary))]'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && (
                <label className="block">
                  <span className={label}>Display name</span>
                  <span className={field}>
                    <UserIcon size={16} className="text-[rgb(var(--text-tertiary))]" />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="How friends will see you" className={input} autoComplete="name" />
                  </span>
                </label>
              )}
              <label className="block">
                <span className={label}>Email</span>
                <span className={field}>
                  <Mail size={16} className="text-[rgb(var(--text-tertiary))]" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} name="email" autoComplete="username" required />
                </span>
              </label>
              <label className="block">
                <span className={label}>Password</span>
                <span className={field}>
                  <Lock size={16} className="text-[rgb(var(--text-tertiary))]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={input}
                    name="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                </span>
              </label>
              {mode === 'login' && (
                <label className="flex items-start gap-2 text-xs text-[rgb(var(--text-secondary))]">
                  <input type="checkbox" checked={savePw} onChange={(e) => setSavePw(setSignin({ save: e.target.checked }).save)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
                  <span>
                    Save my password to Google Password Manager
                    {!passwordManagerSupported() && <span className="block text-[11px] text-[rgb(var(--text-tertiary))]">In the Android app, Android’s Autofill (Google) offers to save it instead, if Autofill is on in phone settings.</span>}
                  </span>
                </label>
              )}
              {mode === 'login' && (
                <button type="button" onClick={() => { setForgot(true); setError(null) }} className="text-sm font-semibold text-[rgb(var(--accent))]">
                  Forgot password?
                </button>
              )}
              {mode === 'register' && (
                <label className="flex items-start gap-3 text-sm text-[rgb(var(--text-secondary))]">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
                  />
                  <span>
                    I agree to the{' '}
                    <button type="button" onClick={() => setShowTerms(true)} className="font-semibold text-[rgb(var(--accent))] underline">
                      Terms and Conditions
                    </button>
                  </span>
                </label>
              )}
              {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] shadow-md transition hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-xs text-[rgb(var(--text-tertiary))]">
          By continuing you agree to Chatter’s{' '}
          <button type="button" onClick={() => setShowTerms(true)} className="font-semibold underline">
            Terms and Conditions
          </button>{' '}
          and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
