/** How files and voice messages travel inside a chat message. Pure functions, no React, network or storage,
 *  so they can be tested on their own.
 *
 *  A message body stays plain text: a readable first line (shown by older app versions, chat previews and
 *  notifications) followed by a marker line holding the details as JSON:
 *
 *    📎 report.pdf · 120 KB
 *    ⟦file:{"v":1,"k":"dm/…/report.pdf","n":"report.pdf","s":122880,"t":"application/pdf"}⟧
 *
 *  `k` is a storage key, never file contents, so the body stays far below the 4000-character limit. */

export const MAX_FILE_BYTES = 1024 * 1024 // 1 MB per file, also enforced by the storage bucket
export const MAX_VOICE_SECONDS = 5 * 60
export const MAX_TRANSCRIPT = 1500

export type FileAtt = { kind: 'file'; key: string; name: string; size: number; type: string }
export type VoiceAtt = {
  kind: 'voice'
  key: string
  size: number
  type: string
  /** seconds */
  duration: number
  /** loudness samples 0–9, one per bar */
  wave: number[]
  /** what was said, if the sender turned transcripts on */
  transcript?: string
  /** BCP 47 language of the transcript, e.g. "en-US" */
  lang?: string
}
export type Attachment = FileAtt | VoiceAtt

const OPEN = '⟦'
const CLOSE = '⟧'
const RE = /\n?⟦(file|voice):(\{[\s\S]*\})⟧\s*$/

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDuration(secs: number) {
  const s = Math.max(0, Math.round(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Too big, empty or unnamed files are refused before anything is uploaded. */
export function checkFile(f: { name: string; size: number }): string | null {
  if (!f.name) return 'That file has no name.'
  if (f.size <= 0) return 'That file is empty.'
  if (f.size > MAX_FILE_BYTES) return `“${f.name}” is ${formatBytes(f.size)}. Files can be up to 1 MB.`
  return null
}

/** A storage-safe file name: letters, numbers, dot, dash and underscore only. */
export function safeName(name: string) {
  const cleaned = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^[._]+/, '')
  return (cleaned || 'file').slice(-80)
}

export function encodeAttachment(a: Attachment): string {
  if (a.kind === 'file') {
    const head = `📎 ${a.name} · ${formatBytes(a.size)}`
    return `${head}\n${OPEN}file:${JSON.stringify({ v: 1, k: a.key, n: a.name, s: a.size, t: a.type })}${CLOSE}`
  }
  const head = `🎤 Voice message · ${formatDuration(a.duration)}`
  const body: Record<string, unknown> = { v: 1, k: a.key, s: a.size, t: a.type, d: Math.round(a.duration * 10) / 10, w: a.wave.map((x) => Math.max(0, Math.min(9, Math.round(x)))).join('') }
  if (a.transcript) {
    body.tx = a.transcript.slice(0, MAX_TRANSCRIPT)
    if (a.lang) body.l = a.lang
  }
  return `${head}\n${OPEN}voice:${JSON.stringify(body)}${CLOSE}`
}

const str = (v: unknown, max = 600) => (typeof v === 'string' && v.length <= max ? v : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)

/** Reads an attachment out of a message body. Anything malformed is treated as ordinary text. */
export function parseAttachment(text: string): Attachment | null {
  const m = RE.exec(text)
  if (!m) return null
  let o: Record<string, unknown>
  try {
    o = JSON.parse(m[2])
  } catch {
    return null
  }
  const key = str(o.k, 400)
  const size = num(o.s)
  const type = str(o.t, 120) ?? 'application/octet-stream'
  if (!key || size === null) return null
  if (m[1] === 'file') {
    const name = str(o.n, 200)
    if (!name) return null
    return { kind: 'file', key, name, size, type }
  }
  const duration = num(o.d)
  if (duration === null) return null
  const wave = typeof o.w === 'string' && /^\d{0,200}$/.test(o.w) ? o.w.split('').map(Number) : []
  const transcript = str(o.tx, MAX_TRANSCRIPT) ?? undefined
  const lang = str(o.l, 35) ?? undefined
  return { kind: 'voice', key, size, type, duration, wave, transcript, lang }
}

/** The readable part of a message, for chat previews and notifications. */
export function previewText(text: string) {
  // also hides the Message Control Center marker line (messageMeta.ts)
  return text.replace(/^⟦meta:\{[^\n]{0,200}\}⟧\n?/, '').replace(RE, '')
}

/** Downsamples loudness readings to `bars` values between 0 and 9 for a WhatsApp-style waveform. */
export function toWave(levels: number[], bars = 40): number[] {
  if (!levels.length) return Array(bars).fill(1)
  const out: number[] = []
  const step = levels.length / bars
  const peak = Math.max(...levels, 1e-6)
  for (let i = 0; i < bars; i++) {
    const slice = levels.slice(Math.floor(i * step), Math.max(Math.floor((i + 1) * step), Math.floor(i * step) + 1))
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length
    out.push(Math.max(1, Math.min(9, Math.round((avg / peak) * 9))))
  }
  return out
}

/** File type → a short label and whether the browser can safely show it inline. */
export function fileKind(type: string, name: string): { label: string; inline: 'image' | 'audio' | 'video' | null } {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 5) : ''
  // SVG and HTML can carry scripts, so they're offered as downloads only
  if (/^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(type)) return { label: ext || 'IMAGE', inline: 'image' }
  if (/^audio\//.test(type)) return { label: ext || 'AUDIO', inline: 'audio' }
  if (/^video\/(mp4|webm|ogg)$/.test(type)) return { label: ext || 'VIDEO', inline: 'video' }
  return { label: ext || 'FILE', inline: null }
}
