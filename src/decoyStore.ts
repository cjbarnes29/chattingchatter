import { useSyncExternalStore } from 'react'
import { LIMITS, duplicateContact, migrateV1, newContact, newId, sampleContacts, toLocalStamp, validateContacts, type DecoyContact, type DecoyMsg } from './decoyModel'

/** Decoy chats live only on this device, per account, and are never sent anywhere.
 *  v2 keeps whole conversations; v1 (one opening line + typed messages) is migrated on first read. */
const V1_KEY = 'chatter.decoy.items.v1'
const V1_TKEY = 'chatter.decoy.threads.v1'
const V2_KEY = 'chatter.decoy.contacts.v2'

// Decoy chats belong to one account, so two people sharing a device never see each other's.
let owner: string | null = null
const key = (base: string) => `${base}.${owner ?? 'none'}`

function parse(raw: string | null): unknown {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function read(): DecoyContact[] {
  try {
    const v2 = parse(localStorage.getItem(key(V2_KEY)))
    if (v2 !== null) return validateContacts(v2)
    // v1 for this account, or the old device-wide copy (moves to the first account that opens it)
    let items = parse(localStorage.getItem(key(V1_KEY)))
    let threads = parse(localStorage.getItem(key(V1_TKEY)))
    if (items === null && owner) {
      items = parse(localStorage.getItem(V1_KEY))
      threads = parse(localStorage.getItem(V1_TKEY))
      if (items !== null) { localStorage.removeItem(V1_KEY); localStorage.removeItem(V1_TKEY) }
    }
    if (items !== null) {
      const migrated = migrateV1(items, threads)
      localStorage.setItem(key(V2_KEY), JSON.stringify(migrated))
      localStorage.removeItem(key(V1_KEY))
      localStorage.removeItem(key(V1_TKEY))
      return migrated
    }
  } catch {
    /* unreadable: start from the samples */
  }
  return sampleContacts()
}

let contacts = read()
let saveError = false
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())
function commit(next: DecoyContact[]) {
  contacts = next
  try {
    localStorage.setItem(key(V2_KEY), JSON.stringify(next))
    saveError = false
  } catch {
    saveError = true // storage full; the change is kept for this session and the editor says so
  }
  notify()
}
const mapContact = (id: string, f: (c: DecoyContact) => DecoyContact) => commit(contacts.map((c) => (c.id === id ? f(c) : c)))

/** Switch to the signed-in account's decoy chats (call when the user changes). */
export function setDecoyOwner(userId: string | null) {
  if (userId === owner) return
  owner = userId
  contacts = read()
  notify()
}

export const decoySaveFailed = () => saveError

export function addContact(name?: string): DecoyContact | null {
  if (contacts.length >= LIMITS.contacts) return null
  const c = newContact(name)
  commit([...contacts, c])
  return c
}
export function duplicate(id: string): DecoyContact | null {
  const src = contacts.find((c) => c.id === id)
  if (!src || contacts.length >= LIMITS.contacts) return null
  const copy = duplicateContact(src)
  const i = contacts.indexOf(src)
  commit([...contacts.slice(0, i + 1), copy, ...contacts.slice(i + 1)])
  return copy
}
export const updateContact = (id: string, patch: Partial<Omit<DecoyContact, 'id' | 'messages'>>) =>
  mapContact(id, (c) => ({ ...c, ...patch, name: patch.name !== undefined ? patch.name.slice(0, LIMITS.name) : c.name, lastSeen: patch.lastSeen !== undefined ? patch.lastSeen.slice(0, LIMITS.lastSeen) : c.lastSeen }))
export const removeContact = (id: string) => commit(contacts.filter((c) => c.id !== id))
export function moveContact(id: string, dir: -1 | 1) {
  const i = contacts.findIndex((c) => c.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= contacts.length) return
  const next = [...contacts]
  ;[next[i], next[j]] = [next[j], next[i]]
  commit(next)
}
export const resetDecoys = () => commit(sampleContacts())

export function addMessage(contactId: string, m: Partial<DecoyMsg> = {}): DecoyMsg | null {
  const c = contacts.find((x) => x.id === contactId)
  if (!c || c.messages.length >= LIMITS.messages) return null
  const last = c.messages[c.messages.length - 1]
  const msg: DecoyMsg = { id: newId('m'), fromMe: m.fromMe ?? !(last?.fromMe ?? true), text: (m.text ?? '').slice(0, LIMITS.text), at: m.at ?? toLocalStamp(new Date()), status: m.status }
  mapContact(contactId, (x) => ({ ...x, messages: [...x.messages, msg] }))
  return msg
}
export const updateMessage = (contactId: string, msgId: string, patch: Partial<Omit<DecoyMsg, 'id'>>) =>
  mapContact(contactId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch, text: patch.text !== undefined ? patch.text.slice(0, LIMITS.text) : m.text } : m)) }))
export const removeMessage = (contactId: string, msgId: string) => mapContact(contactId, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== msgId) }))

/** Something typed while in decoy mode: kept with that decoy chat, on this device only. */
export const sendDecoyMessage = (contactId: string, text: string) => {
  const t = text.trim()
  if (t) addMessage(contactId, { fromMe: true, text: t, status: 'delivered' })
}

export const useDecoyContacts = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => contacts)
