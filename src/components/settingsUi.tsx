import type { ReactNode } from 'react'

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--border))]'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function Row({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="text-xs leading-snug text-[rgb(var(--text-secondary))]">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

/** A titled card that groups related rows on a settings page. */
export function Group({ title, note, children }: { title?: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      {title && <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{title}</h3>}
      <div className="divide-y divide-[rgb(var(--border))] rounded-2xl bg-[rgb(var(--bg-panel-soft))] px-4">{children}</div>
      {note && <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-[rgb(var(--text-secondary))]">{note}</p>}
    </section>
  )
}

export const sel = 'rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-1.5 text-xs font-medium ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))] outline-none'
export const fld = 'w-full rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-2 text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]'
export const bigFld = 'w-full rounded-xl bg-[rgb(var(--bg-panel))] px-3.5 py-3 text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]'
export const btnPrimary = 'rounded-xl bg-[rgb(var(--accent))] px-4 py-2.5 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:opacity-90 disabled:opacity-60'
export const btnGhost = 'rounded-xl border border-[rgb(var(--border))] px-4 py-2.5 text-sm font-semibold transition hover:bg-[rgb(var(--accent-soft))] disabled:opacity-60'
