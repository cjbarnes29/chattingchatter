import { useRef, useState } from 'react'
import { Check, Delete, Fingerprint, ShieldCheck } from 'lucide-react'
import { usePro } from '../pro'
import { verifyBiometric } from '../biometric'

type Props = {
  onUnlock: () => void
  onDecoy: () => void
  title?: string
  subtitle?: string
  onCancel?: () => void
  /** Pro: swipe up to unlock with fingerprint / face */
  bioUnlock?: boolean
  /** a recognised fingerprint opens Chatter; one the phone rejects opens the decoy chats */
  bioDecoy?: boolean
}

/** Asks for the PIN. Shown at launch for users who set a PIN, and again before logging out.
 *  The real PIN opens Chatter, the decoy PIN opens the harmless decoy profile.
 *  PINs are 4-6 digits: a 6th digit checks automatically, shorter PINs are confirmed with the check key.
 *  With fingerprint unlock on, swiping up asks the phone to check your fingerprint or face. */
export function PinGate({ onUnlock, onDecoy, title = 'Enter your PIN', subtitle = 'Chatter is locked', onCancel, bioUnlock = false, bioDecoy = false }: Props) {
  const { verifyPin } = usePro()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [bioMsg, setBioMsg] = useState('')
  const busy = useRef(false)
  const startY = useRef<number | null>(null)

  const check = async (value: string) => {
    if (checking || value.length < 4) return
    setChecking(true)
    const r = await verifyPin(value)
    if (r === 'real') onUnlock()
    else if (r === 'decoy') onDecoy()
    else {
      setError(true)
      setPin('')
      setChecking(false)
      window.setTimeout(() => setError(false), 1400)
    }
  }

  const tryBio = async () => {
    if (busy.current) return
    busy.current = true
    setBioMsg('Verifying…')
    const r = await verifyBiometric()
    busy.current = false
    if (r.ok) return onUnlock()
    if (r.error === 'not-enrolled') return setBioMsg('Set up fingerprint unlock in Settings first. Use your PIN for now.')
    if (r.denied && bioDecoy) return onDecoy()
    setBioMsg(r.error ?? 'Not recognised. Use your PIN.')
  }

  const press = (d: string) => {
    if (checking || pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length === 6) void check(next)
  }

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
      <div className="flex gap-3" aria-live="polite">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ring-1 transition ${error ? 'bg-rose-400 ring-rose-400' : `ring-[#7CF5C0]/60 ${i < pin.length ? 'bg-[#7CF5C0]' : ''}`}`} />
        ))}
      </div>
      <p className={`h-4 text-xs ${error ? 'text-rose-400' : 'text-transparent'}`}>Incorrect PIN</p>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => (k === 'del' ? setPin((p) => p.slice(0, -1)) : k === 'ok' ? void check(pin) : press(k))}
            aria-label={k === 'del' ? 'Delete' : k === 'ok' ? 'Unlock' : `Digit ${k}`}
            disabled={k === 'ok' && pin.length < 4}
            className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold ring-1 transition active:scale-95 ${k === 'ok' ? 'bg-[#7CF5C0] text-black ring-[#7CF5C0] disabled:opacity-30' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}
          >
            {k === 'del' ? <Delete size={20} /> : k === 'ok' ? <Check size={22} /> : k}
          </button>
        ))}
      </div>
      {bioUnlock && (
        <button onClick={() => void tryBio()} className="flex flex-col items-center gap-1 text-xs text-white/70">
          <Fingerprint size={26} className="animate-bounce text-[#7CF5C0]" />
          <span>{bioMsg || 'Swipe up to use fingerprint or face'}</span>
        </button>
      )}
      {onCancel && <button onClick={onCancel} className="text-sm font-semibold text-white/70 hover:text-white">Cancel</button>}
    </div>
  )
}
