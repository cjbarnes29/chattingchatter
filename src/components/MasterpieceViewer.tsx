import SecretInput from './SecretInput'
import { useEffect, useRef, useState } from 'react'
import { X, Lock, Loader2 } from 'lucide-react'
import { usePro, type Masterpiece } from '../pro'
import { drawStroke, bounds, type Stroke } from '../canvasDraw'

type Saved = {
  strokes: Pick<Stroke, 'pts' | 'color' | 'brush' | 'w' | 'opacity'>[]
  stickers?: { x: number; y: number; glyph: string }[]
  notes?: { x: number; y: number; text: string }[]
}

/** Opens an encrypted masterpiece with its password and shows it read-only.
 *  The decrypted drawing only exists in memory while this is open. */
export default function MasterpieceViewer({ m, onClose }: { m: Masterpiece; onClose: () => void }) {
  const { openMasterpiece } = usePro()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [art, setArt] = useState<Saved | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [fit, setFit] = useState({ x: 0, y: 0, z: 1 })

  const open = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const data = JSON.parse(await openMasterpiece(m.id, pw)) as Saved
      if (!Array.isArray(data.strokes)) throw new Error('bad')
      setArt(data)
    } catch {
      // AES-GCM refuses to decrypt with the wrong key, so a wrong password lands here
      setErr('That password didn’t open it. Passwords can’t be recovered if forgotten.')
    } finally {
      setBusy(false)
      setPw('')
    }
  }

  useEffect(() => {
    if (!art || !canvas.current) return
    const c = canvas.current
    const r = c.getBoundingClientRect()
    const d = window.devicePixelRatio || 1
    c.width = r.width * d
    c.height = r.height * d
    const ctx = c.getContext('2d')!
    ctx.setTransform(d, 0, 0, d, 0, 0)
    const pts = [...art.strokes, ...(art.stickers ?? []).map((s) => ({ pts: [[s.x, s.y], [s.x + 48, s.y + 48]] as [number, number][] })), ...(art.notes ?? []).map((n) => ({ pts: [[n.x, n.y]] as [number, number][] }))]
    const b = bounds(pts) ?? { minX: 0, minY: 0, maxX: r.width, maxY: r.height }
    const pad = 32
    const z = Math.min(2, (r.width - pad * 2) / Math.max(1, b.maxX - b.minX), (r.height - pad * 2) / Math.max(1, b.maxY - b.minY))
    const v = { z, x: pad - b.minX * z + ((r.width - pad * 2) - (b.maxX - b.minX) * z) / 2, y: pad - b.minY * z + ((r.height - pad * 2) - (b.maxY - b.minY) * z) / 2 }
    setFit(v)
    ctx.save()
    ctx.translate(v.x, v.y)
    ctx.scale(v.z, v.z)
    art.strokes.forEach((s, i) => drawStroke(ctx, { id: String(i), t: 0, life: 0, ...s }, 1))
    ctx.restore()
  }, [art])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-label={m.name} onClick={(e) => e.stopPropagation()} className="flex h-[min(80vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-[#0B1210] text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-2 px-4 py-3">
          <Lock size={15} className="text-[#7CF5C0]" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{m.name}</p>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-white/70 hover:bg-white/10"><X size={18} /></button>
        </div>
        {art ? (
          <div className="relative flex-1">
            <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute inset-0 origin-top-left" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.z})` }}>
              {(art.stickers ?? []).map((s, i) => <span key={i} className="absolute text-5xl" style={{ left: s.x, top: s.y }}>{s.glyph}</span>)}
              {(art.notes ?? []).map((n, i) => <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#7CF5C0] px-2.5 py-1 text-sm font-medium text-[#0B1210]" style={{ left: n.x, top: n.y }}>{n.text}</span>)}
            </div>
            {art.strokes.length === 0 && !art.stickers?.length && !art.notes?.length && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/50">This canvas was empty when it was saved.</p>}
          </div>
        ) : (
          <form onSubmit={open} className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
            <p className="text-sm text-white/70">Enter the password you used when saving.</p>
            <SecretInput value={pw} onChange={setPw} autoFocus label="Masterpiece password" wrapClassName="w-64" className="rounded-full bg-white/10 px-4 py-2 text-sm outline-none ring-1 ring-white/15 focus:ring-[#7CF5C0]" />
            <button type="submit" disabled={!pw || busy} className="flex items-center gap-2 rounded-full bg-[#7CF5C0] px-5 py-2 text-sm font-bold text-black disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" />} Open
            </button>
            {err && <p role="alert" className="max-w-xs text-center text-xs text-rose-400">{err}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
