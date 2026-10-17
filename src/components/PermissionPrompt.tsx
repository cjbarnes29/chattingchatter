import { Mic, Camera, Bell, Settings as Cog } from 'lucide-react'
import { WHY, answer, usePermissionAsk } from '../permissions'

const ICON = { microphone: Mic, camera: Camera, notifications: Bell }
const NAME = { microphone: 'Microphone', camera: 'Camera', notifications: 'Notifications' }

/** Explains a permission before Android's own prompt, or how to turn it on in settings if it's blocked. */
export default function PermissionPrompt() {
  const ask = usePermissionAsk()
  if (!ask) return null
  const Icon = ICON[ask.name]
  const blocked = ask.mode === 'blocked'
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => answer(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="perm-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-[rgb(var(--bg-panel))] p-6 text-center shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]"><Icon size={22} /></span>
        <h2 id="perm-title" className="mt-3 text-base font-bold">{blocked ? `${NAME[ask.name]} is turned off` : WHY[ask.name].title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-secondary))]">{WHY[ask.name].text}</p>
        {blocked && (
          <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-secondary))]">
            To turn it on, open phone settings → <b>Permissions</b> → <b>{NAME[ask.name]}</b> → <b>Allow</b>, then come back and try again.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button autoFocus onClick={() => answer(true)} className="flex items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] py-3 text-sm font-bold text-[rgb(var(--accent-foreground))]">
            {blocked ? <><Cog size={15} /> Open phone settings</> : 'Continue'}
          </button>
          <button onClick={() => answer(false)} className="rounded-xl py-2.5 text-sm font-semibold text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]">Not now</button>
        </div>
      </div>
    </div>
  )
}
