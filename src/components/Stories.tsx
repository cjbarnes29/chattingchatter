import { useState } from 'react'
import { X, Plus, Trash2, Pencil, Check, Clock } from 'lucide-react'
import { STORY_EMOJIS, timeAgo, timeLeft, type Story } from '../social'

const DAY_OPTIONS = [
  { days: 1, label: '1 day' },
  { days: 2, label: '2 days' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
]

export function StoriesRow({ stories, myAvatar, onOpen, onCreate }: { stories: Story[]; myAvatar: string; onOpen: (s: Story) => void; onCreate: () => void }) {
  // one bubble per author, showing their newest story
  const byAuthor = new Map<string, Story>()
  stories.forEach((s) => {
    if (!byAuthor.has(s.authorId)) byAuthor.set(s.authorId, s)
  })
  const list = [...byAuthor.values()]
  return (
    <div className="flex gap-4 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none]">
      <button onClick={onCreate} className="flex shrink-0 flex-col items-center gap-1.5">
        <span className="relative">
          <img src={myAvatar} alt="" className="h-14 w-14 rounded-full object-cover opacity-80" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-2 ring-[rgb(var(--bg-panel))]"><Plus size={12} /></span>
        </span>
        <span className="text-[11px] font-medium text-[rgb(var(--text-secondary))]">Your story</span>
      </button>
      {list.map((s) => (
        <button key={s.authorId} onClick={() => onOpen(s)} className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="rounded-full bg-gradient-to-br from-[rgb(var(--accent))] to-amber-400 p-[2px]">
            <img src={s.authorAvatar} alt="" className="h-[52px] w-[52px] rounded-full object-cover ring-2 ring-[rgb(var(--bg-panel))]" />
          </span>
          <span className="max-w-[64px] truncate text-[11px] font-medium">{s.authorName.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )
}

export function StoryComposer({ onClose, onPost }: { onClose: () => void; onPost: (body: string, days: number) => Promise<{ ok: boolean; error?: string }> }) {
  const [body, setBody] = useState('')
  const [days, setDays] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!body.trim()) return setError('Write something for your story first.')
    setBusy(true)
    const res = await onPost(body.trim(), days)
    setBusy(false)
    if (res.ok) onClose()
    else setError(res.error ?? 'Could not post.')
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[rgb(var(--bg-panel))] p-6 shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">New story</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]"><X size={18} /></button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={280}
          rows={4}
          placeholder="Share a moment, a thought or a plan…"
          className="w-full rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4 text-[15px] outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))] placeholder:text-[rgb(var(--text-tertiary))]"
        />
        <p className="mt-1 text-right text-[11px] text-[rgb(var(--text-tertiary))]">{body.length}/280</p>
        <p className="mb-2 mt-3 flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--text-secondary))]"><Clock size={13} /> Visible for</p>
        <div className="grid grid-cols-4 gap-2">
          {DAY_OPTIONS.map((o) => (
            <button
              key={o.days}
              onClick={() => setDays(o.days)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${days === o.days ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
        <button onClick={submit} disabled={busy} className="mt-5 w-full rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-60">Share story</button>
      </div>
    </div>
  )
}

export function StoryViewer({
  story,
  myId,
  onClose,
  onReact,
  onEdit,
  onDelete,
}: {
  story: Story
  myId: string
  onClose: () => void
  onReact: (emoji: string | null) => void
  onEdit: (body: string) => void
  onDelete: () => void
}) {
  const mine = story.authorId === myId
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(story.body)
  const total = Object.values(story.reactions).reduce((a, b) => a + b, 0)
  return (
    <div className="fixed inset-0 z-50 safe-overlay flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative flex w-full max-w-sm flex-col rounded-3xl bg-gradient-to-br from-[#2B1D26] via-[#1C1926] to-[#7A2C1C] p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <img src={story.authorAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{mine ? 'You' : story.authorName}</p>
            <p className="flex items-center gap-1 text-[11px] text-white/70"><Clock size={11} /> {timeAgo(story.createdAt)} · {timeLeft(story.visibleUntil)}</p>
          </div>
          {mine && !editing && (
            <>
              <button onClick={() => setEditing(true)} aria-label="Edit story" className="rounded-full p-2 hover:bg-white/10"><Pencil size={16} /></button>
              <button onClick={onDelete} aria-label="Delete story" className="rounded-full p-2 hover:bg-white/10"><Trash2 size={16} /></button>
            </>
          )}
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10"><X size={16} /></button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={4} className="w-full rounded-2xl bg-white/10 p-4 text-[15px] outline-none" />
            <button onClick={() => { onEdit(text.trim() || story.body); setEditing(false) }} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"><Check size={15} /> Save</button>
          </div>
        ) : (
          <p className="min-h-[120px] whitespace-pre-wrap break-words text-lg leading-relaxed">{story.body}</p>
        )}

        <div className="mt-6 border-t border-white/15 pt-4">
          <p className="mb-2 text-xs text-white/70">{total ? `${total} reaction${total > 1 ? 's' : ''}` : 'React to this story'}</p>
          <div className="flex flex-wrap gap-2">
            {STORY_EMOJIS.map((e) => {
              const count = story.reactions[e] ?? 0
              const active = story.myReaction === e
              return (
                <button
                  key={e}
                  onClick={() => onReact(active ? null : e)}
                  aria-pressed={active}
                  aria-label={`React ${e}`}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-base transition hover:scale-110 ${active ? 'bg-white text-black' : 'bg-white/10'}`}
                >
                  <span>{e}</span>
                  {count > 0 && <span className="text-xs font-semibold">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
