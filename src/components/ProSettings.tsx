import { createContext, useContext, useState } from 'react'
import { Crown, Lock, EyeOff, Clock, Trash2, Check, Brush, Languages } from 'lucide-react'
import { usePro } from '../pro'
import { useDecoyItems, updateDecoy } from '../decoyStore'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--border))]'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

const OnlyCtx = createContext<'pin' | 'pro' | undefined>(undefined)

function Section({ title, id, children }: { title: string; id?: 'pin' | 'pro'; children: React.ReactNode }) {
  const only = useContext(OnlyCtx)
  if (id && only && only !== id) return null
  return (
    <>
      <h3 className="mt-6 px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{title}</h3>
      <div className="space-y-3 px-5 pb-2">{children}</div>
    </>
  )
}

export default function ProSettings({ onUpgrade, only }: { onUpgrade: () => void; only?: 'pin' | 'pro' }) {
  return (
    <OnlyCtx.Provider value={only}>
      <ProInner onUpgrade={onUpgrade} />
    </OnlyCtx.Provider>
  )
}

function ProInner({ onUpgrade }: { onUpgrade: () => void }) {
  const pro = usePro()
  const decoyItems = useDecoyItems()
  const [pin, setPin] = useState('')
  const [decoy, setDecoy] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pinSaved, setPinSaved] = useState(false)
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(null), 2000) }

  const savePins = async () => {
    if (!pin && !(pro.hasPins && decoy)) return flash('Enter a real PIN (4–6 digits).')
    if (pin && !/^\d{4,6}$/.test(pin)) return flash('Real PIN must be 4–6 digits.')
    if (decoy && !/^\d{4,6}$/.test(decoy)) return flash('Decoy PIN must be 4–6 digits.')
    if (decoy && decoy === pin) return flash('Decoy PIN must differ from your real PIN.')
    if (decoy && !pin && (await pro.verifyPin(decoy)) === 'real') return flash('Decoy PIN must differ from your real PIN.')
    if (pin) await pro.setRealPin(pin)
    if (decoy) await pro.setDecoyPin(decoy)
    setPin(''); setDecoy(''); setPinSaved(true)
    window.setTimeout(() => setPinSaved(false), 1600)
  }

  const f = pro.focus

  if (!pro.isPro) {
    return (
      <Section title="Chatter Pro">
        <button onClick={onUpgrade} className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-[#0B1210] to-[#1B3A2E] p-4 text-left text-white">
          <Crown size={22} className="text-[#7CF5C0]" />
          <div className="flex-1">
            <p className="font-bold">Unlock Chatter Pro</p>
            <p className="text-xs text-white/70">Decoy profiles, infinite canvas, encrypted masterpieces and focus scheduling.</p>
          </div>
        </button>
      </Section>
    )
  }

  return (
    <>
      <Section title="Chatter Pro · Active" id="pro">
        <div className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--accent-soft))] p-4">
          <Crown size={18} className="text-[rgb(var(--accent))]" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{pro.billing === 'yearly' ? 'Yearly' : 'Monthly'} plan</p>
            <p className="text-xs text-[rgb(var(--text-secondary))]">{pro.renewsAt ? `Renews ${new Date(pro.renewsAt).toLocaleDateString()}` : ''}</p>
          </div>
          <button onClick={pro.cancelPlan} className="text-xs font-semibold text-rose-500 hover:underline">Cancel</button>
        </div>
      </Section>

      <Section title="PIN lock & decoy profile" id="pin">
        <div className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock size={15} className="text-[rgb(var(--accent))]" /> PIN lock {pro.hasPins ? <span className="ml-auto flex items-center gap-1 text-xs text-[rgb(var(--accent))]"><Check size={12} /> Set</span> : null}</div>
          <p className="mb-3 text-xs text-[rgb(var(--text-secondary))]">Chatter asks for your PIN at launch and before logging out. 4-digit PINs are confirmed with the check key. Enter the decoy PIN under pressure to open a harmless chat history.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={pro.hasPins ? 'New real PIN' : 'Real PIN (4–6 digits)'} aria-label="Real PIN" type="password" className="rounded-xl bg-[rgb(var(--bg-panel))] px-3.5 py-2.5 text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]" />
            <input inputMode="numeric" value={decoy} onChange={(e) => setDecoy(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Decoy PIN (optional)" aria-label="Decoy PIN" type="password" className="rounded-xl bg-[rgb(var(--bg-panel))] px-3.5 py-2.5 text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={savePins} className="rounded-xl bg-[rgb(var(--accent))] px-4 py-2 text-xs font-semibold text-[rgb(var(--accent-foreground))]">{pinSaved ? 'Saved' : 'Save PINs'}</button>
            {pro.decoyPinHash && <button onClick={pro.clearDecoy} className="flex items-center gap-1 text-xs font-semibold text-rose-500"><EyeOff size={13} /> Remove decoy</button>}
            {msg && <span className="text-xs text-rose-500">{msg}</span>}
          </div>
          {pro.decoyPinHash && (
            <div className="mt-4 border-t border-[rgb(var(--border))] pt-3">
              <p className="mb-2 text-xs font-semibold">Chats shown under the decoy PIN</p>
              <ul className="space-y-1">
                {decoyItems.length === 0 && <li className="py-1 text-xs text-[rgb(var(--text-secondary))]">No decoy chats. Add some in Settings → Decoy chats.</li>}
                {decoyItems.map((c) => {
                  const on = !c.hidden
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-1">
                      <img src={c.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{c.name}</p><p className="truncate text-xs text-[rgb(var(--text-secondary))]">{c.text}</p></div>
                      <Toggle on={on} label={`Show ${c.name} in decoy`} onChange={(v) => updateDecoy(c.id, { hidden: !v })} />
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-[11px] text-[rgb(var(--text-secondary))]">Your real chats are never shown in decoy mode.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Focus scheduling" id="pro">
        <div className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-[rgb(var(--accent))]" />
            <div className="flex-1"><p className="text-sm font-semibold">Anti-interruption buffer</p><p className="text-xs text-[rgb(var(--text-secondary))]">Hold notifications and bundle them into one summary.</p></div>
            <Toggle on={f.enabled} onChange={(v) => pro.updateFocus({ enabled: v })} label="Focus scheduling" />
          </div>
          {f.enabled && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={d} aria-pressed={f.days[i]} onClick={() => pro.updateFocus({ days: f.days.map((v, k) => (k === i ? !v : v)) })} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${f.days[i] ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : 'bg-[rgb(var(--bg-panel))] text-[rgb(var(--text-secondary))] ring-1 ring-[rgb(var(--border))]'}`}>{d}</button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-2">From <select value={f.startHour} onChange={(e) => pro.updateFocus({ startHour: +e.target.value })} className="rounded-lg bg-[rgb(var(--bg-panel))] px-2 py-1 ring-1 ring-[rgb(var(--border))]">{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
                <label className="flex items-center gap-2">to <select value={f.endHour} onChange={(e) => pro.updateFocus({ endHour: +e.target.value })} className="rounded-lg bg-[rgb(var(--bg-panel))] px-2 py-1 ring-1 ring-[rgb(var(--border))]">{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Meeting mode <span className="text-xs text-[rgb(var(--text-secondary))]">· hold alerts now</span></span>
                <Toggle on={f.meetingMode} onChange={(v) => pro.updateFocus({ meetingMode: v })} label="Meeting mode" />
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Masterpieces & tools" id="pro">
        <div className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4 text-sm">
          <Brush size={16} className="text-[rgb(var(--accent))]" />
          <span className="flex-1">{pro.masterpieces.length} saved masterpiece{pro.masterpieces.length === 1 ? '' : 's'}</span>
          <Languages size={16} className="text-[rgb(var(--text-tertiary))]" />
        </div>
        {pro.masterpieces.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl px-1 text-sm">
            <Lock size={13} className="text-[rgb(var(--text-tertiary))]" />
            <span className="flex-1 truncate">{m.name}</span>
            <span className="text-xs text-[rgb(var(--text-tertiary))]">{new Date(m.createdAt).toLocaleDateString()}</span>
            <button onClick={() => pro.deleteMasterpiece(m.id)} aria-label={`Delete ${m.name}`} className="rounded-full p-1.5 text-rose-500 hover:bg-rose-500/10"><Trash2 size={14} /></button>
          </div>
        ))}
      </Section>

      <Section title="Coming to the mobile app" id="pro">
        <p className="text-xs leading-relaxed text-[rgb(var(--text-secondary))]">Network camouflage, screenshot blockade and stealth file sharing need native device access, so they will arrive with the mobile app.</p>
      </Section>
    </>
  )
}
