import { useSyncExternalStore } from 'react'
import { DECOY_CHATS } from './decoyChats'
import type { Message } from './data'

export type DecoyItem = { id: string; name: string; avatar: string; text: string; time: string; hidden?: boolean }

const KEY = 'chatter.decoy.items.v1'
const TKEY = 'chatter.decoy.threads.v1'
const defaults = (): DecoyItem[] => DECOY_CHATS.map((c, i) => ({ ...c, time: ['09:12', '18:40', '11:05'][i] ?? '12:00' }))

function read(): DecoyItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DecoyItem[]) : defaults()
  } catch {
    return defaults()
  }
}

function readThreads(): Record<string, Message[]> {
  try {
    const raw = localStorage.getItem(TKEY)
    return raw ? (JSON.parse(raw) as Record<string, Message[]>) : {}
  } catch {
    return {}
  }
}

let items = read()
let threads = readThreads()
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())
const commit = (next: DecoyItem[]) => {
  items = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  notify()
}
const commitThreads = (next: Record<string, Message[]>) => {
  threads = next
  try { localStorage.setItem(TKEY, JSON.stringify(next)) } catch { /* ignore */ }
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
