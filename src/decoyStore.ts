import { useSyncExternalStore } from 'react'
import { DECOY_CHATS } from './decoyChats'

export type DecoyItem = { id: string; name: string; avatar: string; text: string; time: string }

const KEY = 'chatter.decoy.items.v1'
const defaults = (): DecoyItem[] => DECOY_CHATS.map((c, i) => ({ ...c, time: ['09:12', '18:40', '11:05'][i] ?? '12:00' }))

function read(): DecoyItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DecoyItem[]) : defaults()
  } catch {
    return defaults()
  }
}

let items = read()
const subs = new Set<() => void>()
const commit = (next: DecoyItem[]) => {
  items = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  subs.forEach((f) => f())
}

export const DEFAULT_DECOY_IDS = DECOY_CHATS.map((c) => c.id)
export const updateDecoy = (id: string, patch: Partial<DecoyItem>) => commit(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
export const removeDecoy = (id: string) => commit(items.filter((i) => i.id !== id))
export const addDecoy = () =>
  commit([...items, { id: 'c' + Date.now(), name: 'New contact', text: 'See you later!', time: '12:00', avatar: `https://ui-avatars.com/api/?background=7A5C4F&color=fff&bold=true&name=N` }])
export const resetDecoys = () => commit(defaults())

export const useDecoyItems = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => items)
