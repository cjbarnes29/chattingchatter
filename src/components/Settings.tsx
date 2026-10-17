import { useState } from 'react'
import { X, LogOut, Camera, Moon, Sun, Lock, Bell, Eye, ShieldCheck, Check, ChevronRight, ArrowLeft, User, KeyRound, Palette, Hand, Ghost, EyeOff, Crown, LayoutDashboard, Smartphone } from 'lucide-react'
import { useAuth } from '../auth'
import { usePro } from '../pro'
import ProSettings from './ProSettings'
import AccountSettings from './AccountSettings'
import AppearanceSettings from './AppearanceSettings'
import InterfaceSettings from './InterfaceSettings'
import FeatureSettings from './FeatureSettings'
import AppPermissions from './AppPermissions'
import DecoyManager from './DecoyManager'
import { isNative } from '../native'
import { PinGate } from './PinGate'
import { useNotifPrefs, usePrivacyPrefs } from '../prefs'
import { biometricEnabled, setBiometricEnabled, biometricEnrolled, enrollBiometric, verifyBiometric } from '../biometric'

type Props = {
  open: boolean
  onClose: () => void
  dark: boolean
  onToggleDark: () => void
  onUpgrade: () => void
  /** decoy profile: only harmless settings are listed */
  decoy?: boolean
}

type Page = 'profile' | 'account' | 'appearance' | 'interface' | 'privacy' | 'notifications' | 'gestures' | 'ghost' | 'decoy' | 'pro' | 'permissions'

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
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

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="text-xs text-[rgb(var(--text-secondary))]">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

const SubTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-6 px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{children}</h3>
)

