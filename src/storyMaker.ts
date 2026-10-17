import { GIFEncoder, quantize, applyPalette } from 'gifenc'

/** Story Maker drawing and export (browser only). Gallery photos become an animated GIF, or a single
 *  photo becomes a still picture, with an effect, motion, text and stickers drawn on every frame.
 *  Everything happens on the device; nothing is uploaded until the user posts. */

export type Effect = 'none' | 'bw' | 'sepia' | 'vivid' | 'warm' | 'cool' | 'fade'
export type Motion = 'none' | 'zoom' | 'crossfade'
export type TextItem = { id: string; text: string; x: number; y: number; size: number; color: string; bg: boolean }
export type StickerItem = { id: string; emoji: string; x: number; y: number; size: number }
/** Everything except the photos; this is what drafts and templates keep. x/y are 0–1 of the frame. */
export type StoryEdits = { effect: Effect; motion: Motion; frameMs: number; texts: TextItem[]; stickers: StickerItem[] }

export const DEFAULT_EDITS: StoryEdits = { effect: 'none', motion: 'none', frameMs: 900, texts: [], stickers: [] }
export const EFFECTS: { id: Effect; label: string; css: string }[] = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'bw', label: 'Mono', css: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.8)' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.3) saturate(1.3) hue-rotate(-10deg)' },
  { id: 'cool', label: 'Cool', css: 'saturate(1.1) hue-rotate(15deg) brightness(1.05)' },
  { id: 'fade', label: 'Faded', css: 'contrast(0.85) brightness(1.1) saturate(0.8)' },
]
export const MOTIONS: { id: Motion; label: string }[] = [
  { id: 'none', label: 'Slideshow' },
  { id: 'zoom', label: 'Slow zoom' },
  { id: 'crossfade', label: 'Crossfade' },
]
export const MAX_PHOTOS = 8
export const MAX_STORY_BYTES = 2 * 1024 * 1024 // also the story-media bucket's limit
export const W = 360
export const H = 640

export type Photo = ImageBitmap | HTMLImageElement
export async function loadPhoto(file: Blob): Promise<Photo> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fall back */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That picture couldn’t be opened.'))
    img.src = URL.createObjectURL(file)
  })
}

const dims = (p: Photo) => ('naturalWidth' in p ? { w: p.naturalWidth, h: p.naturalHeight } : { w: p.width, h: p.height })

function drawPhoto(ctx: CanvasRenderingContext2D, p: Photo, w: number, h: number, effect: Effect, scale = 1, alpha = 1) {
  const { w: pw, h: ph } = dims(p)
  const s = Math.max(w / pw, h / ph) * scale // cover the frame
  const dw = pw * s
  const dh = ph * s
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.filter = EFFECTS.find((e) => e.id === effect)?.css ?? 'none'
  ctx.drawImage(p, (w - dw) / 2, (h - dh) / 2, dw, dh)
  ctx.restore()
}

export function drawOverlays(ctx: CanvasRenderingContext2D, edits: StoryEdits, w: number, h: number) {
  const k = w / W
  for (const s of edits.stickers) {
    ctx.save()
    ctx.font = `${s.size * k}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.emoji, s.x * w, s.y * h)
    ctx.restore()
  }
  for (const t of edits.texts) {
    if (!t.text.trim()) continue
    ctx.save()
    const size = t.size * k
    ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = t.text.split('\n').slice(0, 4)
    const lh = size * 1.2
    const top = t.y * h - ((lines.length - 1) * lh) / 2
    lines.forEach((line, i) => {
      const y = top + i * lh
      if (t.bg) {
        const tw = ctx.measureText(line).width
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        const pad = size * 0.35
        ctx.beginPath()
        ctx.roundRect?.(t.x * w - tw / 2 - pad, y - lh / 2, tw + pad * 2, lh, size * 0.3)
        if (!ctx.roundRect) ctx.rect(t.x * w - tw / 2 - pad, y - lh / 2, tw + pad * 2, lh)
        ctx.fill()
      } else {
        ctx.lineWidth = Math.max(2, size / 8)
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.strokeText(line, t.x * w, y)
      }
      ctx.fillStyle = t.color
      ctx.fillText(line, t.x * w, y)
    })
    ctx.restore()
  }
}

type Frame = { delay: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }

/** The frames of the animation (also used by the live preview). */
export function buildFrames(photos: Photo[], edits: StoryEdits): Frame[] {
  const frames: Frame[] = []
  const ms = Math.max(200, Math.min(3000, edits.frameMs))
  photos.forEach((p, i) => {
    const next = photos[(i + 1) % photos.length]
    if (edits.motion === 'zoom') {
      const steps = 6
      for (let k = 0; k < steps; k++) frames.push({ delay: ms / steps, draw: (c, w, h) => drawPhoto(c, p, w, h, edits.effect, 1 + 0.12 * (k / (steps - 1))) })
    } else {
      frames.push({ delay: ms, draw: (c, w, h) => drawPhoto(c, p, w, h, edits.effect) })
      if (edits.motion === 'crossfade' && photos.length > 1) {
        for (const a of [0.25, 0.5, 0.75]) {
          frames.push({ delay: 90, draw: (c, w, h) => { drawPhoto(c, p, w, h, edits.effect); drawPhoto(c, next, w, h, edits.effect, 1, a) } })
        }
      }
    }
  })
  return frames.map((f) => ({ delay: f.delay, draw: (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); f.draw(c, w, h); drawOverlays(c, edits, w, h) } }))
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Encodes the animation as a looping GIF, shrinking it if needed to stay under the size limit. */
export async function renderGif(photos: Photo[], edits: StoryEdits, onProgress?: (p: number) => void): Promise<Blob> {
  const frames = buildFrames(photos, edits)
  for (const scale of [1, 0.8, 0.62, 0.5]) {
    const w = Math.round(W * scale)
    const h = Math.round(H * scale)
    const c = canvas(w, h)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    const gif = GIFEncoder()
    for (let i = 0; i < frames.length; i++) {
      frames[i].draw(ctx, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      const palette = quantize(data, 256)
      gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: frames[i].delay, repeat: 0 })
      onProgress?.((i + 1) / frames.length)
      if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0)) // keep the screen responsive
    }
    gif.finish()
    const blob = new Blob([gif.bytes()], { type: 'image/gif' })
    if (blob.size <= MAX_STORY_BYTES) return blob
  }
  throw new Error('The GIF is too big. Use fewer photos or a shorter animation.')
}

/** A single photo as a still picture (JPEG), with the same effect, text and stickers. */
export async function renderStill(photo: Photo, edits: StoryEdits): Promise<Blob> {
  const c = canvas(W * 2, H * 2)
  const ctx = c.getContext('2d')!
  buildFrames([photo], { ...edits, motion: 'none' })[0].draw(ctx, c.width, c.height)
  for (const q of [0.88, 0.75, 0.6]) {
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q))
    if (b && b.size <= MAX_STORY_BYTES) return b
  }
  throw new Error('That picture is too big to share.')
}

/** Frames in a GIF (counts image blocks), used to confirm an export is really animated. */
export function gifFrameCount(bytes: Uint8Array) {
  let n = 0
  for (let i = 0; i < bytes.length - 1; i++) if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9) n++
  return n
}
