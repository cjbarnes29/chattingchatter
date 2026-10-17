import { Loader2, LogOut, RefreshCw, Send, Clock, WifiOff } from 'lucide-react'
import { fmtElapsed, type Peer, type View } from '../ghostSession'

type Props = {
  view: View
  peer: Peer
  elapsed: number
  /** seconds until another invitation is allowed (0 = allowed) */
  inviteWait: number
  invited: boolean
  /** "Close when I leave" is on, so leaving the screen closes a canvas that has drawings on it */
  willWipeOnLeave: boolean
  onKeepWaiting: () => void
  onReopen: () => void
  onInvite: () => void
  onRetry: () => void
  onExit: () => void
}

const btn = 'flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50'

/** The waiting state for a live Ghost Canvas. It sits over the top of the canvas (not full screen),
 *  so drawing keeps working while you wait. Nothing here closes the canvas except the Exit button. */
export default function GhostWaiting({ view, peer, elapsed, inviteWait, invited, willWipeOnLeave, onKeepWaiting, onReopen, onInvite, onRetry, onExit }: Props) {
  if (view === 'none') return null
  // stop the strokes underneath from starting when a button here is pressed
  const stop = (e: React.PointerEvent) => e.stopPropagation()

  if (view === 'failed') {
    return (
      <div role="alert" onPointerDown={stop} className="absolute left-1/2 top-3 z-20 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl bg-[#101a16] p-4 text-center shadow-2xl ring-1 ring-rose-400/40">
        <WifiOff size={22} className="mx-auto text-rose-300" />
        <p className="mt-2 text-sm font-semibold">Can’t reach the live connection</p>
        <p className="mt-1 text-xs text-white/60">Check your internet, then try again. Your drawing is still here. It isn’t closed.</p>
        <div className="mt-3 flex justify-center gap-2">
          <button onClick={onRetry} className={`${btn} bg-[#7CF5C0] text-black`}><RefreshCw size={13} /> Retry</button>
          <button onClick={onExit} className={`${btn} text-white/80 ring-1 ring-white/20 hover:bg-white/10`}><LogOut size={13} /> Exit Canvas</button>
        </div>
      </div>
    )
  }

  if (view === 'pill') {
    return (
      <button onClick={onReopen} onPointerDown={stop} aria-label="Waiting for the other person. Show options" className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#101a16] px-3.5 py-1.5 text-[11px] font-medium text-white/80 shadow-lg ring-1 ring-white/15 hover:bg-[#16241e]">
        <Loader2 size={12} className="animate-spin text-[#7CF5C0]" />
        {peer === 'away' ? 'Waiting for them to reconnect' : 'Waiting for the other person'} · <span className="tabular-nums">{fmtElapsed(elapsed)}</span>
      </button>
    )
  }

  return (
    <div role="status" aria-live="polite" onPointerDown={stop} className="absolute left-1/2 top-3 z-20 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl bg-[#101a16] p-4 text-center shadow-2xl ring-1 ring-white/15">
      <Clock size={20} className="mx-auto text-[#7CF5C0]" />
      <p className="mt-2 text-sm font-semibold">{peer === 'away' ? 'The other person disconnected. Waiting for them to reconnect…' : 'Waiting for the other person to join…'}</p>
      <p className="mt-1 text-xs text-white/60"><span className="tabular-nums">{fmtElapsed(elapsed)}</span> so far · the canvas stays open until you leave</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button onClick={onKeepWaiting} className={`${btn} bg-[#7CF5C0] text-black`}><Loader2 size={13} className="animate-spin" /> Keep Waiting</button>
        <button onClick={onInvite} disabled={inviteWait > 0} className={`${btn} text-white/90 ring-1 ring-white/25 hover:bg-white/10`} title="Sends a chat message asking them to open Ghost Canvas">
          <Send size={13} /> {inviteWait > 0 ? `Invite sent · again in ${inviteWait}s` : 'Invite Again'}
        </button>
        <button onClick={onExit} className={`${btn} text-white/80 ring-1 ring-white/20 hover:bg-white/10`}><LogOut size={13} /> Exit Canvas</button>
      </div>
      {invited && inviteWait > 0 && <p className="mt-2 text-[11px] text-[#7CF5C0]">Invite sent in your chat.</p>}
      {willWipeOnLeave && <p className="mt-2 text-[11px] text-white/45">Leaving this screen will close the canvas (you can change this in Settings → Ghost Canvas).</p>}
    </div>
  )
}
