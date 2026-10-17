import { Ghost, Phone, PhoneOff, Check, X, Loader2 } from 'lucide-react'
import type { GhostNotify } from '../ghostInvites'

type Props = {
  incoming: boolean
  outgoing: boolean
  notify: GhostNotify | null
  name: string
  avatar: string
  onAccept: () => void
  onDecline: () => void
  onCancel: () => void
}

/** Invitation UI for Ghost Canvas: a call-style ring or a quiet banner for the invited person,
 *  and a small "waiting" bar for the person who sent it. */
export default function GhostInviteOverlay({ incoming, outgoing, notify, name, avatar, onAccept, onDecline, onCancel }: Props) {
  if (incoming && notify === 'call') {
    return (
      <div role="alertdialog" aria-label={`Ghost Canvas invitation from ${name}`} className="fixed inset-0 z-[65] safe-overlay flex flex-col items-center justify-center gap-6 bg-[#0B1210]/95 p-6 text-center text-white backdrop-blur-sm">
        <span className="relative">
          <img src={avatar} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-[#7CF5C0]/50" />
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#7CF5C0] text-black"><Ghost size={18} /></span>
        </span>
        <div>
          <p className="text-xl font-bold">{name}</p>
          <p className="mt-1 text-sm text-white/70">wants to draw with you on Ghost Canvas</p>
        </div>
        <div className="flex items-center gap-10">
          <button onClick={onDecline} aria-label="Decline Ghost Canvas" className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:scale-105"><PhoneOff size={26} /></button>
          <button onClick={onAccept} aria-label="Join Ghost Canvas" className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:scale-105"><Phone size={26} /></button>
        </div>
      </div>
    )
  }
  if (incoming) {
    return (
      <div role="alert" className="fixed left-1/2 top-[calc(var(--sat)+0.75rem)] z-[65] flex w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101a16] p-3 text-white shadow-2xl ring-1 ring-[#7CF5C0]/40">
        <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-xs text-white/70">invited you to a Ghost Canvas</p>
        </div>
        <button onClick={onDecline} aria-label="Decline Ghost Canvas" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><X size={16} /></button>
        <button onClick={onAccept} aria-label="Join Ghost Canvas" className="flex h-9 items-center gap-1 rounded-full bg-[#7CF5C0] px-3 text-xs font-bold text-black"><Check size={14} /> Join</button>
      </div>
    )
  }
  if (outgoing) {
    return (
      <div role="status" className="fixed left-1/2 top-[calc(var(--sat)+0.75rem)] z-[65] flex w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101a16] p-3 text-white shadow-2xl ring-1 ring-white/15">
        <Loader2 size={18} className="animate-spin text-[#7CF5C0]" />
        <p className="min-w-0 flex-1 truncate text-sm">Waiting for {name} to accept…</p>
        <button onClick={onCancel} className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-white/30 hover:bg-white/10">Cancel</button>
      </div>
    )
  }
  return null
}