export default function Settings({ open, onClose, dark, onToggleDark, onUpgrade, decoy = false }: Props) {
  const { user, logout, updateProfile, uploadAvatar } = useAuth()
  const { hasPins, isPro } = usePro()
  const [page, setPage] = useState<Page | null>(null)
  const [confirmOut, setConfirmOut] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [name, setName] = useState(user?.name ?? '')
  const [about, setAbout] = useState(user?.about ?? '')
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [age, setAge] = useState(user?.age ? String(user.age) : '')
  const [status, setStatus] = useState(user?.status ?? '')
  const [profErr, setProfErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [privacy, setPrivacy] = usePrivacyPrefs()
  const [notifs, setNotifs] = useNotifPrefs()
  const [bioOn, setBioOn] = useState(() => biometricEnabled())
  const [bioMsg, setBioMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (!open || !user) return null

  const close = () => {
    setPage(null)
    onClose()
  }

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setPhotoMsg(null)
    const r = await uploadAvatar(file)
    setPhotoBusy(false)
    setPhotoMsg(r.ok ? { ok: true, text: 'Profile photo updated.' } : { ok: false, text: r.error })
  }

  const toggleBio = async (v: boolean) => {
    setBioMsg(null)
    if (!v) {
      setBiometricEnabled(false)
      setBioOn(false)
      return setBioMsg({ ok: true, text: 'Biometric check is off. Confidential chats will ask for your PIN instead.' })
    }
    const r = biometricEnrolled() ? await verifyBiometric() : await enrollBiometric(user.id, user.email ?? 'chatter')
    if (r.ok) {
      setBiometricEnabled(true)
      setBioOn(true)
      setBioMsg({ ok: true, text: 'Biometric lock is on.' })
    } else setBioMsg({ ok: false, text: r.error ?? 'Could not turn on biometrics.' })
  }
  const save = () => {
    const ageNum = age.trim() ? Number(age) : null
    if (ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 120)) return setProfErr('Age must be a whole number from 13 to 120, or leave it empty.')
    setProfErr('')
    updateProfile({ name: name.trim() || user.name, about: about.trim(), nickname: nickname.trim(), age: ageNum, status: status.trim() })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }
  // Logging out asks for the PIN first whenever one is set
  const requestLogout = () => {
    if (hasPins) setConfirmOut(true)
    else {
      close()
      logout()
    }
  }

  const accField = 'w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]'
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]'
  const divider = 'divide-y divide-[rgb(var(--border))]'

  const MENU: { id: Page; icon: React.ReactNode; title: string; desc: string; hideInDecoy?: boolean }[] = [
    { id: 'profile', icon: <User size={16} />, title: 'Profile', desc: 'Photo, name, nickname, age and status', hideInDecoy: true },
    { id: 'account', icon: <KeyRound size={16} />, title: 'Account', desc: 'Password, email and security question', hideInDecoy: true },
    { id: 'interface', icon: <LayoutDashboard size={16} />, title: 'Interface', desc: 'Theme, layout, navigation, dashboard and presets' },
    { id: 'appearance', icon: dark ? <Moon size={16} /> : <Sun size={16} />, title: 'Appearance', desc: 'Text, colours, chat screen and animations' },
    { id: 'privacy', icon: <ShieldCheck size={16} />, title: 'Privacy & security', desc: 'Receipts, locks, PIN and decoy PIN', hideInDecoy: true },
    { id: 'notifications', icon: <Bell size={16} />, title: 'Notifications & sounds', desc: 'Previews, quick replies, sounds, alarms' },
    ...(isNative() ? [{ id: 'permissions' as const, icon: <Smartphone size={16} />, title: 'App permissions', desc: 'Camera, microphone, notifications, fingerprint' }] : []),
    { id: 'gestures', icon: <Hand size={16} />, title: 'Chats & gestures', desc: 'Swipes, taps and shortcuts' },
    { id: 'ghost', icon: <Palette size={16} />, title: 'Ghost Canvas', desc: 'Ink, fade-out time and grid' },
    { id: 'decoy', icon: <EyeOff size={16} />, title: 'Decoy chats', desc: 'Create and edit the fake chats the decoy PIN shows', hideInDecoy: true },
    { id: 'pro', icon: <Crown size={16} />, title: 'Chatter Pro', desc: isPro ? 'Plan, focus mode and tools' : 'Unlock decoy profiles, canvas toolkit and more', hideInDecoy: true },
  ]
  const items = MENU.filter((m) => !(decoy && m.hideInDecoy))
  const current = MENU.find((m) => m.id === page)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 md:items-center md:p-6" onClick={close}>
      {confirmOut && (
        <PinGate
          title="Confirm log out"
          subtitle="Enter your PIN to log out"
          onCancel={() => setConfirmOut(false)}
          onUnlock={() => { setConfirmOut(false); close(); logout() }}
          onDecoy={() => { setConfirmOut(false); close(); logout() }}
        />
      )}
      <div
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col bg-[rgb(var(--bg-panel))] shadow-2xl md:h-auto md:max-h-[90vh] md:min-h-[32rem] md:rounded-3xl md:ring-1 md:ring-[rgb(var(--border))]"
      >
        <header className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-4 py-4">
          {page && (
            <button onClick={() => setPage(null)} aria-label="Back to settings" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]">
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="flex-1 px-1 text-lg font-extrabold tracking-tight">{current?.title ?? 'Settings'}</h2>
          <button onClick={close} aria-label="Close settings" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-6">
          {!page && (
            <>
              <section className="flex items-center gap-4 px-5 py-5">
                <img src={user.avatar} alt="Your avatar" className="h-16 w-16 rounded-full object-cover ring-4 ring-[rgb(var(--accent-soft))]" />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{user.name}</p>
                  <p className="truncate text-sm text-[rgb(var(--text-secondary))]">{decoy ? 'Chatter' : user.email}</p>
                </div>
              </section>
              <ul className={divider}>
                {items.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => setPage(m.id)} className="flex w-full items-center text-left transition hover:bg-[rgb(var(--bg-panel-soft))]">
                      <div className="flex-1">
                        <Row icon={m.icon} title={m.title} desc={m.desc} />
                      </div>
                      <ChevronRight size={18} className="mr-4 text-[rgb(var(--text-tertiary))]" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-5 pt-6">
                <button onClick={requestLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 py-3 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10">
                  <LogOut size={16} /> Log out
                </button>
                {hasPins && <p className="mt-2 text-center text-[11px] text-[rgb(var(--text-secondary))]">Your PIN is needed to log out.</p>}
              </div>
            </>
          )}

          {page === 'profile' && (
            <>
              <section className="flex flex-col items-center gap-3 px-5 py-6">
                <label className="relative cursor-pointer" aria-label="Change profile photo">
                  <img src={user.avatar} alt="Your avatar" className={`h-24 w-24 rounded-full object-cover ring-4 ring-[rgb(var(--accent-soft))] ${photoBusy ? 'opacity-50' : ''}`} />
                  <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow">
                    <Camera size={14} />
                  </span>
                  <input type="file" accept="image/*" onChange={onPickPhoto} disabled={photoBusy} className="sr-only" />
                </label>
                <p className="text-sm text-[rgb(var(--text-secondary))]">{photoBusy ? 'Uploading photo…' : user.email}</p>
                {photoMsg && <p role="status" className={`text-xs ${photoMsg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{photoMsg.text}</p>}
              </section>
              <section className="space-y-4 px-5">
                <label className="block">
                  <span className={label}>Display name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={accField} />
                </label>
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <label className="block">
                    <span className={label}>Nickname</span>
                    <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} placeholder="What friends call you" className={accField} />
                  </label>
                  <label className="block">
                    <span className={label}>Age</span>
                    <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="—" className={accField} />
                  </label>
                </div>
                <label className="block">
                  <span className={label}>Status</span>
                  <input value={status} onChange={(e) => setStatus(e.target.value)} maxLength={50} placeholder="Available, Busy, At work…" className={accField} />
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {['Available', 'Busy', 'At work', 'In class', 'Sleeping', 'On holiday'].map((s) => (
                      <button key={s} type="button" onClick={() => setStatus(s)} className="rounded-full bg-[rgb(var(--bg-panel-soft))] px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]">{s}</button>
                    ))}
                  </span>
                </label>
                <label className="block">
                  <span className={label}>About</span>
                  <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={2} maxLength={139} className={`${accField} resize-none`} />
                </label>
                {profErr && <p role="alert" className="text-xs text-rose-500">{profErr}</p>}
                <button onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:opacity-90">
                  {saved ? <><Check size={16} /> Saved</> : 'Save profile'}
                </button>
              </section>
            </>
          )}

          {page === 'account' && (
            <AccountSettings />
          )}

          {page === 'interface' && <InterfaceSettings onOpenAppearance={() => setPage('appearance')} onDone={() => setPage(null)} />}
          {page === 'appearance' && <AppearanceSettings dark={dark} onToggleDark={onToggleDark} />}

          {page === 'privacy' && (
            <>
              <div className={divider}>
                <Row icon={<Eye size={16} />} title="Read receipts" desc="Show when you've read messages">
                  <Toggle on={privacy.readReceipts} onChange={(v) => setPrivacy({ readReceipts: v })} label="Read receipts" />
                </Row>
                <div className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]"><ShieldCheck size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Online status</p>
                      <p className="text-xs text-[rgb(var(--text-secondary))]">Choose what your contacts see</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {([
                      ['auto', 'Automatic', 'Online while you use Chatter, then your last-seen time'],
                      ['online', 'Always appear online', 'Contacts see you online even when you are away'],
                      ['offline', 'Appear offline', 'Contacts always see you as offline'],
                    ] as const).map(([id, t, d]) => (
                      <button key={id} aria-pressed={user.presence === id} onClick={() => updateProfile({ presence: id })} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left ring-1 transition ${user.presence === id ? 'bg-[rgb(var(--accent-soft))] ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}>
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ${user.presence === id ? 'ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))]'}`}>{user.presence === id && <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />}</span>
                        <span className="min-w-0"><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-[rgb(var(--text-secondary))]">{d}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
                <Row icon={<Lock size={16} />} title="Fingerprint for confidential chats" desc="Use Face ID, Touch ID or your phone passcode to open confidential chats (your PIN always works too)">
                  <Toggle on={bioOn} onChange={toggleBio} label="Biometric lock" />
                </Row>
                {bioMsg && <p role="status" className={`px-4 py-2 text-xs ${bioMsg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{bioMsg.text}</p>}
              </div>
              <SubTitle>App lock & decoy PIN</SubTitle>
              <ProSettings only="pin" onUpgrade={onUpgrade} />
            </>
          )}

          {page === 'notifications' && (
            <>
              <div className={divider}>
                <Row icon={<Bell size={16} />} title="Message previews" desc="Show the message text in the in-app notification">
                  <Toggle on={notifs.previews} onChange={(v) => setNotifs({ previews: v })} label="Message previews" />
                </Row>
                <Row icon={<Bell size={16} />} title="Quick replies" desc="Pop up a reply panel when a message arrives">
                  <Toggle on={notifs.quickReply} onChange={(v) => setNotifs({ quickReply: v })} label="Quick replies" />
                </Row>
              </div>
              <SubTitle>Sounds</SubTitle>
              <FeatureSettings section="sounds" />
              <SubTitle>Calendar & alarms</SubTitle>
              <FeatureSettings section="calendar" />
            </>
          )}

          {page === 'permissions' && <AppPermissions />}
          {page === 'gestures' && <FeatureSettings section="gestures" />}
          {page === 'ghost' && (
            <>
              <p className="px-5 pt-4 text-xs text-[rgb(var(--text-secondary))]">
                <Ghost size={13} className="mr-1 inline" /> Ghost Canvas is a shared drawing space that fades away. Open any chat and tap the ghost icon at the top to start one.
              </p>
              <FeatureSettings section="ghost" />
            </>
          )}
          {page === 'decoy' && <DecoyManager />}
          {page === 'pro' && <ProSettings only="pro" onUpgrade={onUpgrade} />}
        </div>
      </div>
    </div>
  )
}
