import { useState } from 'react'
import { X, Star, Ban, UserMinus, Smartphone, Loader2, UserPlus, Users } from 'lucide-react'
import type { ContactPerson } from '../contacts'

type Props = {
  contacts: ContactPerson[]
  onClose: () => void
  onOpenChat: (peerId: string) => void
  onFavorite: (peerId: string, fav: boolean) => void
  onBlock: (peerId: string, block: boolean) => void
  onRemove: (peerId: string) => void
  onImportPhone: () => Promise<{ ok: true; added: number } | { ok: false; error: string }>
  onAddByEmail: (email: string) => Promise<{ ok: true; peerId: string } | { ok: false; error: string }>
}

export default function ContactsPanel({ contacts, onClose, onOpenChat, onFavorite, onBlock, onRemove, onImportPhone, onAddByEmail }: Props) {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await onAddByEmail(email)
    setBusy(false)
    if (res.ok) {
      setEmail('')
      setMsg({ kind: 'ok', text: 'Contact added.' })
    } else setMsg({ kind: 'err', text: res.error })
  }

  const importPhone = async () => {
    setBusy(true)
    setMsg(null)
    const res = await onImportPhone()
    setBusy(false)
    if (res.ok) setMsg({ kind: 'ok', text: res.added ? `Added ${res.added} registered contact${res.added > 1 ? 's' : ''}.` : 'No registered contacts found in your phone list.' })
    else setMsg({ kind: 'err', text: res.error })
  }

  const favorites = contacts.filter((c) => c.favorite && !c.blocked)
  const others = contacts.filter((c) => !c.favorite && !c.blocked)
  const blocked = contacts.filter((c) => c.blocked)

  const Row = ({ c }: { c: ContactPerson }) => (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[rgb(var(--bg-panel-soft))]">
      <button onClick={() => onOpenChat(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <img src={c.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{c.name}</span>
          <span className="block text-xs text-[rgb(var(--text-tertiary))]">{c.blocked ? 'Blocked' : `Added ${new Date(c.addedAt).toLocaleDateString()}`}</span>
        </span>
      </button>
      <button onClick={() => onFavorite(c.id, !c.favorite)} aria-label={c.favorite ? 'Remove favorite' : 'Add favorite'} className={`rounded-full p-2 ${c.favorite ? 'text-amber-500' : 'text-[rgb(var(--text-tertiary))]'} hover:bg-[rgb(var(--accent-soft))]`}>
        <Star size={16} fill={c.favorite ? 'currentColor' : 'none'} />
      </button>
      <button onClick={() => onBlock(c.id, !c.blocked)} aria-label={c.blocked ? 'Unblock' : 'Block'} className="rounded-full p-2 text-[rgb(var(--text-tertiary))] hover:bg-[rgb(var(--accent-soft))]">
        <Ban size={16} />
      </button>
      <button onClick={() => onRemove(c.id)} aria-label="Remove contact" className="rounded-full p-2 text-[rgb(var(--text-tertiary))] hover:bg-[rgb(var(--accent-soft))]">
        <UserMinus size={16} />
      </button>
    </li>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-[rgb(var(--bg-panel))] shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><Users size={18} className="text-[rgb(var(--accent))]" /> People I added</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]"><X size={18} /></button>
        </div>

        <div className="space-y-3 px-6 pb-4">
          <form onSubmit={add} className="flex gap-2">
            <input
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Add by email or ID#"
              className="min-w-0 flex-1 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]"
            />
            <button type="submit" disabled={busy} aria-label="Add contact" className="flex items-center gap-1.5 rounded-xl bg-[rgb(var(--accent))] px-3.5 text-sm font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Add
            </button>
          </form>
          <button onClick={importPhone} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] py-2.5 text-sm font-semibold transition hover:bg-[rgb(var(--accent-soft))] disabled:opacity-60">
            <Smartphone size={15} /> Add from phone contacts
          </button>
          {msg && <p role="alert" className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-rose-500'}`}>{msg.text}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {contacts.length === 0 && <p className="px-2 py-8 text-center text-sm text-[rgb(var(--text-secondary))]">No contacts yet. Add someone by email, ID# or from your phone.</p>}
          {favorites.length > 0 && (<><p className="px-2 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-[rgb(var(--text-tertiary))]">Favorites</p><ul>{favorites.map((c) => <Row key={c.id} c={c} />)}</ul></>)}
          {others.length > 0 && (<><p className="px-2 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-[rgb(var(--text-tertiary))]">Contacts</p><ul>{others.map((c) => <Row key={c.id} c={c} />)}</ul></>)}
          {blocked.length > 0 && (<><p className="px-2 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-[rgb(var(--text-tertiary))]">Blocked</p><ul>{blocked.map((c) => <Row key={c.id} c={c} />)}</ul></>)}
        </div>
      </div>
    </div>
  )
}
