import { supabase } from './supabase'
import { Device, isNative } from './native'
import { MAX_FILE_BYTES, safeName } from './attachmentFormat'

/** Where a chat's files and voice messages are kept.
 *  - Real chats: the private `attachments` bucket (supabase/migrations/chat_attachments.sql). Each file is
 *    readable only by the two people in the conversation (or the group's members), via short-lived links.
 *  - Decoy chats: this device only (IndexedDB), under the account's decoy scope. They never touch the server
 *    and can't open a real chat's files, and real chats can't open decoy files. */
export type UploadResult = { ok: true; key: string } | { ok: false; error: string }
export type AttachmentApi = {
  upload(file: Blob, name: string, type: string): Promise<UploadResult>
  /** a URL the app can play or show, or null if the file is gone or not allowed */
  url(key: string): Promise<string | null>
}

const BUCKET = 'attachments'
const SERVER_KEY = /^(dm|group)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w.-]{1,80}$/

/** `folders` is ['dm', me, peer] or ['group', groupId, me]; the storage rules check exactly this layout. */
export function serverAttachments(folders: [string, string, string]): AttachmentApi {
  const cache = new Map<string, { url: string; until: number }>()
  return {
    async upload(file, name, type) {
      if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'Files can be up to 1 MB.' }
      const key = `${folders.join('/')}/${crypto.randomUUID()}/${safeName(name)}`
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, { contentType: type || 'application/octet-stream', upsert: false })
      if (!error) return { ok: true, key }
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('bucket not found') || msg.includes('not found')) return { ok: false, error: 'File sharing isn’t switched on for this server yet. It needs the chat_attachments database update.' }
      if (msg.includes('exceeded') || msg.includes('too large') || msg.includes('size')) return { ok: false, error: 'Files can be up to 1 MB.' }
      if (msg.includes('row-level security') || msg.includes('unauthorized') || msg.includes('policy')) return { ok: false, error: 'You can’t send files in this chat.' }
      return { ok: false, error: 'Couldn’t send the file. Check your connection and try again.' }
    },
    async url(key) {
      if (!SERVER_KEY.test(key)) return null
      const hit = cache.get(key)
      if (hit && hit.until > Date.now()) return hit.url
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, 3600)
      if (error || !data?.signedUrl) return null
      cache.set(key, { url: data.signedUrl, until: Date.now() + 50 * 60_000 })
      return data.signedUrl
    },
  }
}

// ---------- device-only files (decoy chats) ----------
const DB = 'chatter-local-files'
const STORE = 'files'
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(STORE, mode)
    const r = run(tx.objectStore(STORE))
    tx.oncomplete = () => { resolve(r.result); d.close() }
    tx.onerror = tx.onabort = () => { reject(tx.error); d.close() }
  })
}

/** `scope` keeps one account's decoy files apart from another's on a shared device. */
export function localAttachments(scope: string): AttachmentApi {
  const prefix = `local:${scope}:`
  const urls = new Map<string, string>()
  return {
    async upload(file, _name, type) {
      if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'Files can be up to 1 MB.' }
      const key = prefix + crypto.randomUUID()
      try {
        await idb('readwrite', (s) => s.put(new Blob([file], { type }), key))
        return { ok: true, key }
      } catch {
        return { ok: false, error: 'Couldn’t save the file on this device. Storage may be full.' }
      }
    },
    async url(key) {
      if (!key.startsWith(prefix)) return null
      const hit = urls.get(key)
      if (hit) return hit
      try {
        const blob = await idb<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>)
        if (!blob) return null
        const u = URL.createObjectURL(blob)
        urls.set(key, u)
        return u
      } catch {
        return null
      }
    },
  }
}

// ---------- saving a copy ----------
function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Save a file to the phone (Android's "Save to" screen) or the computer (a normal download). */
export async function saveFromUrl(url: string, name: string, type: string): Promise<boolean> {
  const blob = await (await fetch(url)).blob()
  if (isNative()) return (await Device.saveFile({ name, mime: type || blob.type || 'application/octet-stream', base64: toBase64(await blob.arrayBuffer()) })).saved
  const obj = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = obj
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(obj), 10_000)
  return true
}
