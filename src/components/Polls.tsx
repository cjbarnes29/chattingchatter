import { useState } from 'react'
import { X, Loader2, Plus, Trash2, Check, Lock, BarChart3 } from 'lucide-react'
import type { GroupMember, Poll } from '../social'

const overlay = 'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center'
const card = 'w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-[rgb(var(--bg-panel))] p-6 shadow-2xl ring-1 ring-[rgb(var(--border))]'
const input = 'w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent transition focus:ring-[rgb(var(--accent))] placeholder:text-[rgb(var(--text-tertiary))]'

export function CreatePollModal({ onClose, onCreate }: { onClose: () => void; onCreate: (question: string, options: string[], multi: boolean) => Promise<{ ok: boolean; error?: string }> }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [multi, setMulti] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim()) return setError('Ask a question.')
    if (opts.length < 2) return setError('Add at least two options.')
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return setError('Options must be different.')
    setBusy(true)
    const res = await onCreate(question.trim(), opts, multi)
    setBusy(false)
    if (res.ok) onClose()
    else setError(res.error ?? 'Could not create the poll.')
  }

  return (
    <div className={overlay} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">New poll</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]">
            <X size={18} />
          </button>
        </div>
        <label className="mb-1 block text-xs font-semibold text-[rgb(var(--text-secondary))]">Question</label>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Where should we eat Friday?" className={input} maxLength={200} autoFocus />
        <label className="mb-1 mt-4 block text-xs font-semibold text-[rgb(var(--text-secondary))]">Options</label>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={o}
                onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Option ${i + 1}`}
                className={input}
                maxLength={80}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`} className="shrink-0 rounded-xl px-2 text-rose-500 hover:bg-rose-500/10">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button type="button" onClick={() => setOptions((prev) => [...prev, ''])} className="mt-2 flex items-center gap-1 text-sm font-semibold text-[rgb(var(--accent))]">
            <Plus size={15} /> Add option
          </button>
        )}
        <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm">
          <span>Allow multiple answers</span>
          <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
        <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Send poll
        </button>
      </form>
    </div>
  )
}

export function PollCard({ poll, myId, members, canClose, onVote, onClosePoll }: { poll: Poll; myId: string; members: GroupMember[]; canClose: boolean; onVote: (options: number[]) => void; onClosePoll: () => void }) {
  const mine = poll.votes[myId] ?? []
  const voters = Object.keys(poll.votes).filter((u) => poll.votes[u].length > 0)
  const counts = poll.options.map((_, i) => voters.filter((u) => poll.votes[u].includes(i)).length)
  const top = Math.max(0, ...counts)

  const pick = (i: number) => {
    if (poll.closed) return
    if (poll.multi) onVote(mine.includes(i) ? mine.filter((x) => x !== i) : [...mine, i].sort())
    else onVote(mine.includes(i) ? [] : [i])
  }

  return (
    <div className="min-w-[220px]">
      <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--accent))]">
        <BarChart3 size={12} /> Poll{poll.multi ? ' · pick any' : ''}
        {poll.closed && <span className="flex items-center gap-1 text-[rgb(var(--text-secondary))]"><Lock size={10} /> closed</span>}
      </p>
      <p className="mb-2 font-semibold">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((o, i) => {
          const n = counts[i]
          const pct = voters.length ? Math.round((n / voters.length) * 100) : 0
          const chosen = mine.includes(i)
          const who = members.filter((m) => poll.votes[m.id]?.includes(i)).slice(0, 3)
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={poll.closed}
              aria-pressed={chosen}
              className={`relative block w-full overflow-hidden rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${chosen ? 'ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))]'} ${poll.closed ? 'cursor-default' : 'hover:ring-[rgb(var(--accent))]'}`}
            >
              <span className="absolute inset-y-0 left-0 bg-[rgb(var(--accent-soft))] transition-all" style={{ width: `${pct}%` }} />
              <span className="relative flex items-center gap-2">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${poll.multi ? 'rounded' : 'rounded-full'} ring-1 ${chosen ? 'bg-[rgb(var(--accent))] ring-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : 'ring-[rgb(var(--text-tertiary))]'}`}>
                  {chosen && <Check size={11} />}
                </span>
                <span className={`min-w-0 flex-1 break-words ${poll.closed && n === top && n > 0 ? 'font-bold' : ''}`}>{o}</span>
                <span className="flex -space-x-1.5">
                  {who.map((m) => <img key={m.id} src={m.avatar} alt={m.name} title={m.id === myId ? 'You' : m.name} className="h-4 w-4 rounded-full object-cover ring-1 ring-[rgb(var(--bg-panel))]" />)}
                </span>
                <span className="w-7 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--text-secondary))]">{n}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[rgb(var(--text-secondary))]">
        <span>{voters.length} {voters.length === 1 ? 'vote' : 'votes'}</span>
        {canClose && !poll.closed && (
          <button type="button" onClick={onClosePoll} className="font-semibold text-[rgb(var(--accent))] hover:underline">Close poll</button>
        )}
      </div>
    </div>
  )
}
