import { useEffect, useState } from 'react'
import { Mic, Camera, Bell, Fingerprint, FolderOpen, Settings as Cog } from 'lucide-react'
import { Device, type DeviceStatus, type PermName } from '../native'
import { ensurePermission } from '../permissions'

const ROWS: { name: PermName; icon: typeof Mic; title: string; desc: string }[] = [
  { name: 'microphone', icon: Mic, title: 'Microphone', desc: 'Calls and voice messages' },
  { name: 'camera', icon: Camera, title: 'Camera', desc: 'Video calls' },
  { name: 'notifications', icon: Bell, title: 'Notifications', desc: 'Event reminders' },
]

const label = (s: string) => (s === 'granted' ? 'Allowed' : s === 'denied' ? 'Not allowed' : 'Not asked yet')

/** Android only: what Chatter can use, with a way to allow each one or change it in phone settings. */
export default function AppPermissions() {
  const [st, setSt] = useState<DeviceStatus | null>(null)

  useEffect(() => {
    // refresh when coming back from phone settings
    const load = () => document.visibilityState === 'visible' && Device.getStatus().then(setSt).catch(() => {})
    load()
    document.addEventListener('visibilitychange', load)
    return () => document.removeEventListener('visibilitychange', load)
  }, [])

  const allow = async (name: PermName) => {
    await ensurePermission(name)
    setSt(await Device.getStatus())
  }

  const row = 'flex items-center gap-3 px-5 py-3.5'
  const bio = st?.biometric
  return (
    <div>
      <p className="px-5 pt-4 text-sm text-[rgb(var(--text-secondary))]">Chatter asks for each of these only when you use the feature. You can change them any time.</p>
      <div className="mt-2 divide-y divide-[rgb(var(--border))]">
        {ROWS.map((r) => {
          const s = st?.[r.name] ?? 'prompt'
          return (
            <div key={r.name} className={row}>
              <r.icon size={18} className="shrink-0 text-[rgb(var(--accent))]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-[rgb(var(--text-secondary))]">{r.desc} · <span className={s === 'granted' ? 'text-[rgb(var(--accent))]' : ''}>{st ? label(s) : '…'}</span></p>
              </div>
              {st && s !== 'granted' && (
                <button onClick={() => allow(r.name)} className="rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))]">
                  {s === 'denied' ? 'Turn on' : 'Allow'}
                </button>
              )}
            </div>
          )
        })}
        <div className={row}>
          <Fingerprint size={18} className="shrink-0 text-[rgb(var(--accent))]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Fingerprint or face</p>
            <p className="text-xs text-[rgb(var(--text-secondary))]">
              {bio === 'available' ? 'Ready. Turn it on in Privacy & security or Chatter Pro.' : bio === 'not-enrolled' ? 'None set up on this phone. Add one in phone settings → Security.' : bio ? 'Not available on this phone.' : '…'} No prompt needed; Chatter never sees your fingerprint or face.
            </p>
          </div>
        </div>
        <div className={row}>
          <FolderOpen size={18} className="shrink-0 text-[rgb(var(--accent))]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Files and photos</p>
            <p className="text-xs text-[rgb(var(--text-secondary))]">No permission needed. You pick each file in Android’s own picker, and Chatter only gets that file.</p>
          </div>
        </div>
      </div>
      <div className="px-5 pt-4">
        <button onClick={() => Device.openSettings()} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]">
          <Cog size={15} /> Open phone settings for Chatter
        </button>
      </div>
    </div>
  )
}
