/**
 * Persistent outgoing message queue for direct chats.
 * - Every message gets its id on the device; the database row uses the same id, so a retry of a message the
 *   server already stored comes back as a duplicate-key error and is treated as delivered (never sent twice).
 * - States: queued (waiting / retrying) → sending → gone once stored; failed = needs the person's tap (rejected, or too many tries).
 * - Entries live in storage, so they survive an app restart; "sending" entries found at start-up go back to queued.
 */
export type OutState = 'queued' | 'sending' | 'failed'
export type OutItem = { id: string; peerId: string; body: string; createdAt: string; state: OutState; attempts: number; nextAt: number }

export const MAX_ATTEMPTS = 8
const MAX_QUEUE = 200
const MAX_BODY = 4000

type Store = Pick<Storage, 'getItem' | 'setItem'>
export const outboxKey = (uid: string) => `chatter.outbox.${uid}`

export function backoffMs(attempts: number): number {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1))
}

export function loadOutbox(store: Store, uid: string): OutItem[] {
  try {
    const raw = JSON.parse(store.getItem(outboxKey(uid)) || '[]')
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    const out: OutItem[] = []
    for (const r of raw) {
      if (!r || typeof r.id !== 'string' || typeof r.peerId !== 'string' || typeof r.body !== 'string' || seen.has(r.id)) continue
      seen.add(r.id)
      out.push({
        id: r.id, peerId: r.peerId, body: r.body, createdAt: String(r.createdAt ?? new Date().toISOString()),
        // a message caught mid-send by a restart is retried, not lost
        state: r.state === 'failed' ? 'failed' : 'queued',
        attempts: Number(r.attempts) || 0, nextAt: 0,
      })
    }
    return out
  } catch { return [] }
}

export function saveOutbox(store: Store, uid: string, items: OutItem[]) {
  try { store.setItem(outboxKey(uid), JSON.stringify(items)) } catch { /* storage full or blocked: queue still works in memory */ }
}

export function enqueue(items: OutItem[], m: { id: string; peerId: string; body: string; now?: number }): OutItem[] {
  if (items.some((i) => i.id === m.id)) return items
  const body = m.body.slice(0, MAX_BODY)
  if (!body.trim() || items.length >= MAX_QUEUE) return items
  const now = m.now ?? Date.now()
  return [...items, { id: m.id, peerId: m.peerId, body, createdAt: new Date(now).toISOString(), state: 'queued', attempts: 0, nextAt: 0 }]
}

/** Oldest-first, one chat's messages never overtake each other: a peer with an earlier undelivered message waits. */
export function nextDue(items: OutItem[], now: number): OutItem | undefined {
  const blocked = new Set<string>()
  for (const i of items) {
    if (i.state === 'sending') blocked.add(i.peerId)
    else if (i.state === 'queued' && i.nextAt > now) blocked.add(i.peerId)
    else if (i.state === 'failed') blocked.add(i.peerId)
    else if (i.state === 'queued' && !blocked.has(i.peerId)) return i
  }
  return undefined
}

export const patch = (items: OutItem[], id: string, p: Partial<OutItem>) => items.map((i) => (i.id === id ? { ...i, ...p } : i))
export const remove = (items: OutItem[], id: string) => items.filter((i) => i.id !== id)

export type SendOutcome = 'delivered' | 'retry' | 'rejected'
/** Decide what a failed insert means. Duplicate key = the first try did reach the server. */
export function classify(err: { code?: string; message?: string; status?: number } | null): SendOutcome {
  if (!err) return 'delivered'
  if (err.code === '23505') return 'delivered'
  const status = err.status ?? 0
  // the server understood and refused (RLS, blocked, bad data): retrying cannot help
  if (err.code && /^(23|42|22|P0)/.test(err.code)) return 'rejected'
  if (status >= 400 && status < 500 && status !== 408 && status !== 429 && status !== 401) return 'rejected'
  return 'retry'
}

export function afterFailure(item: OutItem, outcome: SendOutcome, now: number): OutItem {
  const attempts = item.attempts + 1
  if (outcome === 'rejected' || attempts >= MAX_ATTEMPTS) return { ...item, attempts, state: 'failed' }
  return { ...item, attempts, state: 'queued', nextAt: now + backoffMs(attempts) }
}
