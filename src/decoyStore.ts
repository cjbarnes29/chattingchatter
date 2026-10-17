import { useSyncExternalStore } from 'react'
import { DECOY_CHATS } from './decoyChats'
import type { Message } from './data'

export type DecoyItem = { id: string; name: string; avatar: string; text: string; time: string; hidden?: boolean }

const LEGACY_KEY = 'chatter.decoy.items.v1'
const LEGACY_TKEY = 'chatter.decoy.threads.v1'
const defaults = (): DecoyItem[] => DECOY_CHATS.map((c, i) => ({ ...c, time: ['09:12', '18:40', '11:05'][i] ?? '12:00' }))

// Decoy chats belong to one account, so two people sharing a device never see each other's.
let owner: string | null = null
const KEY = () => `${LEGACY_KEY}.${owner ?? 'none'}`
const TKEY = () => `${LEGACY_TKEY}.${owner ?? 'none'}`

function readJson<T>(key: string, legacyKey: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
    // first run after this update: the device-wide decoys move to the account that opens them first
    const legacy = localStorage.getItem(legacyKey)
    if (legacy && owner) {
      localStorage.setItem(key, legacy)
      localStorage.removeItem(legacyKey)
      return JSON.parse(legacy) as T
    }
  } catch {
    /* unreadable: start fresh */
  }
  return fallback()
}
const read = () => readJson<DecoyItem[]>(KEY(), LEGACY_KEY, defaults)
const readThreads = () => readJson<Record<string, Message[]>>(TKEY(), LEGACY_TKEY, () => ({}))

let items = read()
let threads = readThreads()
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())
const commit = (next: DecoyItem[]) => {
  items = next
  try { localStorage.setItem(KEY(), JSON.stringify(next)) } catch { /* ignore */ }
  notify()
}
const commitThreads = (next: Record<string, Message[]>) => {
  threads = next
  try { localStorage.setItem(TKEY(), JSON.stringify(next)) } catch { /* ignore */ }
  notify()
}

/** Switch to the signed-in account's decoy chats (call when the user changes). */
export function setDecoyOwner(userId: string | null) {
  if (userId === owner) return
  owner = userId
  items = read()
  threads = readThreads()
  notify()
}

export const DEFAULT_DECOY_IDS = DECOY_CHATS.map((c) => c.id)
export const updateDecoy = (id: string, patch: Partial<DecoyItem>) => commit(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
export const removeDecoy = (id: string) => commit(items.filter((i) => i.id !== id))
export const addDecoy = () =>
  commit([...items, { id: 'c' + Date.now(), name: 'New contact', text: 'See you later!', time: '12:00', avatar: `https://ui-avatars.com/api/?background=7A5C4F&color=fff&bold=true&name=N` }])
export const resetDecoys = () => {
  commitThreads({})
  commit(defaults())
}

/** Messages typed while in decoy mode stay on this device only. */
export const sendDecoyMessage = (id: string, text: string) => {
  const m: Message = {
    id: `${id}-${Date.now()}`,
    fromMe: true,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'delivered',
  }
  commitThreads({ ...threads, [id]: [...(threads[id] ?? []), m] })
}

export const useDecoyItems = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => items)
export const useDecoyThreads = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => threads)

/** What the decoy profile shows as "you": nothing from the real account (name, photo, email) ever appears there. */
export const DECOY_SELF = { name: 'Me', avatar: 'https://ui-avatars.com/api/?background=7A5C4F&color=fff&bold=true&name=Me' }
