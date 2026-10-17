import { useCallback, useState, useSyncExternalStore } from 'react'

export type GhostPrefs = {
  lifetime: number // seconds before ink/notes dissolve
  inkWidth: number
  ink: string
  grid: boolean
  exitOnLeave: boolean
  demoFriend: boolean
  /** who may send Ghost Canvas invitations (you still have to accept each one) */
  invites: 'everyone' | 'contacts' | 'off'
}
export type CalPrefs = { sound: boolean; defaultRemind: number }

export type GesturePrefs = {
  swipeReply: boolean
  swipeChat: boolean
  doubleTap: boolean
  longPress: boolean
  edgeBack: boolean
  shakeLock: boolean
}
export const GESTURE_DEFAULT: GesturePrefs = { swipeReply: true, swipeChat: true, doubleTap: true, longPress: true, edgeBack: true, shakeLock: false }

export const GHOST_DEFAULT: GhostPrefs = { lifetime: 10, inkWidth: 4, ink: '#7CF5C0', grid: true, exitOnLeave: true, demoFriend: false, invites: 'everyone' }
export const CAL_DEFAULT: CalPrefs = { sound: true, defaultRemind: 15 }
export const INK_COLORS = ['#7CF5C0', '#FF4FD8', '#7AB8FF', '#FFD95A', '#FFFFFF']

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function usePref<T extends object>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback))
  const update = useCallback(
    (patch: Partial<T>) => {
      setValue((v) => {
        const next = { ...v, ...patch }
        localStorage.setItem(key, JSON.stringify(next))
        return next
      })
    },
    [key],
  )
  const reset = useCallback(() => {
    localStorage.removeItem(key)
    setValue(fallback)
  }, [key, fallback])
  return [value, update, reset] as const
}

export const NOTIF_DEFAULT = { previews: true, quickReply: true }
export const PRIVACY_DEFAULT = { readReceipts: true }
export const readPrivacyPrefs = () => load('chatter.privacy.prefs', PRIVACY_DEFAULT)
export const useNotifPrefs = () => usePref('chatter.notif.prefs', NOTIF_DEFAULT)
export const usePrivacyPrefs = () => usePref('chatter.privacy.prefs', PRIVACY_DEFAULT)
export const readNotifPrefs = () => load('chatter.notif.prefs', NOTIF_DEFAULT)
export const useGhostPrefs = () => usePref('chatter.ghost.prefs', GHOST_DEFAULT)
export const useCalPrefs = () => usePref('chatter.cal.prefs', CAL_DEFAULT)
export const useGesturePrefs = () => usePref('chatter.gesture.prefs', GESTURE_DEFAULT)
export const readGesturePrefs = () => load('chatter.gesture.prefs', GESTURE_DEFAULT)
export const readGhostPrefs = () => load('chatter.ghost.prefs', GHOST_DEFAULT)
export const readCalPrefs = () => load('chatter.cal.prefs', CAL_DEFAULT)

/** Decoy profile only: show every message with its real time, ignoring hand-edited times.
 *  A shared store, so the Settings switch and open chats always agree. */
export const DECOY_PREFS_DEFAULT = { realTimeOnly: false }
const DECOY_KEY = 'chatter.decoy.prefs'
let decoyPrefs = load(DECOY_KEY, DECOY_PREFS_DEFAULT)
const decoySubs = new Set<() => void>()
export const readDecoyPrefs = () => decoyPrefs
export function setDecoyPrefs(patch: Partial<typeof DECOY_PREFS_DEFAULT>) {
  decoyPrefs = { ...decoyPrefs, ...patch }
  try { localStorage.setItem(DECOY_KEY, JSON.stringify(decoyPrefs)) } catch { /* storage full */ }
  decoySubs.forEach((f) => f())
}
export const useDecoyPrefs = () =>
  useSyncExternalStore((cb) => { decoySubs.add(cb); return () => { decoySubs.delete(cb) } }, readDecoyPrefs)
