import { useMemo, useState } from 'react'
import { Bell, BellRing, CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { REMIND_OPTIONS, fmtWhen, remindLabel, ensureNotifyPermission, type CalEvent } from '../calendar'
import { readCalPrefs } from '../prefs'

type Props = {
  friend: string
  myId: string
  events: CalEvent[]
  onAdd: (title: string, note: string, startsAt: Date, remind: number) => Promise<{ ok: boolean; error?: string }>
  onDelete: (id: string) => void
  onClose?: () => void
  /** Renders without the modal chrome (used inside Ghost Canvas) */
  inline?: boolean
}

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function CalendarPanel({ friend, myId, events, onAdd, onDelete, onClose, inline }: Props) {
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [sel, setSel] = useState(ymd(today))
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [time, setTime] = useState(() => `${pad(Math.min(23, today.getHours() + 1))}:00`)
  const [remind, setRemind] = useState(() => readCalPrefs().defaultRemind)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [perm, setPerm] = useState<string>(() => ('Notification' in window ? Notification.permission : 'unsupported'))

  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {}
    events.forEach((e) => { (m[ymd(new Date(e.starts_at))] ||= []).push(e) })
    return m
  }, [events])

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  const dayList = byDay[sel] ?? []
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= Date.now() - 3600000).slice(0, 4)

  const submit = async () => {
    setErr(null)
    if (!title.trim()) return setErr('Give the event a name.')
    const when = new Date(`${sel}T${time}`)
    if (Number.isNaN(when.getTime())) return setErr('Pick a valid date and time.')
    if (when.getTime() < Date.now() - 60000) return setErr('That time has already passed.')
    setBusy(true)
    const p = await ensureNotifyPermission()
    setPerm(p)
    const res = await onAdd(title, note, when, remind)
    setBusy(false)
    if (!res.ok) return setErr(res.error ?? 'Could not save.')
    setTitle(''); setNote(''); setAdding(false)
  }

  const field = 'w-full rounded-xl bg-[rgb(var(--bg-panel))] px-3 py-2 text-sm text-[rgb(var(--text-primary))] outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]'

  const body = (
    <div className="text-[rgb(var(--text-primary))]">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" className="rounded-full p-1.5 hover:bg-[rgb(var(--accent-soft))]"><ChevronLeft size={16} /></button>
        <p className="flex-1 text-center text-sm font-bold">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</p>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" className="rounded-full p-1.5 hover:bg-[rgb(var(--accent-soft))]"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {WEEK.map((d, i) => <span key={i} className="py-1 text-[rgb(var(--text-tertiary))]">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const key = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(d)}`
          const has = byDay[key]?.length
          const isSel = key === sel
          const isToday = key === ymd(today)
          return (
            <button key={i} onClick={() => setSel(key)} aria-label={`${key}${has ? `, ${has} events` : ''}`} aria-pressed={isSel} className={`relative rounded-lg py-1.5 text-xs font-medium transition ${isSel ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : isToday ? 'ring-1 ring-[rgb(var(--accent))]' : 'hover:bg-[rgb(var(--accent-soft))]'}`}>
              {d}
              {has ? <span className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSel ? 'bg-[rgb(var(--accent-foreground))]' : 'bg-[rgb(var(--accent))]'}`} /> : null}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{new Date(`${sel}T12:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1 rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))]"><Plus size={13} /> {adding ? 'Cancel' : 'Add event'}</button>
      </div>

      {adding && (
        <div className="mt-3 space-y-2 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={`Event with ${friend} (e.g. Dinner)`} aria-label="Event title" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" className={field} />
            <select value={remind} onChange={(e) => setRemind(+e.target.value)} aria-label="Remind me" className={field}>
              {REMIND_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)" aria-label="Note" className={field} />
          <p className="flex items-start gap-1.5 text-[11px] text-[rgb(var(--text-secondary))]"><BellRing size={12} className="mt-0.5 shrink-0" /> {friend} gets a chat message now, and you both get an alarm and a notification at reminder time.</p>
          {err && <p className="text-xs text-rose-500">{err}</p>}
          <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-[rgb(var(--accent))] py-2 text-sm font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-60">{busy ? 'Saving…' : 'Save & notify'}</button>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {dayList.length === 0 && !adding && <li className="py-2 text-center text-xs text-[rgb(var(--text-secondary))]">Nothing planned this day.</li>}
        {dayList.map((e) => (
          <li key={e.id} className="flex items-start gap-3 rounded-xl bg-[rgb(var(--bg-panel-soft))] p-3">
            <CalendarDays size={16} className="mt-0.5 shrink-0 text-[rgb(var(--accent))]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.title}</p>
              <p className="text-xs text-[rgb(var(--text-secondary))]">{fmtWhen(e.starts_at)} · {e.creator_id === myId ? 'you added' : `${friend} added`}</p>
              {e.note && <p className="mt-0.5 text-xs text-[rgb(var(--text-secondary))]">{e.note}</p>}
              <p className="mt-1 flex items-center gap-1 text-[11px] text-[rgb(var(--text-tertiary))]"><Bell size={11} /> Alarm {remindLabel(e.remind_minutes)}</p>
            </div>
            {e.creator_id === myId && <button onClick={() => onDelete(e.id)} aria-label={`Delete ${e.title}`} className="rounded-full p-1.5 text-rose-500 hover:bg-rose-500/10"><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>

      {upcoming.length > 0 && dayList.length === 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Coming up</p>
          <ul className="space-y-1">
            {upcoming.map((e) => <li key={e.id}><button onClick={() => { const d = new Date(e.starts_at); setSel(ymd(d)); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }} className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[rgb(var(--accent-soft))]">{e.title} · {fmtWhen(e.starts_at)}</button></li>)}
          </ul>
        </div>
      )}

      {perm !== 'granted' && (
        <button onClick={async () => setPerm(await ensureNotifyPermission())} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]">
          <Bell size={13} /> {perm === 'denied' ? 'Notifications are blocked in your browser settings' : perm === 'unsupported' ? 'Notifications are not supported here — in-app alarms still work' : 'Turn on notifications for alarms'}
        </button>
      )}
    </div>
  )

  if (inline) return body

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Shared calendar">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl ring-1 ring-[rgb(var(--border))] sm:rounded-3xl">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-[rgb(var(--accent))]" />
          <h2 className="flex-1 text-base font-extrabold">Calendar with {friend}</h2>
          <button onClick={onClose} aria-label="Close calendar" className="rounded-full p-1.5 hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
        </div>
        {body}
      </div>
    </div>
  )
}
