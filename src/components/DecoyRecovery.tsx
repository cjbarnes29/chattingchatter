import { useState } from 'react'
import { LifeBuoy, X } from 'lucide-react'
import { useAuth } from '../auth'
import SecretInput from './SecretInput'

const field = 'w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]'
const primary = 'w-full rounded-xl bg-[rgb(var(--accent))] py-2.5 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:opacity-90 disabled:opacity-60'
const ghost = 'w-full rounded-xl border border-[rgb(var(--border))] py-2.5 text-sm font-semibold transition hover:bg-[rgb(var(--accent-soft))] disabled:opacity-60'

/** Hidden recovery for the real account, opened from the decoy profile's Settings (swipe up and hold at the bottom).
 *  Nothing about the real account is shown here: not the email, not the name. A code is emailed to the account's
 *  address, and only that code (plus an explicit confirmation) can set a new password for it. */
export default function DecoyRecovery({ onClose }: { onClose: () => void }) {
  const { sendPasswordCode, changePasswordWithCode } = useAuth()
  const [step, setStep] = useState<'start' | 'code'>('start')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [done, setDone] = useState(false)

  const send = async () => {
    setBusy(true)
    setMsg(null)
    const r = await sendPasswordCode()
    setBusy(false)
    if (r.ok) {
      setStep('code')
      setMsg({ ok: true, text: 'We emailed a verification code to the address on the account.' })
    } else setMsg({ ok: false, text: r.error })
  }

  const review = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length < 6) return setMsg({ ok: false, text: 'Enter the code from the email.' })
    if (pw.length < 6) return setMsg({ ok: false, text: 'The new password must be at least 6 characters.' })
    if (pw !== pw2) return setMsg({ ok: false, text: 'The two passwords do not match.' })
    setMsg(null)
    setConfirming(true)
  }

  const reset = async () => {
    setConfirming(false)
    setBusy(true)
    const r = await changePasswordWithCode(code, pw)
    setBusy(false)
    if (r.ok) {
      setDone(true)
      setCode(''); setPw(''); setPw2('')
      setMsg({ ok: true, text: 'Password updated.' })
    } else setMsg({ ok: false, text: r.error })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-5" onClick={onClose}>
      <div role="dialog" aria-label="Account recovery" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]"><LifeBuoy size={18} /></span>
          <p className="flex-1 font-bold">Account recovery</p>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><X size={16} /></button>
        </div>

        {done ? (
          <button onClick={onClose} className={primary}>Done</button>
        ) : step === 'start' ? (
          <>
            <p className="text-sm text-[rgb(var(--text-secondary))]">Forgot the password? We’ll email a verification code to the address on the account so you can choose a new one.</p>
            <button onClick={send} disabled={busy} className={primary}>{busy ? 'Sending…' : 'Email me a code'}</button>
          </>
        ) : (
          <form onSubmit={review} className="space-y-2.5">
            <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Code from your email" aria-label="Verification code" autoComplete="one-time-code" className={field} />
            <SecretInput value={pw} onChange={setPw} placeholder="New password" label="New password" autoComplete="new-password" className={field} />
            <SecretInput value={pw2} onChange={setPw2} placeholder="Confirm new password" label="Confirm new password" autoComplete="new-password" className={field} />
            <div className="flex gap-2">
              <button type="button" onClick={send} disabled={busy} className={ghost}>Resend code</button>
              <button type="submit" disabled={busy} className={primary}>{busy ? 'Working…' : 'Continue'}</button>
            </div>
          </form>
        )}
        {msg && <p role="status" className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{msg.text}</p>}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-5" onClick={(e) => { e.stopPropagation(); setConfirming(false) }}>
          <div role="alertdialog" aria-label="Confirm password reset" onClick={(e) => e.stopPropagation()} className="w-full max-w-xs space-y-4 rounded-3xl bg-[rgb(var(--bg-panel))] p-5 text-center shadow-2xl ring-1 ring-[rgb(var(--border))]">
            <p className="font-semibold">This will reset your real account password. Continue?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className={ghost}>Cancel</button>
              <button onClick={reset} className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
