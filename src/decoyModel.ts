/** Decoy chats: the fake contacts and conversations shown under the decoy PIN.
 *  Pure functions (no React, storage or network) so the rules can be tested on their own.
 *  Nothing here ever reads real chats, contacts or accounts. */

export type DecoyStatus = 'sent' | 'delivered' | 'read'
export type DecoyMsg = {
  id: string
  fromMe: boolean
  text: string
  /** local date and time, "YYYY-MM-DDTHH:MM" (what <input type="datetime-local"> uses) */
  at: string
  status?: DecoyStatus
}
export type DecoyContact = {
  id: string
  name: string
  avatar: string
  /** shown under the name, e.g. "last seen today at 09:30" or "online" */
  lastSeen: string
  hidden?: boolean
  messages: DecoyMsg[]
}

export const LIMITS = { contacts: 50, messages: 300, name: 40, text: 2000, lastSeen: 40 }

const pad = (n: number) => String(n).padStart(2, '0')
export const toLocalStamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
export const validStamp = (s: unknown): s is string => typeof s === 'string' && STAMP.test(s) && !Number.isNaN(new Date(s).getTime())

/** "09:12" today → today's stamp at that time. */
export function stampAt(base: Date, hhmm: string, daysAgo = 0) {
  const d = new Date(base)
  d.setDate(d.getDate() - daysAgo)
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  d.setHours(m ? Math.min(23, +m[1]) : 12, m ? Math.min(59, +m[2]) : 0, 0, 0)
  return toLocalStamp(d)
}

const COLORS = ['#7A5C4F', '#3F6C8F', '#5B7F4A', '#8A4F7D', '#B0643A', '#4D5A99', '#2F7F7A']
/** A local initials avatar (an SVG data URL). Names never leave the device to make it. */
export function initialsAvatar(name: string) {
  const letters = name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'
  const color = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]
  const safe = letters.replace(/[<>&"']/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="${color}"/><text x="50%" y="54%" font-family="Arial,sans-serif" font-size="64" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">${safe}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Only local pictures (data URLs) or the built-in sample photos are kept, so a decoy can't point at arbitrary sites. */
export const safeAvatar = (src: unknown, name: string) =>
  typeof src === 'string' && (/^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/.test(src) || /^https:\/\/images\.unsplash\.com\//.test(src)) && src.length < 400_000
    ? src
    : initialsAvatar(name)

const clip = (s: unknown, max: number, fallback = '') => (typeof s === 'string' ? s.slice(0, max) : fallback)

/** Cleans whatever was in storage. Broken entries are dropped instead of breaking the app. */
export function validateContacts(raw: unknown, now = new Date()): DecoyContact[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: DecoyContact[] = []
  for (const c of raw) {
    if (out.length >= LIMITS.contacts) break
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id && !seen.has(o.id) ? o.id : null
    if (!id) continue
    seen.add(id)
    const name = clip(o.name, LIMITS.name).trim() || 'Contact'
    const msgs = Array.isArray(o.messages) ? o.messages : []
    const messages: DecoyMsg[] = []
    const mids = new Set<string>()
    for (const m of msgs.slice(0, LIMITS.messages)) {
      if (!m || typeof m !== 'object') continue
      const mm = m as Record<string, unknown>
      const mid = typeof mm.id === 'string' && mm.id && !mids.has(mm.id) ? mm.id : `${id}-m${messages.length}-${mids.size}`
      mids.add(mid)
      const text = clip(mm.text, LIMITS.text)
      if (!text.trim()) continue
      messages.push({
        id: mid,
        fromMe: mm.fromMe === true,
        text,
        at: validStamp(mm.at) ? mm.at : toLocalStamp(now),
        status: mm.status === 'sent' || mm.status === 'delivered' || mm.status === 'read' ? mm.status : undefined,
      })
    }
    out.push({ id, name, avatar: safeAvatar(o.avatar, name), lastSeen: clip(o.lastSeen, LIMITS.lastSeen, 'last seen recently'), hidden: o.hidden === true, messages })
  }
  return out
}

/** The sample chats a new account starts with. */
export function sampleContacts(now = new Date()): DecoyContact[] {
  return [
    {
      id: 'd1', name: 'Mum', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', lastSeen: 'last seen today at 09:20',
      messages: [
        { id: 'd1-1', fromMe: false, text: 'Morning love, are you coming for dinner Sunday?', at: stampAt(now, '08:55', 1) },
        { id: 'd1-2', fromMe: true, text: 'Yes! I’ll bring dessert 🍰', at: stampAt(now, '09:02', 1), status: 'read' },
        { id: 'd1-3', fromMe: false, text: 'Did you remember to buy milk?', at: stampAt(now, '09:12') },
      ],
    },
    {
      id: 'd2', name: 'Gym Buddy', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', lastSeen: 'last seen yesterday at 21:04',
      messages: [
        { id: 'd2-1', fromMe: true, text: 'Great session today 💪', at: stampAt(now, '18:31', 1), status: 'read' },
        { id: 'd2-2', fromMe: false, text: 'Leg day tomorrow, same time?', at: stampAt(now, '18:40', 1) },
      ],
    },
    {
      id: 'd3', name: 'Pharmacy', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80', lastSeen: 'last seen recently',
      messages: [{ id: 'd3-1', fromMe: false, text: 'Your prescription is ready for pickup.', at: stampAt(now, '11:05') }],
    },
  ]
}

type V1Item = { id: string; name: string; avatar: string; text: string; time: string; hidden?: boolean }
type V1Msg = { id: string; fromMe: boolean; text: string; time: string; status?: DecoyStatus }

/** Older versions kept one opening message per decoy plus anything typed in decoy mode. */
export function migrateV1(items: unknown, threads: unknown, now = new Date()): DecoyContact[] {
  if (!Array.isArray(items)) return []
  const th = threads && typeof threads === 'object' ? (threads as Record<string, V1Msg[]>) : {}
  const out = (items as V1Item[]).map((i) => ({
    id: i.id,
    name: i.name,
    avatar: i.avatar,
    lastSeen: 'last seen recently',
    hidden: i.hidden,
    messages: [
      { id: `${i.id}-seed`, fromMe: false, text: i.text, at: stampAt(now, i.time ?? '12:00') },
      ...(Array.isArray(th[i.id]) ? th[i.id] : []).map((m) => ({ id: m.id, fromMe: !!m.fromMe, text: m.text, at: stampAt(now, m.time ?? '12:00'), status: m.status })),
    ],
  }))
  return validateContacts(out, now)
}

let n = 0
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function newContact(name = 'New contact', now = new Date()): DecoyContact {
  const id = newId('c')
  return { id, name, avatar: initialsAvatar(name), lastSeen: 'last seen recently', messages: [{ id: newId('m'), fromMe: false, text: 'Hey! 👋', at: toLocalStamp(now) }] }
}

export function duplicateContact(c: DecoyContact): DecoyContact {
  const id = newId('c')
  const name = `${c.name} (copy)`.slice(0, LIMITS.name)
  return { ...c, id, name, hidden: c.hidden, messages: c.messages.map((m) => ({ ...m, id: newId('m') })) }
}

export const sortMessages = (ms: DecoyMsg[]) => [...ms].sort((a, b) => a.at.localeCompare(b.at))

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
/** "Today", "Yesterday", a weekday within the last week, else a date, like WhatsApp. */
export function dateLabel(at: string, now = new Date()) {
  const d = new Date(at)
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}
export const timeLabel = (at: string) => at.slice(11, 16)
