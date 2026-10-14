import { useState } from 'react'
import { MessageCircle, Mail, User as UserIcon, Lock, Loader2, MailCheck } from 'lucide-react'
import { useAuth } from '../auth'
import InstallButton from './InstallButton'
import ResetPassword from './ResetPassword'

const field =
  'flex items-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 ring-1 ring-transparent focus-within:ring-[rgb(var(--accent))]'
const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]'
const input = 'w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-tertiary))]'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [forgot, setForgot] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = mode === 'login' ? await signIn(email, password) : await signUp(email, password, name)
    setBusy(false)
    if (!res.ok) setError(res.error)
    else if (res.needsConfirm) setConfirmSent(true)
  }

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
              ? `We sent a confirmation link to ${email}. Open it, then sign in here.`
              : mode === 'login'
                ? 'Sign in to pick up your chats.'
                : 'Create your account in seconds.'}
          </p>
          {!confirmSent && <InstallButton className="mt-4" />}
        </div>

        {confirmSent ? (
          <button
            onClick={() => {
              setConfirmSent(false)
              setMode('login')
              setPassword('')
            }}
            className="w-full rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] shadow-md transition hover:opacity-90"
          >
            Back to sign in
          </button>
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
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} autoComplete="email" required />
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
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                </span>
              </label>
              {mode === 'login' && (
                <button type="button" onClick={() => { setForgot(true); setError(null) }} className="text-sm font-semibold text-[rgb(var(--accent))]">
                  Forgot password?
                </button>
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
          By continuing you agree to Chatter’s Terms and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
