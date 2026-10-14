import { useState } from 'react'
import { X, Loader2, Plus, Trash2, LogOut, Shield, ShieldOff, UserMinus, Pencil, Check } from 'lucide-react'
import { GROUP_COLORS, type Group } from '../social'

const overlay = 'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center'
const card = 'w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-[rgb(var(--bg-panel))] p-6 shadow-2xl ring-1 ring-[rgb(var(--border))]'
const input = 'w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent transition focus:ring-[rgb(var(--accent))] placeholder:text-[rgb(var(--text-tertiary))]'

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]">
        <X size={18} />
      </button>
    </div>
  )
}

function parseEmails(s: string) {
  return [...new Set(s.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)))]
}

export function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, color: string, emails: string[]) => Promise<{ ok: boolean; error?: string; groupId?: string }> }) {
  const [name, setName] = useState('')
  const [emails, setEmails] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Give your group a name.')
    const list = parseEmails(emails)
    if (!list.length) return setError('Add at least one friend’s email.')
    setBusy(true)
    const res = await onCreate(name.trim(), color, list)
    setBusy(false)
    if (res.ok) onClose()
    else setError(res.error ?? 'Could not create the group.')
  }

  return (
    <div className={overlay} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className={card}>
        <Header title="New group" onClose={onClose} />
        <label className="mb-1 block text-xs font-semibold text-[rgb(var(--text-secondary))]">Group name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend plans" className={input} maxLength={60} />
        <label className="mb-1 mt-4 block text-xs font-semibold text-[rgb(var(--text-secondary))]">Add friends by email</label>
        <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} placeholder="amy@example.com, sam@example.com" className={input} />
        <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">Separate emails with commas. They must already have a Chatter account.</p>
        <label className="mb-2 mt-4 block text-xs font-semibold text-[rgb(var(--text-secondary))]">Colour</label>
        <div className="flex gap-2">
          {GROUP_COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-[rgb(var(--bg-panel))] ${color === c ? 'ring-2 ring-[rgb(var(--text-primary))]' : ''}`} style={{ background: c }} />
          ))}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
        <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Create group
        </button>
      </form>
    </div>
  )
}

export function GroupSettingsModal({
  group,
  myId,
  onClose,
  onRename,
  onDelete,
  onLeave,
  onAdd,
  onRemove,
  onRole,
}: {
  group: Group
  myId: string
  onClose: () => void
  onRename: (name: string, color: string) => Promise<void>
  onDelete: () => Promise<void>
  onLeave: () => Promise<void>
  onAdd: (emails: string[]) => Promise<{ ok: boolean; error?: string }>
  onRemove: (userId: string) => Promise<void>
  onRole: (userId: string, role: 'admin' | 'member') => Promise<void>
}) {
  const me = group.members.find((m) => m.id === myId)
  const isAdmin = me?.role === 'admin'
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [adding, setAdding] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null)

  const saveName = async () => {
    if (!name.trim()) return
    await onRename(name.trim(), color)
    setEditing(false)
  }

  const add = async () => {
    setError(null)
    const list = parseEmails(adding)
    if (!list.length) return setError('Enter valid emails.')
    const res = await onAdd(list)
    if (res.ok) setAdding('')
    else setError(res.error ?? 'Could not add.')
  }

  return (
    <div className={overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={card}>
        <Header title="Group settings" onClose={onClose} />

        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: editing ? color : group.color }}>
            {(editing ? name : group.name).slice(0, 1).toUpperCase()}
          </span>
          {editing ? (
            <div className="min-w-0 flex-1 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} maxLength={60} />
              <div className="flex gap-2">
                {GROUP_COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={`h-6 w-6 rounded-full ${color === c ? 'ring-2 ring-[rgb(var(--text-primary))]' : ''}`} style={{ background: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveName} className="flex items-center gap-1 rounded-lg bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))]"><Check size={13} /> Save</button>
                <button onClick={() => { setEditing(false); setName(group.name); setColor(group.color) }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[rgb(var(--text-secondary))]">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{group.name}</p>
              <p className="text-xs text-[rgb(var(--text-secondary))]">{group.members.length} members</p>
            </div>
          )}
          {isAdmin && !editing && (
            <button onClick={() => setEditing(true)} aria-label="Edit group" className="rounded-full p-2 hover:bg-[rgb(var(--bg-panel))]"><Pencil size={16} /></button>
          )}
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))]">Members</h3>
        <ul className="mb-5 space-y-1">
          {group.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <img src={m.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.id === myId ? 'You' : m.name}</p>
                {m.role === 'admin' && <p className="text-[11px] font-medium text-[rgb(var(--accent))]">Admin</p>}
              </div>
              {isAdmin && m.id !== myId && (
                <>
                  <button onClick={() => onRole(m.id, m.role === 'admin' ? 'member' : 'admin')} aria-label={m.role === 'admin' ? 'Remove admin' : 'Make admin'} className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]">
                    {m.role === 'admin' ? <ShieldOff size={15} /> : <Shield size={15} />}
                  </button>
                  <button onClick={() => onRemove(m.id)} aria-label="Remove member" className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10">
                    <UserMinus size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        {isAdmin && (
          <div className="mb-5">
            <label className="mb-1 block text-xs font-semibold text-[rgb(var(--text-secondary))]">Add members by email</label>
            <div className="flex gap-2">
              <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="friend@example.com" className={input} />
              <button onClick={add} aria-label="Add member" className="flex shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent))] px-3 text-[rgb(var(--accent-foreground))]"><Plus size={18} /></button>
            </div>
            {error && <p role="alert" className="mt-2 text-sm text-rose-500">{error}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-[rgb(var(--border))] pt-4">
          {!confirm && (
            <>
              <button onClick={() => setConfirm('leave')} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-500/10"><LogOut size={16} /> Leave group</button>
              {isAdmin && (
                <button onClick={() => setConfirm('delete')} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-500/10"><Trash2 size={16} /> Delete group for everyone</button>
              )}
            </>
          )}
          {confirm && (
            <div className="rounded-xl bg-rose-500/10 p-3">
              <p className="mb-3 text-sm">{confirm === 'delete' ? 'Delete this group and all its messages for everyone?' : 'Leave this group?'}</p>
              <div className="flex gap-2">
                <button onClick={confirm === 'delete' ? onDelete : onLeave} className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white">{confirm === 'delete' ? 'Yes, delete' : 'Yes, leave'}</button>
                <button onClick={() => setConfirm(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-[rgb(var(--text-secondary))]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
