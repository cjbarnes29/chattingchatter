import { useSyncExternalStore } from 'react'
import { Device, isNative, type PermName } from './native'

/** Runtime permissions on Android, asked only when a feature needs them and always with an
 *  explanation first. If the user has said no (or "don't ask again"), Android won't show its
 *  prompt again, so we explain how to turn it on in phone settings instead. In the browser this
 *  does nothing and the browser's own prompt appears as before. */

export const WHY: Record<PermName, { title: string; text: string }> = {
  microphone: {
    title: 'Allow microphone?',
    text: 'Chatter uses the microphone for voice and video calls. It only listens while you’re on a call.',
  },
  camera: {
    title: 'Allow camera?',
    text: 'Chatter uses the camera for video calls and to take a photo you choose to send. It’s only on while you use it.',
  },
  notifications: {
    title: 'Allow notifications?',
    text: 'Chatter shows a notification when an event reminder you set is due. You can turn this off any time.',
  },
}

export type Ask = { name: PermName; mode: 'ask' | 'blocked'; resolve: (ok: boolean) => void }

let current: Ask | null = null
const subs = new Set<() => void>()
const set = (a: Ask | null) => {
  current = a
  subs.forEach((f) => f())
}
export const usePermissionAsk = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => current,
  )

const show = (name: PermName, mode: Ask['mode']) =>
  new Promise<boolean>((resolve) => {
    current?.resolve(false)
    set({ name, mode, resolve })
  })

/** Called by the dialog's buttons. */
export async function answer(allow: boolean) {
  const a = current
  if (!a) return
  set(null)
  if (!allow) return a.resolve(false)
  if (a.mode === 'blocked') {
    await Device.openSettings()
    return a.resolve(false) // the user tries again after coming back from settings
  }
  const st = await Device.request({ name: a.name })
  if (st[a.name] === 'granted') return a.resolve(true)
  // Said no. If Android won't ask again, offer the settings route straight away.
  if (st[a.name] === 'denied') return a.resolve(await show(a.name, 'blocked'))
  a.resolve(false)
}

/** Resolves true when the permission is granted (asking first if needed). */
export async function ensurePermission(name: PermName): Promise<boolean> {
  if (!isNative()) return true
  try {
    const st = (await Device.getStatus())[name]
    if (st === 'granted') return true
    return await show(name, st === 'denied' ? 'blocked' : 'ask')
  } catch {
    return false
  }
}

/** For getUserMedia callers: throws the same error the browser would when access is refused. */
export async function ensureMedia(video: boolean) {
  const ok = (await ensurePermission('microphone')) && (!video || (await ensurePermission('camera')))
  if (!ok) throw new DOMException('Permission denied', 'NotAllowedError')
}
