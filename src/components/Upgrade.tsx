import { useState } from 'react'
import { X, Crown, Check, Lock, Brush, Zap, Shield, EyeOff, Smartphone, Film, Calendar, Gamepad2, Languages, Clock, Ban, Sparkles } from 'lucide-react'
import { usePro, type Billing } from '../pro'

const PRICES = { monthly: { price: 2.99, label: '/month' }, yearly: { price: 24.99, label: '/year' } }

const GROUPS = [
  {
    title: 'Elite privacy & security',
    icon: Shield,
    items: [
      { icon: EyeOff, name: 'Unlimited decoy chats', desc: 'A decoy PIN opens a harmless chat history. Free shows 1 decoy chat, Pro shows as many as you like.', live: true },
      { icon: Lock, name: 'Fingerprint & face unlock', desc: 'Swipe up on the lock screen. A fingerprint or face your phone rejects opens your decoy chats. Off until you turn it on.', live: true },
      { icon: Lock, name: 'Locked private messages', desc: 'Biometric or passcode verification for confidential chats.', live: true },
      { icon: Smartphone, name: 'Network camouflage', desc: 'Onion routing that hides your IP address from providers.', live: false },
      { icon: Ban, name: 'Screenshot blockade', desc: 'System-level block on screenshots during Ghost Thread sessions.', live: false },
    ],
  },
  {
    title: 'Premium canvas toolkits',
    icon: Brush,
    items: [
      { icon: Sparkles, name: 'Infinite canvas', desc: 'Pan and zoom in every direction, with no edges.', live: true },
      { icon: Brush, name: 'Rich brush engines', desc: 'Neon, metallic and watercolour-bleed brushes.', live: true },
      { icon: Lock, name: 'Encrypted masterpieces', desc: 'Save password-protected canvases to your device.', live: true },
      { icon: Film, name: 'Shared media & calendar', desc: 'Watch videos and plan dates on the canvas together.', live: true },
      { icon: Gamepad2, name: 'Premium games', desc: 'Connect Four and more turn-based strategy games.', live: true },
    ],
  },
  {
    title: 'Power-user utility',
    icon: Zap,
    items: [
      { icon: Languages, name: 'Voice notes translation', desc: 'Translate voice notes into your language.', live: false },
      { icon: Clock, name: 'Smart focus scheduling', desc: 'Bundle notifications during work hours and meetings.', live: true },
      { icon: Zap, name: 'Stealth file sharing', desc: 'Send up to 5GB disguised as encrypted system files.', live: false },
      { icon: Calendar, name: 'Work calendar sync', desc: 'Auto-hold alerts during scheduled meetings.', live: false },
    ],
  },
]

export default function Upgrade({ onClose }: { onClose: () => void }) {
  const { isPro, plan, billing, setBilling, startTrial, cancelPlan, renewsAt, trialEndsAt } = usePro()
  const [choice, setChoice] = useState<Billing>(billing)
  const [done, setDone] = useState(false)

  const start = () => {
    startTrial(choice)
    setDone(true)
  }

  const tierLabel = plan === 'pro' ? 'Chatter Pro' : 'Free'

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 backdrop-blur-[2px] md:items-center md:p-6" onClick={onClose}>
      <div role="dialog" aria-label="Chatter Pro" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[rgb(var(--bg-panel))] shadow-2xl md:h-auto md:max-h-[92vh] md:rounded-3xl md:ring-1 md:ring-[rgb(var(--border))]">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1210] via-[#13261F] to-[#1B3A2E] px-6 pb-7 pt-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#7CF5C0]/20 blur-3xl" />
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-white/70 hover:bg-white/10"><X size={18} /></button>
          <div className="flex items-center gap-2 text-[#7CF5C0]"><Crown size={18} /><span className="text-xs font-bold uppercase tracking-[0.2em]">Chatter Pro</span></div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Superpowers for private chats</h2>
          <p className="mt-2 max-w-xl text-sm text-white/70">Advanced control, deeper customisation and enhanced security. Pro is more than an ad-free app.</p>
          <p className="mt-3 text-xs font-medium text-white/60">Current plan: <span className="text-white">{tierLabel}</span>{plan === 'pro' && trialEndsAt && Date.now() < trialEndsAt ? ' · 7-day trial active' : ''}</p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {done || isPro ? (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-[rgb(var(--accent-soft))] p-5">
              <div className="flex items-center gap-2 font-bold"><Check size={18} className="text-[rgb(var(--accent))]" /> You’re on Chatter Pro</div>
              <p className="text-sm text-[rgb(var(--text-secondary))]">{renewsAt ? `Renews ${new Date(renewsAt).toLocaleDateString()}.` : ''} Pro features are unlocked across the app.</p>
              <button onClick={() => { cancelPlan(); setDone(false) }} className="self-start text-xs font-semibold text-rose-500 hover:underline">Cancel plan</button>
            </div>
          ) : (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {(['monthly', 'yearly'] as Billing[]).map((b) => (
                <button key={b} onClick={() => { setChoice(b); setBilling(b) }} aria-pressed={choice === b} className={`relative rounded-2xl p-4 text-left ring-1 transition ${choice === b ? 'bg-[rgb(var(--accent-soft))] ring-2 ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}>
                  {b === 'yearly' && <span className="absolute right-3 top-3 rounded-full bg-[rgb(var(--accent))] px-2 py-0.5 text-[10px] font-bold uppercase text-[rgb(var(--accent-foreground))]">Save 33%</span>}
                  <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{b}</p>
                  <p className="mt-1 text-2xl font-extrabold">${PRICES[b].price}<span className="text-sm font-medium text-[rgb(var(--text-secondary))]"> {PRICES[b].label}</span></p>
                  <p className="text-xs text-[rgb(var(--text-secondary))]">{b === 'yearly' ? 'Two months free versus monthly' : 'Cancel anytime'}</p>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-7">
            {GROUPS.map((g) => (
              <section key={g.title}>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-tertiary))]"><g.icon size={14} /> {g.title}</h3>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {g.items.map((it) => (
                    <li key={it.name} className="flex gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bg-panel))] text-[rgb(var(--accent))]"><it.icon size={17} /></div>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{it.name}{!it.live && <span className="rounded-full bg-[rgb(var(--border))] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--text-secondary))]">Mobile app only</span>}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--text-secondary))]">{it.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-6 text-center text-[11px] text-[rgb(var(--text-tertiary))]">Features marked “Mobile app only” need native device capabilities and arrive with the mobile release.</p>
        </div>

        {!isPro && (
          <footer className="border-t border-[rgb(var(--border))] p-4">
            <button onClick={start} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3.5 text-sm font-bold text-[rgb(var(--accent-foreground))] shadow-lg transition hover:opacity-90">
              <Crown size={16} /> Start 7-day free trial · {choice === 'yearly' ? '$24.99/yr' : '$2.99/mo'}
            </button>
            <p className="mt-2 text-center text-[11px] text-[rgb(var(--text-tertiary))]">Payments are not connected yet. Pro features will unlock once billing is live.</p>
          </footer>
        )}
      </div>
    </div>
  )
}
