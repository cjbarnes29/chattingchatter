import { LogOut } from 'lucide-react'

export default function ExitDialog({ onStay, onExit }: { onStay: () => void; onExit: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onStay}>
      <div role="alertdialog" aria-label="Exit Chatter" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-[rgb(var(--bg-panel))] p-6 text-center shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]"><LogOut size={22} /></span>
        <h2 className="mt-4 text-lg font-extrabold tracking-tight">Exit Chatter?</h2>
        <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">You will stop receiving live messages until you open the app again.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button autoFocus onClick={onStay} className="rounded-xl bg-[rgb(var(--accent))] py-3 text-sm font-semibold text-[rgb(var(--accent-foreground))]">Stay</button>
          <button onClick={onExit} className="rounded-xl border border-[rgb(var(--border))] py-3 text-sm font-semibold hover:bg-[rgb(var(--bg-panel-soft))]">Exit</button>
        </div>
      </div>
    </div>
  )
}
