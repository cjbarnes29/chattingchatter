import { useSyncExternalStore } from 'react'

/** Real-account-only privacy options for the Inbox list. Stored per account on this device and never read in the decoy profile. */
export type InboxPrivacy = {
  /** show "Message hidden" instead of the last message text */
  hidePreviews: boolean
  /** show names as "A•••" in the list */
  maskNames: boolean
  /** blur profile photos in the list */
  blurAvatars: boolean
  /** hide unread counts and online dots */
  hideActivity: boolean
  /** blank the screen when Chatter goes to the background */
  shieldOnLeave: boolean
  /** Android only: block screenshots and hide Chatter in the app switcher */
  blockCapture: boolean
}

export const INBOX_PRIVACY_DEFAULT: InboxPrivacy = {
  hidePreviews: false,
  maskNames: false,
  blurAvatars: false,
  hideActivity: false,
  shieldOnLeave: false,
  blockCapture: false,
}

const key = (uid: string) => `chatter.inbox.privacy.${uid}`
const cache = new Map<string, InboxPrivacy>()
const subs = new Set<() => void>()

function read(uid: string): InboxPrivacy {
  let v = cache.get(uid)
  if (!v) {
    let stored: Partial<InboxPrivacy> = {}
    try { stored = JSON.parse(localStorage.getItem(key(uid)) ?? '{}') } catch { /* unreadable: use defaults */ }
    v = { ...INBOX_PRIVACY_DEFAULT, ...stored }
    cache.set(uid, v)
  }
  return v
}

export function setInboxPrivacy(uid: string, patch: Partial<InboxPrivacy>) {
  const next = { ...read(uid), ...patch }
  cache.set(uid, next)
  try { localStorage.setItem(key(uid), JSON.stringify(next)) } catch { /* storage full or blocked: keep it for this session */ }
  subs.forEach((f) => f())
}

export const readInboxPrivacy = read

export function useInboxPrivacy(uid: string): InboxPrivacy {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f) },
    () => read(uid),
  )
}

/** "Alex Smith" -> "A••• S•••" */
export function maskName(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => `${[...w][0]}•••`).join(' ')
}
