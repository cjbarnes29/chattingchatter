import { X, Pencil } from 'lucide-react'
import type { Chat } from '../data'

/** Full-screen photo: tap the picture in a chat header to see it large. */
export function PhotoZoom({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-label={`${name}'s photo`} className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-black/90 p-5" onClick={onClose}>
      <button onClick={onClose} aria-label="Close photo" className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"><X size={20} /></button>
      <img src={src} alt={name} onClick={(e) => e.stopPropagation()} className="max-h-[78vh] max-w-full rounded-3xl object-contain shadow-2xl" />
      <p className="text-sm font-semibold text-white/85">{name}</p>
    </div>
  )
}

const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
  value === undefined || value === null || value === '' ? null : (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{label}</span>
      <span className="min-w-0 break-words text-right text-sm">{value}</span>
    </div>
  )

/** A contact's profile card: name, nickname, age, status, about and whether they are online. */
export function ProfileSheet({ chat, onClose, onZoom, onEditContact }: { chat: Chat; onClose: () => void; onZoom: () => void; onEditContact: () => void }) {
  const p = chat.profile
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-label={`${chat.name}'s profile`} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl ring-1 ring-[rgb(var(--border))] sm:rounded-3xl">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center gap-2 pb-4 text-center">
          <button onClick={onZoom} aria-label="View photo large" className="rounded-full transition hover:opacity-90">
            <img src={chat.avatar} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-[rgb(var(--accent-soft))]" />
          </button>
          <h3 className="text-xl font-extrabold tracking-tight">{chat.name}</h3>
          {p?.nickname ? <p className="text-sm text-[rgb(var(--text-secondary))]">“{p.nickname}”</p> : null}
          <p className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-secondary))]">
            <span className={`h-2 w-2 rounded-full ${chat.online ? 'bg-emerald-500' : 'bg-[rgb(var(--text-tertiary))]'}`} />
            {chat.isGroup ? chat.lastSeen : chat.online ? 'online' : chat.lastSeen ?? 'offline'}
          </p>
          {p?.status ? <span className="mt-1 rounded-full bg-[rgb(var(--accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--accent))]">{p.status}</span> : null}
        </div>
        <div className="divide-y divide-[rgb(var(--border))] border-t border-[rgb(var(--border))]">
          <Row label="About" value={p?.about || (chat.isGroup ? '' : 'Hey there! I am using Chatter.')} />
          <Row label="Nickname" value={p?.nickname} />
          <Row label="Age" value={p?.age} />
        </div>
        <button onClick={onEditContact} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[rgb(var(--border))] py-2.5 text-sm font-semibold hover:bg-[rgb(var(--accent-soft))]">
          <Pencil size={14} /> Rename or change photo on this device
        </button>
      </div>
    </div>
  )
}
