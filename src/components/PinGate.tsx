import { useState } from 'react'
import { Delete, ShieldCheck } from 'lucide-react'
import { usePro } from '../pro'
import { useDecoyItems, DEFAULT_DECOY_IDS } from '../decoyStore'

/** Shown at launch for users who set a PIN. Entering the decoy PIN loads a vanilla profile. */
export function PinGate({ onUnlock, onDecoy }: { onUnlock: () => void; onDecoy: () => void }) {
  const { verifyPin } = usePro()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  const press = async (d: string) => {
    if (checking || pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length >= 4) {
      setChecking(true)
      const r = await verifyPin(next)
      if (r === 'real') onUnlock()
      else if (r === 'decoy') onDecoy()
      else if (next.length === 6) { setError(true); setPin(''); setChecking(false) }
      else setChecking(false)
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-7 bg-[#0B1210] p-6 text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7CF5C0]/15 text-[#7CF5C0]"><ShieldCheck size={30} /></div>
      <div className="text-center">
        <p className="text-xl font-bold">Enter your PIN</p>
        <p className="mt-1 text-sm text-white/60">Chatter is locked</p>
      </div>
      <div className="flex gap-3" aria-live="polite">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ring-1 ring-[#7CF5C0]/60 transition ${i < pin.length ? 'bg-[#7CF5C0]' : ''} ${error ? 'ring-rose-400 bg-rose-400' : ''}`} />
        ))}
      </div>
      <p className={`h-4 text-xs ${error ? 'text-rose-400' : 'text-transparent'}`}>Incorrect PIN</p>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button
              key={i}
              onClick={() => (k === 'del' ? setPin((p) => p.slice(0, -1)) : press(k))}
              aria-label={k === 'del' ? 'Delete' : `Digit ${k}`}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-2xl font-semibold ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
            >
              {k === 'del' ? <Delete size={20} /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

/** Harmless chat list shown under the decoy PIN. Only the threads the user marked as decoy are visible. */
export function DecoyChats({ onExit }: { onExit: () => void }) {
  const { decoyChatIds } = usePro()
  const items = useDecoyItems()
  const visible = items.filter((c) => !DEFAULT_DECOY_IDS.includes(c.id) || decoyChatIds.includes(c.id))
  return (
    <div className="flex h-screen w-full flex-col bg-[rgb(var(--bg-panel))]">
      <header className="flex items-center justify-between border-b border-[rgb(var(--border))] px-5 py-4">
        <h1 className="text-lg font-extrabold tracking-tight">Chats</h1>
        <button onClick={onExit} className="text-xs font-semibold text-[rgb(var(--text-secondary))]">Lock</button>
      </header>
      <ul className="flex-1 overflow-y-auto p-2">
        {visible.length === 0 && <li className="p-4 text-sm text-[rgb(var(--text-secondary))]">No chats yet.</li>}
        {visible.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-3">
            <img src={c.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{c.name}</p>
                <span className="shrink-0 text-xs text-[rgb(var(--text-tertiary))]">{c.time}</span>
              </div>
              <p className="truncate text-sm text-[rgb(var(--text-secondary))]">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
