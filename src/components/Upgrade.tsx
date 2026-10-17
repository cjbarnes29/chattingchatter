import { useState } from 'react'
import { X, Crown, Check, Brush, Zap, Shield } from 'lucide-react'
import { usePro, type Billing } from '../pro'
import { FEATURES, STATUS_LABEL, type Feature } from '../entitlements'

const PRICES = { monthly: { price: 2.99, label: '/month' }, yearly: { price: 24.99, label: '/year' } }
const GROUPS: { id: Feature['group']; title: string; icon: typeof Shield }[] = [
  { id: 'privacy', title: 'Privacy & security', icon: Shield },
  { id: 'canvas', title: 'Ghost Canvas toolkit', icon: Brush },
  { id: 'utility', title: 'Power-user tools', icon: Zap },
]

const tierText = (v: boolean | number) => (v === true ? 'Included' : v === false ? '—' : String(v))

export default function Upgrade({ onClose }: { onClose: () => void }) {
  const { isPro, trialActive, trialUsed, billing, setBilling, startTrial, cancelPlan, renewsAt, trialEndsAt } = usePro()
  const [choice, setChoice] = useState<Billing>(billing)

  return (
    <div className="fixed inset-0 z-[60] safe-overlay flex items-stretch justify-center bg-black/50 backdrop-blur-[2px] md:items-center md:p-6" onClick={onClose}>
      <div role="dialog" aria-label="Chatter Pro" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[rgb(var(--bg-panel))] shadow-2xl md:h-auto md:max-h-[92vh] md:rounded-3xl md:ring-1 md:ring-[rgb(var(--border))]">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1210] via-[#13261F] to-[#1B3A2E] px-6 pb-7 pt-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#7CF5C0]/20 blur-3xl" />
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-white/70 hover:bg-white/10"><X size={18} /></button>
          <div className="flex items-center gap-2 text-[#7CF5C0]"><Crown size={18} /><span className="text-xs font-bold uppercase tracking-[0.2em]">Chatter Pro</span></div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">More control over private chats</h2>
          <p className="mt-2 max-w-xl text-sm text-white/70">Everything below marked “Available” works today. The rest is clearly labelled and isn’t switched on until it’s ready.</p>
          <p className="mt-3 text-xs font-medium text-white/60">
            Current plan: <span className="text-white">{isPro ? (trialActive ? 'Chatter Pro · free trial' : 'Chatter Pro') : 'Free'}</span>
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isPro ? (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-[rgb(var(--accent-soft))] p-5">
              <div className="flex items-center gap-2 font-bold"><Check size={18} className="text-[rgb(var(--accent))]" /> You’re on Chatter Pro</div>
              <p className="text-sm text-[rgb(var(--text-secondary))]">
                {trialActive && trialEndsAt ? `Your free trial ends ${new Date(trialEndsAt).toLocaleDateString()}.` : renewsAt ? `Renews ${new Date(renewsAt).toLocaleDateString()}.` : ''} Pro features are unlocked across the app.
              </p>
              <button onClick={cancelPlan} className="self-start text-xs font-semibold text-rose-500 hover:underline">{trialActive ? 'End trial' : 'Cancel plan'}</button>
            </div>
          ) : (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {(['monthly', 'yearly'] as Billing[]).map((b) => (
                <button key={b} onClick={() => { setChoice(b); setBilling(b) }} aria-pressed={choice === b} className={`relative rounded-2xl p-4 text-left ring-1 transition ${choice === b ? 'bg-[rgb(var(--accent-soft))] ring-2 ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}>
                  {b === 'yearly' && <span className="absolute right-3 top-3 rounded-full bg-[rgb(var(--accent))] px-2 py-0.5 text-[10px] font-bold uppercase text-[rgb(var(--accent-foreground))]">Save 30%</span>}
                  <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{b}</p>
                  <p className="mt-1 text-2xl font-extrabold">${PRICES[b].price}<span className="text-sm font-medium text-[rgb(var(--text-secondary))]"> {PRICES[b].label}</span></p>
                  <p className="text-xs text-[rgb(var(--text-secondary))]">{b === 'yearly' ? 'About $2.08 a month' : 'Cancel anytime'}</p>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-7">
            {GROUPS.map((g) => (
              <section key={g.id}>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-tertiary))]"><g.icon size={14} /> {g.title}</h3>
                <ul className="divide-y divide-[rgb(var(--border))] overflow-hidden rounded-2xl bg-[rgb(var(--bg-panel-soft))]">
                  <li aria-hidden className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--text-tertiary))]"><span>Feature</span><span className="text-center">Free</span><span className="text-center">Pro</span></li>
                  {FEATURES.filter((x) => x.group === g.id).map((x) => (
                    <li key={x.id} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {x.name}
                          {x.status !== 'live' && <span className="rounded-full bg-[rgb(var(--border))] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--text-secondary))]">{STATUS_LABEL[x.status]}</span>}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--text-secondary))]">{x.desc}</p>
                      </div>
                      <span className={`text-center text-xs ${x.status === 'live' ? '' : 'opacity-40'}`}>{x.free === true ? <Check size={15} className="mx-auto text-[rgb(var(--accent))]" aria-label="Included" /> : <span aria-label={x.free === false ? 'Not included' : `${x.free} included`}>{tierText(x.free)}</span>}</span>
                      <span className={`text-center text-xs ${x.status === 'live' ? '' : 'opacity-40'}`}>{x.pro === true ? <Check size={15} className="mx-auto text-[rgb(var(--accent))]" aria-label="Included" /> : tierText(x.pro)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-6 text-center text-[11px] text-[rgb(var(--text-tertiary))]">Features marked “Coming…” need more work or native phone features and are not active yet.</p>
        </div>

        {!isPro && (
          <footer className="border-t border-[rgb(var(--border))] p-4">
            {trialUsed ? (
              <p className="rounded-xl bg-[rgb(var(--bg-panel-soft))] px-4 py-3 text-center text-sm text-[rgb(var(--text-secondary))]">You’ve used your free trial. Paid plans will be available once payments are connected.</p>
            ) : (
              <>
                <button onClick={() => startTrial(choice)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3.5 text-sm font-bold text-[rgb(var(--accent-foreground))] shadow-lg transition hover:opacity-90">
                  <Crown size={16} /> Start 7-day free trial
                </button>
                <p className="mt-2 text-center text-[11px] text-[rgb(var(--text-tertiary))]">No payment is taken. Payments aren’t connected yet; the trial ends on its own after 7 days and can be used once.</p>
              </>
            )}
          </footer>
        )}
      </div>
    </div>
  )
}
