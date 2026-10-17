import { useSyncExternalStore } from 'react'

/** Local-only overlay: edits to people, messages, times, tags and reactions. Stored on this device. */
export type MsgEdit = { text?: string; time?: string; deleted?: boolean; reaction?: string; tags?: string[] }
export type PersonEdit = { name?: string; avatar?: string }
export type Edits = { msgs: Record<string, MsgEdit>; people: Record<string, PersonEdit> }

const KEY = 'chatter.edits.v1'
const EMPTY: Edits = { msgs: {}, people: {} }

function read(): Edits {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

let state: Edits = read()
const subs = new Set<() => void>()
const commit = (next: Edits) => {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full */ }
  subs.forEach((f) => f())
}

export const editMessage = (id: string, patch: MsgEdit) =>
  commit({ ...state, msgs: { ...state.msgs, [id]: { ...state.msgs[id], ...patch } } })
export const resetMessage = (id: string) => {
  const rest = { ...state.msgs }
  delete rest[id]
  commit({ ...state, msgs: rest })
}
export const editPerson = (chatId: string, patch: PersonEdit) =>
  commit({ ...state, people: { ...state.people, [chatId]: { ...state.people[chatId], ...patch } } })
export const resetPerson = (chatId: string) => {
  const rest = { ...state.people }
  delete rest[chatId]
  commit({ ...state, people: rest })
}

export function useEdits() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb) } },
    () => state,
  )
}

/** Shrinks a picked photo to a small square data URL so it fits in local storage. */
export function fileToAvatar(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const ctx = c.getContext('2d')!
      const s = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = url
  })
}
