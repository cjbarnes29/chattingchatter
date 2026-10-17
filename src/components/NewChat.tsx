import { useState } from 'react'
import { X, Mail, Loader2, Users, Ghost } from 'lucide-react'

type Props = {
  onClose: () => void
  onStart: (email: string) => Promise<{ ok: true; chatId: string } | { ok: false; error: string }>
  onOpen: (chatId: string) => void
  onNewGroup: () => void
  onGhost?: () => void
}

export default function NewChat({ onClose, onStart, onOpen, onNewGroup, onGhost }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await onStart(email)
    setBusy(false)
    if (res.ok) {
      onOpen(res.chatId)
      onClose()
    } else setError(res.error)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-[rgb(var(--bg-panel))] p-6 shadow-2xl ring-1 ring-[rgb(var(--border))]"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">New chat</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]">
            <X size={18} />
          </button>
        </div>
        <button type="button" onClick={onNewGroup} className="mb-4 flex w-full items-center gap-3 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-left text-sm font-semibold transition hover:bg-[rgb(var(--accent-soft))]">
          <Users size={18} className="text-[rgb(var(--accent))]" /> New group chat
        </button>
        {onGhost && (
          <button type="button" onClick={onGhost} className="mb-4 flex w-full items-center gap-3 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-left text-sm font-semibold transition hover:bg-[rgb(var(--accent-soft))]">
            <Ghost size={18} className="text-[rgb(var(--accent))]" /> Ghost Canvas with someone
          </button>
        )}
        <p className="mb-4 text-sm text-[rgb(var(--text-secondary))]">Or start a one-to-one chat with a friend’s email or ID#.</p>
        <span className="flex items-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 ring-1 ring-transparent focus-within:ring-[rgb(var(--accent))]">
          <Mail size={16} className="text-[rgb(var(--text-tertiary))]" />
          <input
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com or K7QM-4XZ2"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-tertiary))]"
          />
        </span>
        {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] shadow-md transition hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Start chatting
        </button>
      </form>
    </div>
  )
}
