import type { StoryEdits } from './storyMaker'

/** Story drafts (photos + edits, in IndexedDB), reusable edit templates and the close-friends list,
 *  all kept on this device per account. */

export type Audience = 'contacts' | 'close' | 'only' | 'except'
export const AUDIENCES: { id: Audience; label: string; desc: string }[] = [
  { id: 'contacts', label: 'Everyone I chat with', desc: 'People you have a chat or group with' },
  { id: 'close', label: 'Close friends', desc: 'Only the people on your close-friends list' },
  { id: 'only', label: 'Only…', desc: 'Only the people you pick' },
  { id: 'except', label: 'Everyone except…', desc: 'Everyone you chat with, minus the people you pick' },
]

export type Draft = { id: string; owner: string; updatedAt: number; photos: Blob[]; edits: StoryEdits; caption: string; audience: Audience; picked: string[]; days: number; format?: 'gif' | 'picture'; music?: Blob; musicName?: string; video?: Blob }
export type Template = { id: string; name: string; edits: StoryEdits }

const DB = 'chatter-story-drafts'
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('drafts', { keyPath: 'id' })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction('drafts', mode)
    const r = f(t.objectStore('drafts'))
    t.oncomplete = () => { resolve(r.result); d.close() }
    t.onerror = t.onabort = () => { reject(t.error); d.close() }
  })
}

export const saveDraft = (d: Draft) => tx('readwrite', (s) => s.put(d))
export const deleteDraft = (id: string) => tx('readwrite', (s) => s.delete(id))
export async function listDrafts(owner: string): Promise<Draft[]> {
  const all = (await tx<Draft[]>('readonly', (s) => s.getAll() as IDBRequest<Draft[]>)) ?? []
  return all.filter((d) => d.owner === owner).sort((a, b) => b.updatedAt - a.updatedAt)
}

const read = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback }
}
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

const tKey = (owner: string) => `chatter.story.templates.${owner}`
export const listTemplates = (owner: string): Template[] => {
  const v = read<Template[]>(tKey(owner), [])
  return Array.isArray(v) ? v : []
}
export function saveTemplate(owner: string, name: string, edits: StoryEdits): Template {
  // a template keeps only the look; text items keep their position and style but the words can be reused too
  const t: Template = { id: `t${Date.now().toString(36)}`, name: name.slice(0, 30) || 'My style', edits: JSON.parse(JSON.stringify(edits)) }
  write(tKey(owner), [t, ...listTemplates(owner)].slice(0, 20))
  return t
}
export const deleteTemplate = (owner: string, id: string) => write(tKey(owner), listTemplates(owner).filter((t) => t.id !== id))

const cKey = (owner: string) => `chatter.story.close.${owner}`
export const readCloseFriends = (owner: string): string[] => {
  const v = read<string[]>(cKey(owner), [])
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
}
export const saveCloseFriends = (owner: string, ids: string[]) => write(cKey(owner), [...new Set(ids)])

/** The user ids allowed (or excluded) for a story, given the chosen audience. */
export function audienceIds(owner: string, a: Audience, picked: string[]): string[] {
  if (a === 'close') return readCloseFriends(owner)
  if (a === 'only' || a === 'except') return [...new Set(picked)]
  return []
}
