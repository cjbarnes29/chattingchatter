import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Delete, Fingerprint, ShieldCheck } from 'lucide-react'
import { usePro } from '../pro'
import { verifyBiometric } from '../biometric'
import { fmtWait, validPin, PIN_MAX } from '../pinLock'
import SecretInput from './SecretInput'

type Props = {
  onUnlock: () => void
  onDecoy: () => void
  title?: string
  subtitle?: string
  onCancel?: () => void
  /** Pro: unlock with fingerprint / face */
  bioUnlock?: boolean
  /** offers "use my password" instead of a PIN */
  onPassword?: () => void
}

/** Asks for the PIN. Shown at launch for users who set a PIN, and again before logging out.
 *  The real PIN opens Chatter; the decoy PIN (if set) opens the harmless decoy profile.
 *  A PIN is 4 to 32 characters. Typing or tapping characters never submits by itself: the PIN is only
 *  checked when the check key, the Unlock button or Enter is used, so a single character can't dismiss this screen.
 *  After 5 wrong PINs there is a wait that doubles each time (up to 15 minutes).
 *  A fingerprint or face check only ever unlocks the real app. If it fails or is cancelled, nothing opens. */
export function PinGate({ onUnlock, onDecoy, title = 'Enter your PIN', subtitle = 'Chatter is locked', onCancel, bioUnlock = false, onPassword }: Props) {
  const { verifyPin, lockedUntil } = usePro()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [bioMsg, setBioMsg] = useState('')
  const [now, setNow] = useState(Date.now())
  const busy = useRef(false)
  const startY = useRef<number | null>(null)
  const waitMs = Math.max(0, lockedUntil - now)

  // tick while a wait is running so the countdown updates
  useEffect(() => {
    if (lockedUntil <= Date.now()) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [lockedUntil])

  const check = useCallback(async (value: string) => {
    if (checking || !validPin(value)) return
    setChecking(true)
    const r = await verifyPin(value)
    if (r === 'real') return onUnlock()
    if (r === 'decoy') return onDecoy()
    setNow(Date.now())
    setError(r === 'none')
    setPin('')
    setChecking(false)
    if (r === 'none') window.setTimeout(() => setError(false), 1400)
  }, [checking, verifyPin, onUnlock, onDecoy])

  const tryBio = async () => {
    if (busy.current) return
    busy.current = true
    setBioMsg('Verifying…')
    const r = await verifyBiometric()
    busy.current = false
    if (r.ok) return onUnlock()
    if (r.error === 'not-enrolled') return setBioMsg('Set up fingerprint unlock in Settings first. Use your PIN for now.')
    setBioMsg(r.error ?? 'Not recognised. Use your PIN.')
  }

  const edit = (v: string) => { setPin(v.slice(0, PIN_MAX)); setError(false) }
  const press = (d: string) => { if (!checking && waitMs <= 0) edit(pin + d) }

  // Escape closes the screen when it can be cancelled
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onCancel) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'ok', '0', 'del']

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-[#0B1210] p-6 text-white"
      style={bioUnlock ? { touchAction: 'none' } : undefined}
      onPointerDown={(e) => { startY.current = e.clientY }}
      onPointerUp={(e) => {
        if (bioUnlock && startY.current !== null && startY.current - e.clientY > 70) void tryBio()
        startY.current = null
      }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7CF5C0]/15 text-[#7CF5C0]"><ShieldCheck size={30} /></div>
      <div className="text-center">
        <p className="text-xl font-bold">{title}</p>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void check(pin) }} className="w-64">
        <SecretInput
          value={pin}
          onChange={edit}
          label="PIN"
          placeholder="PIN (4 or more characters)"
          maxLength={PIN_MAX}
          autoFocus={typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches}
          className={`w-full rounded-2xl bg-white/5 px-4 py-3 text-center text-lg tracking-widest text-white outline-none ring-1 transition placeholder:text-sm placeholder:tracking-normal placeholder:text-white/40 ${error ? 'ring-rose-400' : 'ring-[#7CF5C0]/50 focus:ring-[#7CF5C0]'}`}
        />
      </form>
      <p className={`h-4 text-xs ${error || waitMs > 0 ? 'text-rose-400' : 'text-transparent'}`} role="status" aria-live="polite">
        {waitMs > 0 ? `Too many wrong PINs. Try again in ${fmtWait(waitMs)}.` : error ? 'Incorrect PIN' : ' '}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => (k === 'del' ? edit(pin.slice(0, -1)) : k === 'ok' ? void check(pin) : press(k))}
            aria-label={k === 'del' ? 'Delete' : k === 'ok' ? 'Unlock' : `Digit ${k}`}
            disabled={waitMs > 0 || checking || (k === 'ok' && !validPin(pin))}
            className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold ring-1 transition active:scale-95 disabled:opacity-30 ${k === 'ok' ? 'bg-[#7CF5C0] text-black ring-[#7CF5C0]' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}
          >
            {k === 'del' ? <Delete size={20} /> : k === 'ok' ? <Check size={22} /> : k}
          </button>
        ))}
      </div>
      <button onClick={() => void check(pin)} disabled={waitMs > 0 || checking || !validPin(pin)} className="w-64 rounded-2xl bg-[#7CF5C0] py-3 text-sm font-bold text-black transition active:scale-95 disabled:opacity-30">{checking ? 'Checking…' : 'Unlock'}</button>
      {onPassword && <button onClick={onPassword} className="text-xs font-semibold text-white/70 hover:text-white">Use my password instead</button>}
      {bioUnlock && (
        <button onClick={() => void tryBio()} className="flex flex-col items-center gap-1 text-xs text-white/70">
          <Fingerprint size={26} className="text-[#7CF5C0]" />
          <span>{bioMsg || 'Tap or swipe up to use fingerprint or face'}</span>
        </button>
      )}
      {onCancel && <button onClick={onCancel} className="text-sm font-semibold text-white/70 hover:text-white">Cancel</button>}
    </div>
  )
}
