import { useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import { useAuth } from '../auth'
import SecretInput from './SecretInput'

/** Asks for the account password, for confirming a log out when the PIN isn't used. */
export default function PasswordConfirm({ title = 'Confirm log out', onCancel, onVerified }: { title?: string; onCancel: () => void; onVerified: () => void }) {
  const { verifyPassword } = useAuth()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    setErr('')
    const ok = await verifyPassword(pw)
    setBusy(false)
    if (ok) onVerified()
    else {
      setPw('')
      setErr('That password didn’t work.')
    }
  }
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-5" onClick={onCancel}>
      <form role="dialog" aria-label={title} onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]"><KeyRound size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{title}</p>
            <p className="text-xs text-[rgb(var(--text-secondary))]">Enter your account password.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><X size={16} /></button>
        </div>
        <SecretInput value={pw} onChange={setPw} autoFocus label="Account password" placeholder="Password" autoComplete="current-password" className="w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]" />
        {err && <p role="alert" className="text-xs text-rose-500">{err}</p>}
        <button type="submit" disabled={!pw || busy} className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Checking…' : 'Log out'}</button>
      </form>
    </div>
  )
}
