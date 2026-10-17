import { useEffect, useRef, useState } from 'react'
import { KeyRound, Lock, Loader2, Mail, MailCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth'
import SecretInput from './SecretInput'

type Step = 'email' | 'code' | 'password'

const field =
  'flex items-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 ring-1 ring-transparent focus-within:ring-[rgb(var(--accent))]'
const input = 'w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-tertiary))]'
const primaryBtn =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] shadow-md transition hover:opacity-90 disabled:opacity-60'

// Supabase may send 6 or 8 digit codes depending on project settings.
// The screen shows 8 boxes and accepts any code from 6 to 8 digits.
const CODE_LENGTH = 8
const MIN_CODE_LENGTH = 6
const RESEND_SECONDS = 60

export default function ResetPassword({ onBack }: { onBack?: () => void }) {
  const { requestReset, verifyResetCode, setNewPassword, recovering } = useAuth()
  // If the code was already verified (recovery session active), start at the password step.
  const [step, setStep] = useState<Step>(() => (recovering ? 'password' : 'email'))
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  // Count down the resend timer.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const code = digits.join('')
  const codeReady = code.length >= MIN_CODE_LENGTH

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const r = await requestReset(email)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    setStep('code')
    setCooldown(RESEND_SECONDS)
    setInfo(`If an account exists for ${email}, a code is on its way.`)
  }

  const verify = async (value: string) => {
    if (value.length < MIN_CODE_LENGTH || value.length > CODE_LENGTH || busy) return
    setError(null)
    setBusy(true)
    const r = await verifyResetCode(email, value)
    setBusy(false)
    if (!r.ok) {
      setDigits(Array(CODE_LENGTH).fill(''))
      inputs.current[0]?.focus()
      return setError(r.error)
    }
    setStep('password')
  }

  // Verifying the code already sets the recovery flag and shows the password step.
  // Keep the password step visible even if the flag is set by another route.
  useEffect(() => {
    if (recovering) setStep('password')
  }, [recovering])

  const onDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) {
      // Pasted full code
      const next = clean.slice(0, CODE_LENGTH).split('')
      const filled = [...Array(CODE_LENGTH).fill('')].map((_, idx) => next[idx] ?? '')
      setDigits(filled)
      inputs.current[Math.min(next.length, CODE_LENGTH) - 1]?.focus()
      if (next.length === CODE_LENGTH) verify(next.join(''))
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus()
    if (clean && next.join('').length === CODE_LENGTH) verify(next.join(''))
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (pw.length < 6) return setError('Password must be at least 6 characters.')
    if (pw !== pw2) return setError('Passwords do not match.')
    setBusy(true)
    const res = await setNewPassword(pw)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  const goBack = () => {
    if (step === 'email') return onBack?.()
    setError(null)
    setInfo(null)
    setStep(step === 'password' ? 'code' : 'email')
  }

  const header = {
    email: { icon: <Lock size={28} />, title: 'Reset your password', sub: 'Enter your email and we’ll send you a code.' },
    code: { icon: <MailCheck size={30} />, title: 'Enter your code', sub: `We sent an 8-digit code to ${email}.` },
    password: { icon: <KeyRound size={28} />, title: 'Set a new password', sub: 'Choose a new password for your account.' },
  }[step]

  return (
    <div className="flex min-h-screen safe-page w-full items-center justify-center bg-[rgb(var(--bg-app))] p-4">
      <div className="w-full max-w-md rounded-3xl bg-[rgb(var(--bg-panel))] p-8 shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <button type="button" onClick={goBack} className="mb-4 flex items-center gap-1 text-sm font-semibold text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]">
          <ArrowLeft size={16} /> {step === 'email' ? 'Back to sign in' : 'Back'}
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]">
            {header.icon}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{header.title}</h1>
          <p className="mt-1.5 text-sm text-[rgb(var(--text-secondary))]">{header.sub}</p>
        </div>

        {step === 'email' && (
          <form onSubmit={sendCode} className="space-y-4">
            <span className={field}>
              <Mail size={16} className="text-[rgb(var(--text-tertiary))]" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} autoComplete="email" required />
            </span>
            {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy && <Loader2 size={16} className="animate-spin" />} Send code
            </button>
          </form>
        )}

        {step === 'code' && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2" role="group" aria-label="8-digit code">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el
                  }}
                  value={d}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={CODE_LENGTH}
                  onChange={(e) => onDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={`Digit ${i + 1}`}
                  className="h-12 w-8 rounded-xl bg-[rgb(var(--bg-panel-soft))] text-center text-lg font-bold outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))] sm:h-14 sm:w-10"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {info && !error && <p className="text-center text-sm text-[rgb(var(--text-secondary))]">{info}</p>}
            {error && <p role="alert" className="text-center text-sm text-rose-500">{error}</p>}
            <button type="button" onClick={() => verify(code)} disabled={busy || !codeReady} className={primaryBtn}>
              {busy && <Loader2 size={16} className="animate-spin" />} Verify code
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => sendCode()} disabled={cooldown > 0 || busy} className="font-semibold text-[rgb(var(--accent))] disabled:opacity-50">
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
              <button type="button" onClick={() => { setStep('email'); setError(null); setInfo(null); setDigits(Array(CODE_LENGTH).fill('')) }} className="text-[rgb(var(--text-secondary))]">
                Wrong email?
              </button>
            </div>
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={savePassword} className="space-y-4">
            <label className={field}>
              <Lock size={16} className="text-[rgb(var(--text-tertiary))]" />
              <SecretInput value={pw} onChange={setPw} placeholder="New password (at least 6 characters)" label="New password" autoComplete="new-password" required className={input} wrapClassName="flex-1" />
            </label>
            <label className={field}>
              <Lock size={16} className="text-[rgb(var(--text-tertiary))]" />
              <SecretInput value={pw2} onChange={setPw2} placeholder="Confirm new password" label="Confirm new password" autoComplete="new-password" required className={input} wrapClassName="flex-1" />
            </label>
            {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy && <Loader2 size={16} className="animate-spin" />} Save password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
