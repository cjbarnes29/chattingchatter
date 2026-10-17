/** Drawing shared by the Ghost Canvas and the masterpiece viewer. */

export type Brush = 'classic' | 'neon' | 'metal' | 'watercolor'
export type Stroke = { id: string; pts: [number, number][]; color: string; t: number; brush: Brush; w: number; life: number; opacity?: number }

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, alpha: number) {
  const a = alpha * (s.opacity ?? 1)
  ctx.globalAlpha = a
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (s.brush === 'neon') {
    ctx.strokeStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 22 * alpha; ctx.lineWidth = s.w
  } else if (s.brush === 'metal') {
    const g = ctx.createLinearGradient(0, 0, 0, 600)
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.5, s.color); g.addColorStop(1, '#4B5563')
    ctx.strokeStyle = g; ctx.shadowColor = 'rgba(255,255,255,.4)'; ctx.shadowBlur = 4; ctx.lineWidth = s.w + 2
  } else if (s.brush === 'watercolor') {
    ctx.strokeStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 18; ctx.lineWidth = s.w * 3; ctx.globalAlpha = a * 0.22
    ctx.beginPath(); s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
    ctx.globalAlpha = a * 0.5; ctx.lineWidth = s.w * 1.4; ctx.shadowBlur = 6
  } else {
    ctx.strokeStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 12 * alpha; ctx.lineWidth = s.w
  }
  ctx.beginPath(); s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
}

/** Does a stroke pass within `r` of a point? (used by the eraser) */
export function strokeHits(s: Stroke, x: number, y: number, r: number) {
  const r2 = (r + s.w / 2) ** 2
  for (let i = 0; i < s.pts.length; i++) {
    const [ax, ay] = s.pts[i]
    const [bx, by] = s.pts[i + 1] ?? s.pts[i]
    const dx = bx - ax, dy = by - ay
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0
    const px = ax + t * dx - x, py = ay + t * dy - y
    if (px * px + py * py <= r2) return true
  }
  return false
}

/** Bounding box of saved strokes, for fitting a masterpiece into view. */
export function bounds(strokes: { pts: [number, number][] }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of strokes) for (const [x, y] of s.pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null
}
