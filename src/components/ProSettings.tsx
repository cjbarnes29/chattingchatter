import { createContext, useContext, useRef, useState } from 'react'
import { Crown, Lock, EyeOff, Clock, Trash2, Check, Brush, Fingerprint, Download, Upload, Eye, ShieldOff, Info } from 'lucide-react'
import { usePro, type AutoLock, type Masterpiece } from '../pro'
import { useAuth } from '../auth'
import { bioUnlockEnabled, setBioUnlockEnabled, biometricEnrolled, enrollBiometric, verifyBiometric } from '../biometric'
import { useDecoyItems, updateDecoy } from '../decoyStore'
import { validPin } from '../pinLock'
import { FEATURES, STATUS_LABEL, limit } from '../entitlements'
import MasterpieceViewer from './MasterpieceViewer'
import { saveTextFile } from '../native'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`
const field = 'rounded-xl bg-[rgb(var(--bg-panel))] px-3.5 py-2.5 text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]'

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

const ProBadge = () => (
  <span className="flex items-center gap-1 rounded-full bg-[rgb(var(--accent-soft))] px-2 py-0.5 text-[10px] font-bold uppercase text-[rgb(var(--accent))]"><Crown size={10} /> Pro</span>
)

export default function ProSettings({ onUpgrade, only }: { onUpgrade: () => void; only?: 'pin' | 'pro' }) {
  return (
    <OnlyCtx.Provider value={only}>
      <ProInner onUpgrade={onUpgrade} />
    </OnlyCtx.Provider>
  )
}

function ProInner({ onUpgrade }: { onUpgrade: () => void }) {
  const pro = usePro()
  const { user } = useAuth()
  const only = useContext(OnlyCtx)
  const [bioOn, setBioOn] = useState(() => bioUnlockEnabled())
  const [bioMsg, setBioMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const decoyItems = useDecoyItems()
  const [pin, setPin] = useState('')
  const [decoy, setDecoy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [offPin, setOffPin] = useState('')
  const [offOpen, setOffOpen] = useState(false)
  const [viewing, setViewing] = useState<Masterpiece | null>(null)
  const [mpMsg, setMpMsg] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); window.setTimeout(() => setMsg(null), 2600) }
  const decoyMax = limit('decoyChats', pro.isPro)
  const lockMax = limit('confidentialChats', pro.isPro)

  const savePins = async () => {
    if (!pin && !decoy) return flash(false, pro.hasPins ? 'Enter a new real PIN or a decoy PIN.' : 'Enter a real PIN (4–6 digits).')
    if (!pin && !pro.hasPins) return flash(false, 'Set your real PIN first.')
    if (pin && !validPin(pin)) return flash(false, 'Real PIN must be 4–6 digits.')
    if (decoy && !validPin(decoy)) return flash(false, 'Decoy PIN must be 4–6 digits.')
    if (pin && decoy && pin === decoy) return flash(false, 'Decoy PIN must be different from your real PIN.')
    // compare against the PIN that's already saved, both ways round, without counting as a guess
    if (pin && !decoy && (await pro.matchPin(pin)) === 'decoy') return flash(false, 'That’s your decoy PIN. Pick a different real PIN.')
    if (decoy && !pin && (await pro.matchPin(decoy)) === 'real') return flash(false, 'That’s your real PIN. Pick a different decoy PIN.')
    if (pin) await pro.setRealPin(pin)
    if (decoy) await pro.setDecoyPin(decoy)
    setPin('')
    setDecoy('')
    flash(true, 'Saved.')
  }

  const turnOffPin = async () => {
    if (await pro.removePins(offPin)) {
      setOffPin('')
      setOffOpen(false)
      setBioUnlockEnabled(false)
      setBioOn(false)
      flash(true, 'PIN lock is off. Decoy PIN and chat locks were removed too.')
    } else {
      setOffPin('')
      flash(false, 'That isn’t your current PIN.')
    }
  }

  const toggleBioUnlock = async (v: boolean) => {
    setBioMsg(null)
    if (!pro.isPro) return onUpgrade()
    if (!v) {
      setBioUnlockEnabled(false)
      setBioOn(false)
      return setBioMsg({ ok: true, text: 'Fingerprint unlock is off. Your PIN unlocks Chatter.' })
    }
    if (!pro.hasPins) return setBioMsg({ ok: false, text: 'Set your real PIN first. It stays as the backup.' })
    const r = biometricEnrolled() ? await verifyBiometric() : await enrollBiometric(user?.id ?? 'me', user?.email ?? 'chatter')
    if (r.ok) {
      setBioUnlockEnabled(true)
      setBioOn(true)
      setBioMsg({ ok: true, text: 'On. Tap the fingerprint on the lock screen, or use your PIN.' })
    } else setBioMsg({ ok: false, text: r.error ?? 'Could not turn on fingerprint unlock.' })
  }

  const download = (m: Masterpiece) => {
    const text = pro.exportMasterpiece(m.id)
    if (!text) return
    saveTextFile(`${m.name.replace(/[^\w· -]+/g, '').trim() || 'canvas'}.chatter-canvas.json`, 'application/json', text).catch(() => {})
  }
  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return setMpMsg('That file is too big to be a Chatter canvas.')
    setMpMsg(pro.importMasterpiece(await f.text()) ? 'Imported. Open it with its password.' : 'That isn’t a Chatter masterpiece file.')
  }

  const f = pro.focus
  const overnight = f.startHour > f.endHour

  if (!pro.isPro && only !== 'pin') {
    return (
      <Section title="Chatter Pro">
        <button onClick={onUpgrade} className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-[#0B1210] to-[#1B3A2E] p-4 text-left text-white">
          <Crown size={22} className="text-[#7CF5C0]" />
          <div className="flex-1">
            <p className="font-bold">Unlock Chatter Pro</p>
            <p className="text-xs text-white/70">Unlimited decoy and confidential chats, fingerprint unlock, rich brushes, zoom, encrypted masterpieces and focus scheduling.</p>
          </div>
        </button>
        <p className="text-xs text-[rgb(var(--text-secondary))]">Free includes: PIN lock with wrong-guess limits, 1 decoy chat, 1 confidential chat, auto-lock timer, wrong-PIN alerts, eraser, undo &amp; redo, tic-tac-toe and the shared calendar.</p>
      </Section>
    )
  }

  return (
    <>
      <Section title="Chatter Pro · Active" id="pro">
        <div className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--accent-soft))] p-4">
          <Crown size={18} className="text-[rgb(var(--accent))]" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{pro.trialActive ? 'Free trial' : `${pro.billing === 'yearly' ? 'Yearly' : 'Monthly'} plan`}</p>
            <p className="text-xs text-[rgb(var(--text-secondary))]">{pro.trialActive && pro.trialEndsAt ? `Trial ends ${new Date(pro.trialEndsAt).toLocaleDateString()}` : pro.renewsAt ? `Renews ${new Date(pro.renewsAt).toLocaleDateString()}` : ''}</p>
          </div>
          <button onClick={pro.cancelPlan} className="text-xs font-semibold text-rose-500 hover:underline">Cancel</button>
        </div>
      </Section>

      <Section title="PIN lock & decoy profile" id="pin">
        <div className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock size={15} className="text-[rgb(var(--accent))]" /> PIN lock {pro.hasPins ? <span className="ml-auto flex items-center gap-1 text-xs text-[rgb(var(--accent))]"><Check size={12} /> On</span> : null}</div>
          <p className="mb-3 text-xs text-[rgb(var(--text-secondary))]">Chatter asks for your PIN when it opens and before logging out. After 5 wrong PINs it makes you wait, longer each time. A separate decoy PIN opens a harmless chat history instead of your real one.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={pro.hasPins ? 'New real PIN' : 'Real PIN (4–6 digits)'} aria-label="Real PIN" type="password" className={field} />
            <input inputMode="numeric" value={decoy} onChange={(e) => setDecoy(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={pro.decoyPinHash ? 'New decoy PIN' : 'Decoy PIN (optional)'} aria-label="Decoy PIN" type="password" className={field} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={savePins} className="rounded-xl bg-[rgb(var(--accent))] px-4 py-2 text-xs font-semibold text-[rgb(var(--accent-foreground))]">Save PINs</button>
            {pro.decoyPinHash && <button onClick={pro.clearDecoy} className="flex items-center gap-1 text-xs font-semibold text-rose-500"><EyeOff size={13} /> Remove decoy PIN</button>}
            {pro.hasPins && !offOpen && <button onClick={() => setOffOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-rose-500"><ShieldOff size={13} /> Turn off PIN lock</button>}
            {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{msg.text}</span>}
          </div>
          {offOpen && (
            <form onSubmit={(e) => { e.preventDefault(); void turnOffPin() }} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 p-3">
              <input inputMode="numeric" type="password" value={offPin} onChange={(e) => setOffPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Current real PIN" aria-label="Current real PIN" className={`${field} w-40`} />
              <button type="submit" disabled={offPin.length < 4} className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Turn off</button>
              <button type="button" onClick={() => { setOffOpen(false); setOffPin('') }} className="text-xs font-semibold text-[rgb(var(--text-secondary))]">Cancel</button>
            </form>
          )}

          {pro.hasPins && (
            <div className="mt-4 border-t border-[rgb(var(--border))] pt-3">
              <p className="mb-2 text-sm font-semibold">Lock after leaving Chatter</p>
              <div role="radiogroup" aria-label="Auto-lock" className="flex flex-wrap gap-2">
                {([[0, 'Immediately'], [60, 'After 1 minute'], [300, 'After 5 minutes']] as [AutoLock, string][]).map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={pro.autoLock === v} onClick={() => pro.setAutoLock(v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${pro.autoLock === v ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] text-[rgb(var(--text-secondary))]'}`}>{l}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[rgb(var(--text-secondary))]">Confidential chats always lock again as soon as you leave. You can also add a <strong>Lock now</strong> button in Settings → Interface → Navigation shortcuts.</p>
            </div>
          )}

          <div className="mt-4 border-t border-[rgb(var(--border))] pt-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Lock size={14} className="text-[rgb(var(--accent))]" /> Confidential chats <span className="ml-auto text-xs font-normal text-[rgb(var(--text-secondary))]">{pro.lockedChatIds.length}{Number.isFinite(lockMax) ? ` of ${lockMax}` : ''} locked</span></p>
            <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">Open a chat, tap the palette icon and choose <strong>Make this chat confidential</strong>. It then needs your PIN or fingerprint to open, and its preview and notifications hide the message text. {!pro.isPro && 'Free accounts can lock 1 chat; Pro locks as many as you like.'}</p>
          </div>

          {pro.decoyPinHash && (
            <div className="mt-4 border-t border-[rgb(var(--border))] pt-3">
              <p className="mb-2 text-xs font-semibold">Chats shown under the decoy PIN</p>
              <ul className="space-y-1">
                {decoyItems.length === 0 && <li className="py-1 text-xs text-[rgb(var(--text-secondary))]">No decoy chats. Add some in Settings → Decoy chats.</li>}
                {decoyItems.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-1">
                    <img src={c.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{c.name}</p><p className="truncate text-xs text-[rgb(var(--text-secondary))]">{c.text}</p></div>
                    <Toggle on={!c.hidden} label={`Show ${c.name} in decoy`} onChange={(v) => updateDecoy(c.id, { hidden: !v })} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-[rgb(var(--text-secondary))]">
                {Number.isFinite(decoyMax) ? `Free plan shows the first ${decoyMax} decoy chat. Chatter Pro shows them all.` : 'All visible decoy chats are shown.'} Real chats, contacts, calls and notifications are never loaded in decoy mode.
              </p>
            </div>
          )}

          <div className="mt-4 border-t border-[rgb(var(--border))] pt-3">
            <div className="flex items-center gap-3">
              <Fingerprint size={18} className="shrink-0 text-[rgb(var(--accent))]" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold">Fingerprint &amp; face unlock {!pro.isPro && <ProBadge />}</p>
                <p className="text-xs text-[rgb(var(--text-secondary))]">Unlock the lock screen with your phone’s own check. If it fails or you cancel, nothing opens and your PIN still works. Chatter never sees your fingerprint or face.</p>
              </div>
              <Toggle on={pro.isPro && bioOn} onChange={toggleBioUnlock} label="Fingerprint and face unlock" />
            </div>
            {bioMsg && <p role="status" className={`mt-2 text-xs ${bioMsg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{bioMsg.text}</p>}
          </div>

          <details className="mt-4 border-t border-[rgb(var(--border))] pt-3 text-xs text-[rgb(var(--text-secondary))]">
            <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-[rgb(var(--text-primary))]"><Info size={13} /> What the lock and decoy can and can’t do</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>The PIN lock and decoy live on this device. They stop someone who picks up your phone; they don’t protect a device that’s been fully copied, and anyone signing in to your account elsewhere sees your real chats.</li>
              <li>The decoy only shows the chats you set up. Messages typed there stay on this device.</li>
              <li>PINs are stored as a slow, salted hash, never as the PIN itself. A short PIN can still be guessed with enough time and access, so pick 6 digits if you can.</li>
              <li>Fingerprint unlock is handled by your phone. It’s only as strong as your phone’s screen lock.</li>
            </ul>
          </details>
        </div>
      </Section>

      <Section title="Focus scheduling" id="pro">
        <div className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-[rgb(var(--accent))]" />
            <div className="flex-1"><p className="text-sm font-semibold">Anti-interruption buffer</p><p className="text-xs text-[rgb(var(--text-secondary))]">Hold pop-up notifications and bundle them into one summary.</p></div>
            <Toggle on={f.enabled} onChange={(v) => pro.updateFocus({ enabled: v })} label="Focus scheduling" />
          </div>
          {f.enabled && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={d} aria-pressed={f.days[i]} onClick={() => pro.updateFocus({ days: f.days.map((v, k) => (k === i ? !v : v)) })} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${f.days[i] ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : 'bg-[rgb(var(--bg-panel))] text-[rgb(var(--text-secondary))] ring-1 ring-[rgb(var(--border))]'}`}>{d}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-2">From <select value={f.startHour} onChange={(e) => pro.updateFocus({ startHour: +e.target.value })} className="rounded-lg bg-[rgb(var(--bg-panel))] px-2 py-1 ring-1 ring-[rgb(var(--border))]">{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
                <label className="flex items-center gap-2">to <select value={f.endHour} onChange={(e) => pro.updateFocus({ endHour: +e.target.value })} className="rounded-lg bg-[rgb(var(--bg-panel))] px-2 py-1 ring-1 ring-[rgb(var(--border))]">{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
                {overnight && <span className="text-[rgb(var(--text-secondary))]">Runs overnight, into the next morning</span>}
                {f.startHour === f.endHour && <span className="text-rose-500">Start and end are the same, so focus won’t turn on</span>}
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Let favourites through <span className="block text-xs text-[rgb(var(--text-secondary))]">Messages from favourite chats still pop up</span></span>
                <Toggle on={f.allowFavorites} onChange={(v) => pro.updateFocus({ allowFavorites: v })} label="Let favourites through" />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Meeting mode <span className="block text-xs text-[rgb(var(--text-secondary))]">Hold alerts now, until you turn it off</span></span>
                <Toggle on={f.meetingMode} onChange={(v) => pro.updateFocus({ meetingMode: v })} label="Meeting mode" />
              </div>
              <p className="text-[11px] text-[rgb(var(--text-secondary))]">Event alarms you set in the calendar still ring.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Encrypted masterpieces" id="pro">
        <div className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4 text-sm">
          <Brush size={16} className="text-[rgb(var(--accent))]" />
          <span className="flex-1">{pro.masterpieces.length} saved masterpiece{pro.masterpieces.length === 1 ? '' : 's'} on this device</span>
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--accent))]"><Upload size={13} /> Import</button>
          <input ref={importRef} type="file" accept=".json,application/json" onChange={importFile} className="sr-only" />
        </div>
        {mpMsg && <p role="status" className="px-1 text-xs text-[rgb(var(--text-secondary))]">{mpMsg}</p>}
        {pro.masterpieces.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-xl px-1 text-sm">
            <Lock size={13} className="shrink-0 text-[rgb(var(--text-tertiary))]" />
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            <span className="shrink-0 text-xs text-[rgb(var(--text-tertiary))]">{new Date(m.createdAt).toLocaleDateString()}</span>
            <button onClick={() => setViewing(m)} aria-label={`Open ${m.name}`} title="Open" className="rounded-full p-1.5 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent-soft))]"><Eye size={14} /></button>
            <button onClick={() => download(m)} aria-label={`Download encrypted ${m.name}`} title="Download encrypted file" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]"><Download size={14} /></button>
            <button onClick={() => pro.deleteMasterpiece(m.id)} aria-label={`Delete ${m.name}`} title="Delete" className="rounded-full p-1.5 text-rose-500 hover:bg-rose-500/10"><Trash2 size={14} /></button>
          </div>
        ))}
        <p className="text-[11px] text-[rgb(var(--text-secondary))]">Saved with AES-256 encryption using your password, on this device only, never uploaded. Downloaded files stay encrypted. If you forget the password, the canvas can’t be recovered.</p>
      </Section>

      <Section title="Coming later" id="pro">
        <ul className="space-y-1.5">
          {FEATURES.filter((x) => x.status !== 'live').map((x) => (
            <li key={x.id} className="text-xs text-[rgb(var(--text-secondary))]"><span className="font-semibold text-[rgb(var(--text-primary))]">{x.name}</span> · {STATUS_LABEL[x.status]}</li>
          ))}
        </ul>
      </Section>

      {viewing && <MasterpieceViewer m={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
