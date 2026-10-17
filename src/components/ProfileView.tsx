import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Pencil, ZoomIn, ZoomOut, RotateCcw, UserRound, Lock } from 'lucide-react'
import type { Chat } from '../data'

const MIN_ZOOM = 1
const MAX_ZOOM = 5

/** Full-screen photo you can zoom: pinch, scroll wheel, double-tap or the +/- buttons; drag to move around when zoomed in. */
export function PhotoZoom({ src, name, onClose, onInfo }: { src: string; name: string; onClose: () => void; onInfo?: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; zoom: number } | null>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const lastTap = useRef(0)

  const apply = useCallback((z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
    setZoom(next)
    if (next === MIN_ZOOM) setPos({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') apply(zoom * 1.4)
      else if (e.key === '-') apply(zoom / 1.4)
      else if (e.key === '0') apply(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, apply, onClose])

  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) gesture.current = { dist: dist(), zoom }
    else drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
    const now = Date.now()
    if (pointers.current.size === 1 && now - lastTap.current < 300) {
      apply(zoom > 1 ? 1 : 2.5)
      lastTap.current = 0 // a double-tap is used up, so a third tap starts fresh
    } else lastTap.current = now
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && gesture.current) apply(gesture.current.zoom * (dist() / gesture.current.dist))
    else if (drag.current && zoom > 1) setPos({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y })
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    gesture.current = null
    drag.current = null
  }

  const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30'
  return (
    <div role="dialog" aria-label={`${name}'s photo`} className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-black/90 p-5" onClick={onClose}>
      <button onClick={onClose} aria-label="Close photo" className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"><X size={20} /></button>
      <div
        className="flex max-h-[72vh] w-full max-w-full items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => apply(zoom * Math.exp(-e.deltaY * 0.002))}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img
          src={src}
          alt={name}
          draggable={false}
          data-zoom={zoom.toFixed(2)}
          className={`max-h-[72vh] max-w-full select-none rounded-3xl object-contain shadow-2xl ${zoom > 1 ? 'cursor-grab' : 'cursor-zoom-in'}`}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`, transition: drag.current || pointers.current.size ? 'none' : 'transform 0.15s' }}
        />
      </div>
      <p className="text-sm font-semibold text-white/85">{name}</p>
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => apply(zoom / 1.4)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" className={btn}><ZoomOut size={18} /></button>
        <button onClick={() => apply(1)} disabled={zoom === 1} aria-label="Reset zoom" className={btn}><RotateCcw size={16} /></button>
        <button onClick={() => apply(zoom * 1.4)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" className={btn}><ZoomIn size={18} /></button>
        {onInfo && <button onClick={onInfo} className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"><UserRound size={16} /> View profile info</button>}
      </div>
    </div>
  )
}

const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
  value === undefined || value === null || value === '' ? null : (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{label}</span>
      <span className="min-w-0 break-words text-right text-sm">{value}</span>
    </div>
  )

/** A contact's profile card: name, nickname, age, status, about and whether they are online. */
export function ProfileSheet({ chat, onClose, onZoom, onEditContact }: { chat: Chat; onClose: () => void; onZoom: () => void; onEditContact: () => void }) {
  const p = chat.profile
  // a person who set their profile to Private shares only their name and photo
  const hidden = !chat.isGroup && p?.visibility === 'private'
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-label={`${chat.name}'s profile`} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl ring-1 ring-[rgb(var(--border))] sm:rounded-3xl">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center gap-2 pb-4 text-center">
          <button onClick={onZoom} aria-label="View photo large" className="rounded-full transition hover:opacity-90">
            <img src={chat.avatar} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-[rgb(var(--accent-soft))]" />
          </button>
          <h3 className="text-xl font-extrabold tracking-tight">{chat.name}</h3>
          {!hidden && p?.nickname ? <p className="text-sm text-[rgb(var(--text-secondary))]">“{p.nickname}”</p> : null}
          <p className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-secondary))]">
            <span className={`h-2 w-2 rounded-full ${chat.online ? 'bg-emerald-500' : 'bg-[rgb(var(--text-tertiary))]'}`} />
            {chat.isGroup ? chat.lastSeen : chat.online ? 'online' : chat.lastSeen ?? 'offline'}
          </p>
          {!hidden && p?.status ? <span className="mt-1 rounded-full bg-[rgb(var(--accent-soft))] px-3 py-1 text-xs font-semibold text-[rgb(var(--accent))]">{p.status}</span> : null}
        </div>
        {hidden ? (
          <p role="status" className="flex items-center justify-center gap-2 border-t border-[rgb(var(--border))] py-5 text-sm text-[rgb(var(--text-secondary))]">
            <Lock size={14} /> {chat.name.split(' ')[0]} keeps their profile private.
          </p>
        ) : (
          <div className="divide-y divide-[rgb(var(--border))] border-t border-[rgb(var(--border))]">
            <Row label="About" value={p?.about || (chat.isGroup ? '' : 'Hey there! I am using Chatter.')} />
            <Row label="Nickname" value={p?.nickname} />
            <Row label="Age" value={p?.age} />
          </div>
        )}
        <button onClick={onEditContact} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[rgb(var(--border))] py-2.5 text-sm font-semibold hover:bg-[rgb(var(--accent-soft))]">
          <Pencil size={14} /> Rename or change photo on this device
        </button>
      </div>
    </div>
  )
}
