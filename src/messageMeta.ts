/** Per-message rules set by the sender (the Message Control Center). Pure functions, no React or storage.
 *
 *  A message can start with one marker line the app reads and hides:
 *    ⟦meta:{"x":1760000000000,"nc":1,"nd":1}⟧
 *  x  = when it disappears (ms since 1970), nc = don't allow copying/forwarding, nd = don't allow saving
 *  attachments. A disappearing-messages change is a message carrying {"rule":{"exp":86400}}, so the setting
 *  reaches both people through the chat itself and the latest one wins.
 *
 *  These are honoured by Chatter apps, not by screenshots, other cameras or old app versions. Server-side
 *  deletion of expired messages needs supabase/migrations/message_controls_and_stories.sql. */

export type MsgMeta = { x?: number; nc?: true; nd?: true; rule?: { exp: number } }

export const EXPIRY_OPTIONS: { secs: number; label: string }[] = [
  { secs: 0, label: 'Off' },
  { secs: 3600, label: '1 hour' },
  { secs: 86400, label: '24 hours' },
  { secs: 604800, label: '7 days' },
  { secs: 2592000, label: '30 days' },
]
const ALLOWED = new Set(EXPIRY_OPTIONS.map((o) => o.secs))
const RE = /^⟦meta:(\{[^\n]{0,200}\})⟧\n?/

export function parseMeta(text: string): { meta: MsgMeta | null; body: string } {
  const m = RE.exec(text)
  if (!m) return { meta: null, body: text }
  const body = text.slice(m[0].length)
  try {
    const o = JSON.parse(m[1]) as Record<string, unknown>
    const meta: MsgMeta = {}
    if (typeof o.x === 'number' && Number.isFinite(o.x) && o.x > 0) meta.x = o.x
    if (o.nc === 1 || o.nc === true) meta.nc = true
    if (o.nd === 1 || o.nd === true) meta.nd = true
    const r = o.rule as { exp?: unknown } | undefined
    if (r && typeof r.exp === 'number' && ALLOWED.has(r.exp)) meta.rule = { exp: r.exp }
    return { meta, body }
  } catch {
    return { meta: null, body }
  }
}

export function withMeta(body: string, meta: MsgMeta): string {
  const o: Record<string, unknown> = {}
  if (meta.x) o.x = Math.round(meta.x)
  if (meta.nc) o.nc = 1
  if (meta.nd) o.nd = 1
  if (meta.rule) o.rule = { exp: meta.rule.exp }
  return Object.keys(o).length ? `⟦meta:${JSON.stringify(o)}⟧\n${body}` : body
}

export const stripMeta = (text: string) => text.replace(RE, '')
export const isExpired = (meta: MsgMeta | null | undefined, now = Date.now()) => !!meta?.x && meta.x <= now
export const expiryLabel = (secs: number) => EXPIRY_OPTIONS.find((o) => o.secs === secs)?.label ?? 'Off'

/** The message that changes a chat's disappearing-messages setting. */
export const ruleMessage = (secs: number) =>
  withMeta(secs ? `⏱ Turned on disappearing messages: new messages disappear after ${expiryLabel(secs)}.` : '⏱ Turned off disappearing messages.', { rule: { exp: secs } })

/** The chat's current disappearing time: the newest rule message from either person. */
export function currentExpiry(texts: string[]): number {
  for (let i = texts.length - 1; i >= 0; i--) {
    const { meta } = parseMeta(texts[i])
    if (meta?.rule) return meta.rule.exp
  }
  return 0
}

/** "23h", "5m", "6d": time left before a message disappears. */
export function timeLeftShort(x: number, now = Date.now()) {
  const s = Math.max(0, Math.round((x - now) / 1000))
  if (s >= 86400) return `${Math.round(s / 86400)}d`
  if (s >= 3600) return `${Math.round(s / 3600)}h`
  if (s >= 60) return `${Math.round(s / 60)}m`
  return `${s}s`
}
