import { useState } from 'react'
import { X, LogOut, Camera, Moon, Sun, Lock, Bell, Eye, ShieldCheck, Check } from 'lucide-react'
import { useAuth } from '../auth'
import ProSettings from './ProSettings'
import FeatureSettings from './FeatureSettings'
import { biometricEnabled, setBiometricEnabled, biometricEnrolled, enrollBiometric, verifyBiometric } from '../biometric'

type Props = {
  open: boolean
  onClose: () => void
  dark: boolean
  onToggleDark: () => void
  onUpgrade: () => void
}

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

export default function Settings({ open, onClose, dark, onToggleDark, onUpgrade }: Props) {
  const { user, logout, updateProfile, setNewPassword, changeEmail, uploadAvatar } = useAuth()
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null)

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
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [emMsg, setEmMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [acctBusy, setAcctBusy] = useState(false)

  const doPassword = async () => {
    if (newPw !== newPw2) return setPwMsg({ ok: false, text: 'Passwords do not match.' })
    setAcctBusy(true)
    const r = await setNewPassword(newPw)
    setAcctBusy(false)
    if (r.ok) {
      setPwMsg({ ok: true, text: 'Password updated.' })
      setNewPw('')
      setNewPw2('')
    } else setPwMsg({ ok: false, text: r.error })
  }
  const doEmail = async () => {
    setAcctBusy(true)
    const r = await changeEmail(newEmail)
    setAcctBusy(false)
    if (r.ok) {
      setEmMsg({ ok: true, text: `Confirmation sent. Check ${newEmail.trim()} (and your current inbox) to finish the change.` })
      setNewEmail('')
    } else setEmMsg({ ok: false, text: r.error })
  }
  const accField = 'w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]'
  const accBtn = 'w-full rounded-xl border border-[rgb(var(--border))] py-2.5 text-sm font-semibold transition hover:bg-[rgb(var(--accent-soft))] disabled:opacity-60'
  const [name, setName] = useState(user?.name ?? '')
  const [about, setAbout] = useState(user?.about ?? '')
  const [saved, setSaved] = useState(false)
  const [privacy, setPrivacy] = useState({ readReceipts: true, lastSeen: true, biometric: true })
  const [bioOn, setBioOn] = useState(() => biometricEnabled())
  const [bioMsg, setBioMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const toggleBio = async (v: boolean) => {
    setBioMsg(null)
    if (!v) {
      setBiometricEnabled(false)
      setBioOn(false)
      return setBioMsg({ ok: true, text: 'Biometric lock is off. Private messages unlock with a tap.' })
    }
    const r = biometricEnrolled() ? await verifyBiometric() : await enrollBiometric(user?.id ?? 'me', user?.email ?? 'chatter')
    if (r.ok) {
      setBiometricEnabled(true)
      setBioOn(true)
      setBioMsg({ ok: true, text: 'Biometric lock is on.' })
    } else setBioMsg({ ok: false, text: r.error ?? 'Could not turn on biometrics.' })
  }
  const [notifs, setNotifs] = useState({ previews: true, sounds: false, quickReply: true })

  if (!open || !user) return null

  const save = () => {
    updateProfile({ name: name.trim() || user.name, about: about.trim() })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 backdrop-blur-[2px] md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col bg-[rgb(var(--bg-panel))] shadow-2xl md:h-auto md:max-h-[90vh] md:rounded-3xl md:ring-1 md:ring-[rgb(var(--border))]"
      >
        <header className="flex items-center justify-between border-b border-[rgb(var(--border))] px-5 py-4">
          <h2 className="text-lg font-extrabold tracking-tight">Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-6">
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
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">About</span>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={2}
                maxLength={139}
                className="w-full resize-none rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]"
              />
            </label>
            <button
              onClick={save}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:opacity-90"
            >
              {saved ? <><Check size={16} /> Saved</> : 'Save profile'}
            </button>
          </section>

          <h3 className="mt-6 px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Account</h3>
          <div className="space-y-6 px-5">
            <div className="space-y-2.5">
              <p className="text-sm font-semibold">Change email</p>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" autoComplete="email" className={accField} />
              {emMsg && <p className={`text-xs ${emMsg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{emMsg.text}</p>}
              <button onClick={doEmail} disabled={acctBusy || !newEmail} className={accBtn}>Update email</button>
            </div>
            <div className="space-y-2.5">
              <p className="text-sm font-semibold">Change password</p>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password" autoComplete="new-password" className={accField} />
              <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" className={accField} />
              {pwMsg && <p className={`text-xs ${pwMsg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{pwMsg.text}</p>}
              <button onClick={doPassword} disabled={acctBusy || !newPw} className={accBtn}>Update password</button>
            </div>
          </div>

          <h3 className="mt-6 px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Appearance</h3>
          <div className="divide-y divide-[rgb(var(--border))]">
            <Row icon={dark ? <Moon size={16} /> : <Sun size={16} />} title="Dark mode" desc="Easier on the eyes at night">
              <Toggle on={dark} onChange={onToggleDark} label="Dark mode" />
            </Row>
          </div>

          <h3 className="mt-6 px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Privacy</h3>
          <div className="divide-y divide-[rgb(var(--border))]">
            <Row icon={<Eye size={16} />} title="Read receipts" desc="Show when you've read messages">
              <Toggle on={privacy.readReceipts} onChange={(v) => setPrivacy((p) => ({ ...p, readReceipts: v }))} label="Read receipts" />
            </Row>
            <Row icon={<ShieldCheck size={16} />} title="Last seen" desc="Let contacts see when you were active">
              <Toggle on={privacy.lastSeen} onChange={(v) => setPrivacy((p) => ({ ...p, lastSeen: v }))} label="Last seen" />
            </Row>
            <Row icon={<Lock size={16} />} title="Biometric lock" desc="Require Face ID, Touch ID or passcode for locked chats">
              <Toggle on={bioOn} onChange={toggleBio} label="Biometric lock" />
            </Row>
            {bioMsg && <p role="status" className={`px-4 py-2 text-xs ${bioMsg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{bioMsg.text}</p>}
          </div>

          <h3 className="mt-6 px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Notifications</h3>
          <div className="divide-y divide-[rgb(var(--border))]">
            <Row icon={<Bell size={16} />} title="Message previews" desc="Show message text in notifications">
              <Toggle on={notifs.previews} onChange={(v) => setNotifs((n) => ({ ...n, previews: v }))} label="Message previews" />
            </Row>
            <Row icon={<Bell size={16} />} title="Quick replies" desc="Reply from the notification panel">
              <Toggle on={notifs.quickReply} onChange={(v) => setNotifs((n) => ({ ...n, quickReply: v }))} label="Quick replies" />
            </Row>
            <Row icon={<Bell size={16} />} title="Sounds" desc="Play a sound for new messages">
              <Toggle on={notifs.sounds} onChange={(v) => setNotifs((n) => ({ ...n, sounds: v }))} label="Sounds" />
            </Row>
          </div>

          <FeatureSettings />

          <ProSettings onUpgrade={onUpgrade} />

          <div className="px-5 pt-6">
            <button
              onClick={() => {
                onClose()
                logout()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 py-3 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
