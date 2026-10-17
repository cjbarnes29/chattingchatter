import { useMemo, useState } from 'react'
import { X, Ghost, Bell, Phone, Loader2, Search } from 'lucide-react'
import type { Chat } from '../data'
import type { GhostNotify } from '../ghostInvites'

type Props = {
  /** people you can invite (one-to-one chats and contacts with a Chatter account) */
  people: Chat[]
  /** chat id to start on, when opened from a conversation */
  initialId?: string | null
  onClose: () => void
  onInvite: (chatId: string, notify: GhostNotify) => Promise<{ ok: true } | { ok: false; error: string }>
}

/** Step 1 of Ghost Canvas: choose who to connect with and how to let them know. Nothing is shared until they accept. */
export default function GhostLauncher({ people, initialId, onClose, onInvite }: Props) {
  const [picked, setPicked] = useState<string | null>(initialId ?? null)
  const [notify, setNotify] = useState<GhostNotify>('notification')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shown = useMemo(() => people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [people, q])
  const person = people.find((p) => p.id === picked)

  const send = async () => {
    if (!picked) return
    setBusy(true)
    setError(null)
    const r = await onInvite(picked, notify)
    setBusy(false)
    if (r.ok) onClose()
    else setError(r.error)
  }

  return (
    <div className="fixed inset-0 z-50 safe-overlay flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Start Ghost Canvas" onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><Ghost size={18} className="text-[rgb(var(--accent))]" /> Ghost Canvas</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]"><X size={18} /></button>
        </div>
        <p className="mb-3 text-sm text-[rgb(var(--text-secondary))]">Pick who to draw with. They get an invitation and the canvas opens only if they accept.</p>

        <label className="mb-2 flex items-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3 py-2 text-sm">
          <Search size={15} className="text-[rgb(var(--text-tertiary))]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="w-full bg-transparent outline-none" />
        </label>
        <ul role="radiogroup" aria-label="Who to invite" className="mb-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-[rgb(var(--text-secondary))]">No one to invite yet. Start a chat or add a contact first.</li>}
          {shown.map((p) => (
            <li key={p.id}>
              <button role="radio" aria-checked={picked === p.id} onClick={() => setPicked(p.id)} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ring-1 transition ${picked === p.id ? 'bg-[rgb(var(--accent-soft))] ring-[rgb(var(--accent))]' : 'ring-transparent hover:bg-[rgb(var(--bg-panel-soft))]'}`}>
                <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                {p.online && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Online" />}
              </button>
            </li>
          ))}
        </ul>

        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Let them know with</p>
        <div role="radiogroup" aria-label="How to notify" className="mb-3 grid grid-cols-2 gap-2">
          {([['notification', 'Notification', 'A quiet banner', Bell], ['call', 'Call', 'Rings like a call', Phone]] as const).map(([id, label, desc, Icon]) => (
            <button key={id} role="radio" aria-checked={notify === id} onClick={() => setNotify(id)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left ring-1 transition ${notify === id ? 'bg-[rgb(var(--accent-soft))] ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}>
              <Icon size={16} className="shrink-0 text-[rgb(var(--accent))]" />
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-[11px] text-[rgb(var(--text-secondary))]">{desc}</span></span>
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-2 text-sm text-rose-500">{error}</p>}
        <button onClick={send} disabled={!picked || busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] shadow-md transition hover:opacity-90 disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} {person ? `Invite ${person.name.split(' ')[0]}` : 'Choose someone'}
        </button>
      </div>
    </div>
  )
}
