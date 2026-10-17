import SecretInput from './SecretInput'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Brush, StickyNote, Sticker, Gamepad2, X, Fingerprint, Pin, ShieldCheck, Crown, Lock, Film, Calendar, Save, Maximize2, Minus, Plus } from 'lucide-react'
import { Undo2, Redo2, Send, Eraser, Hand, PenLine } from 'lucide-react'
import { usePro } from '../pro'
import { useAuth } from '../auth'
import { supabase } from '../supabase'
import { REAL_PREFIX } from '../realChats'
import { readGhostPrefs } from '../prefs'
import CalendarPanel from './CalendarPanel'
import GhostWaiting from './GhostWaiting'
import { CONNECT_TIMEOUT, INVITE_COOLDOWN, INVITE_TEXT, PEER_LEFT_DELAY, elapsedSecs, graceRuns, initialSession, inviteWait, reduce, viewOf, wipeOnLeave } from '../ghostSession'
import { drawStroke, strokeHits, type Brush as BrushId, type Stroke } from '../canvasDraw'
import type { CalEvent } from '../calendar'

type Mode = 'ink' | 'note' | 'stickers' | 'game' | 'widgets'
type Note = { id: number; x: number; y: number; text: string; mine: boolean; life: number }
type Sticker = { id: string; x: number; y: number; glyph: string }
const SWATCHES = ['#7CF5C0', '#FFB86B', '#FF6B8A', '#7AB8FF', '#C792FF', '#FFFFFF']
const LIFETIMES = [5, 10, 30]
type Game = 'tictactoe' | 'connect4'

const MINE = '#7CF5C0'
const THEIRS = '#FFB86B'
const GLYPHS = ['🌙', '🔥', '🌈', '🦋', '🍒', '⭐', '🎈', '🌊', '🪩', '🐚']
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
const BRUSHES: { id: BrushId; label: string; pro: boolean; color: string }[] = [
  { id: 'classic', label: 'Classic', pro: false, color: MINE },
  { id: 'neon', label: 'Neon', pro: true, color: '#FF4FD8' },
  { id: 'metal', label: 'Metallic', pro: true, color: '#C9D4E0' },
  { id: 'watercolor', label: 'Watercolour', pro: true, color: '#7AB8FF' },
]
const C4_COLS = 7, C4_ROWS = 6

function winner(b: (string | null)[]) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  return null
}
function c4Winner(b: (string | null)[]): string | null {
  const at = (r: number, c: number) => b[r * C4_COLS + c]
  const dirs = [[0,1],[1,0],[1,1],[1,-1]]
  for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) {
    const v = at(r, c); if (!v) continue
    for (const [dr, dc] of dirs) {
      if ([1,2,3].every((k) => { const rr = r + dr * k, cc = c + dc * k; return rr >= 0 && rr < C4_ROWS && cc >= 0 && cc < C4_COLS && at(rr, cc) === v })) return v
    }
  }
  return null
}

type CalendarApi = {
  myId: string
  events: CalEvent[]
  onAdd: (title: string, note: string, startsAt: Date, remind: number) => Promise<{ ok: boolean; error?: string }>
  onDelete: (id: string) => void
}

export default function GhostCanvas({ friend, chatId, onSend, onExit: closeCanvas, onUpgrade, calendar }: { friend: string; chatId: string; onSend?: (chatId: string, text: string) => void; onExit: () => void; onUpgrade: () => void; calendar?: CalendarApi }) {
  // Every way out goes through here, so a canvas closes exactly once even when "app lost focus" and "tab hidden" arrive together
  const closed = useRef(false)
  const onExit = useCallback(() => {
    if (closed.current) return
    closed.current = true
    closeCanvas()
  }, [closeCanvas])
  const pro = usePro()
  const { user } = useAuth()
  const G = useMemo(() => readGhostPrefs(), [])
  const myId = user?.id ?? 'me'
  const peerId = chatId.startsWith(REAL_PREFIX) ? chatId.slice(REAL_PREFIX.length) : null
  const room = peerId ? [myId, peerId].sort().join('_') : null
  const [lifeSec, setLifeSec] = useState(G.lifetime)
  const LIFE = lifeSec * 1000
  const [myColor, setMyColor] = useState(G.ink)
  const [width, setWidth] = useState(G.inkWidth)
  // connection + other-person state (see ghostSession.ts); `now` ticks only while waiting
  const [session, dispatch] = useReducer(reduce, undefined, () => initialSession(Date.now()))
  const [now, setNow] = useState(() => Date.now())
  const [attempt, setAttempt] = useState(0)
  const peerOnline = session.peer === 'present'
  const sessionRef = useRef(session)
  sessionRef.current = session
  const contentRef = useRef(false)
  const lastInvite = useRef(0)
  const peerGoneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [turn4, setTurn4] = useState<'X' | 'O'>('X')
  const [chatDraft, setChatDraft] = useState('')
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pending = useRef<{ id: string; pts: [number, number][] } | null>(null)
  const lastCursor = useRef(0)
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mine = useRef<string[]>([])
  const sid = useRef(Math.random().toString(36).slice(2, 6))
  const online = !!room && peerOnline
  const mySym: 'X' | 'O' = online && peerId ? (myId < peerId ? 'X' : 'O') : 'X'
  const emit = (event: string, payload: object) => { chan.current?.send({ type: 'broadcast', event, payload }) }
  const flush = () => {
    const p = pending.current
    if (p && p.pts.length) { emit('pts', p); pending.current = { id: p.id, pts: [] } }
  }
  useEffect(() => {
    if (!room) return
    const t = setInterval(flush, 60)
    return () => clearInterval(t)
  }, [room])
  const [phase, setPhase] = useState<'waiting' | 'live'>('waiting')
  const [mode, setMode] = useState<Mode>('ink')
  const [brush, setBrush] = useState<BrushId>('classic')
  const [tool, setTool] = useState<'pen' | 'eraser' | 'pan'>('pen')
  const [opacity, setOpacity] = useState(1)
  const [notes, setNotes] = useState<Note[]>([])
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [noteText, setNoteText] = useState('meet at 8?')
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null))
  const [c4, setC4] = useState<(string | null)[]>(Array(C4_COLS * C4_ROWS).fill(null))
  const [game, setGame] = useState<Game>('tictactoe')
  const [view, setView] = useState({ x: 0, y: 0, z: 1 })
  const [pinned, setPinned] = useState(false)
  const [held, setHeld] = useState(false)
  const [grace, setGrace] = useState(G.grace)
  const [showCal, setShowCal] = useState(false)
  const [savePrompt, setSavePrompt] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const wasHeld = useRef(false)
  const layer = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const drawing = useRef<Stroke | null>(null)
  const panning = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  // touch points currently on the canvas, for two-finger pan and pinch zoom
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; cx: number; cy: number } | null>(null)
  const redoStack = useRef<Stroke[]>([])
  const peersSeen = useRef(new Set<string>())
  const idc = useRef(1)
  const viewRef = useRef(view)
  viewRef.current = view
  const stickersRef = useRef(stickers)
  stickersRef.current = stickers
  const win = winner(board)
  const full = board.every(Boolean)
  const c4win = c4Winner(c4)
  const c4full = c4.every(Boolean)
  contentRef.current = notes.length > 0 || stickers.length > 0 || board.some(Boolean) || c4.some(Boolean)

  const toWorld = (cx: number, cy: number): [number, number] => {
    const v = viewRef.current
    return [(cx - v.x) / v.z, (cy - v.y) / v.z]
  }

  useEffect(() => { const t = setTimeout(() => setPhase('live'), 1500); return () => clearTimeout(t) }, [])

  useEffect(() => {
    // "Close when I leave" protects what's on the canvas; an empty canvas you're waiting on can be left and returned to
    const leave = () => { if (wipeOnLeave(G.exitOnLeave, sessionRef.current, strokes.current.length > 0 || contentRef.current)) onExit() }
    const out = leave
    const vis = () => { if (document.hidden) leave() }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onExit()
    window.addEventListener('blur', out)
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('blur', out)
      document.removeEventListener('visibilitychange', vis)
      window.removeEventListener('keydown', key)
    }
  }, [onExit, G])

  // The hold-to-stay countdown only runs when the other person is here (or on the solo demo canvas).
  // Waiting alone never counts down, and when they (re)join the countdown starts fresh so a stale one can't close the canvas.
  const graceOn = graceRuns(!!room, session)
  useEffect(() => {
    if (peerOnline) {
      wasHeld.current = false
      setGrace(G.grace)
    }
  }, [peerOnline, G.grace])
  useEffect(() => {
    if (phase !== 'live' || held || pinned || wasHeld.current || !graceOn) return
    if (grace <= 0) { onExit(); return }
    const t = setTimeout(() => setGrace((g) => g - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, held, pinned, grace, onExit, graceOn])

  // tick once a second while waiting so the elapsed time and invite cooldown stay current
  useEffect(() => {
    if (!room || phase !== 'live' || (session.peer === 'present' && session.link === 'online')) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [room, phase, session.peer, session.link])

  // render loop (infinite canvas: world coords transformed by view)
  useEffect(() => {
    if (phase !== 'live') return
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    let raf = 0
    const fit = () => {
      const r = c.parentElement!.getBoundingClientRect()
      const d = window.devicePixelRatio || 1
      c.width = r.width * d; c.height = r.height * d
      ctx.setTransform(d, 0, 0, d, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)
    const draw = () => {
      const r = c.getBoundingClientRect()
      ctx.clearRect(0, 0, r.width, r.height)
      const v = viewRef.current
      // dotted grid that moves with the view
      if (G.grid) {
        ctx.fillStyle = 'rgba(124,245,192,.09)'
        const step = 26 * v.z
        const ox = ((v.x % step) + step) % step, oy = ((v.y % step) + step) % step
        for (let x = ox; x < r.width; x += step) for (let y = oy; y < r.height; y += step) ctx.fillRect(x, y, 1.2, 1.2)
      }
      const now = Date.now()
      strokes.current = strokes.current.filter((s) => now - s.t < s.life)
      ctx.save()
      ctx.translate(v.x, v.y); ctx.scale(v.z, v.z)
      for (const s of strokes.current) {
        const age = now - s.t
        const a = age < s.life * 0.7 ? 1 : Math.max(0, 1 - (age - s.life * 0.7) / (s.life * 0.3))
        drawStroke(ctx, s, a)
      }
      ctx.restore()
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit) }
  }, [phase, G])

  // sends the shared state (games, collage) to whoever just joined
  const stateRef = useRef<() => void>(() => {})
  stateRef.current = () => {
    const ch = chan.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'game', payload: { game } })
    ch.send({ type: 'broadcast', event: 'ttt', payload: { cells: board, turn } })
    ch.send({ type: 'broadcast', event: 'c4', payload: { cells: c4, turn: turn4 } })
    stickersRef.current.forEach((st) => ch.send({ type: 'broadcast', event: 'sticker', payload: st }))
  }

  const size = () => layer.current?.getBoundingClientRect() ?? ({ width: 600, height: 400 } as DOMRect)

  const dropNote = useCallback((x: number, y: number, text: string, mine: boolean, life: number = LIFE, share = false) => {
    const id = idc.current++
    setNotes((n) => [...n, { id, x, y, text, mine, life }])
    setTimeout(() => setNotes((n) => n.filter((k) => k.id !== id)), life)
    if (share) chan.current?.send({ type: 'broadcast', event: 'note', payload: { x, y, text, life } })
  }, [LIFE])
  // the channel below must not restart when the ink lifetime changes, so it reads dropNote through a ref
  const dropNoteRef = useRef(dropNote)
  dropNoteRef.current = dropNote

  // live room: strokes, notes, collage, games and cursors travel over a realtime channel
  useEffect(() => {
    if (!room) return
    const ch = supabase.channel(`ghost:${room}`, { config: { presence: { key: myId } } })
    chan.current = ch
    let dead = false
    const timers: ReturnType<typeof setTimeout>[] = []
    peersSeen.current = new Set()
    const sync = () => {
      if (dead) return
      const others = Object.keys(ch.presenceState()).filter((k) => k !== myId)
      if (others.length > 0) {
        clearTimeout(peerGoneTimer.current)
        dispatch({ type: 'peerJoined' })
      } else if (sessionRef.current.peer === 'present') {
        // short drops are normal (e.g. a phone changing network), so only say they left if they stay gone
        clearTimeout(peerGoneTimer.current)
        peerGoneTimer.current = setTimeout(() => dispatch({ type: 'peerLeft', at: Date.now() }), PEER_LEFT_DELAY)
      }
      // forget people who left, so they get the current game and collage again when they come back
      for (const k of [...peersSeen.current]) if (!others.includes(k)) peersSeen.current.delete(k)
      if (others.some((k) => !peersSeen.current.has(k))) {
        others.forEach((k) => peersSeen.current.add(k))
        timers.push(setTimeout(() => stateRef.current(), 300))
      }
    }
    ch.on('presence', { event: 'sync' }, sync)
    ch.on('broadcast', { event: 'stroke' }, ({ payload: p }) => {
      strokes.current.push({ id: p.id, pts: [p.pt], color: p.color, brush: p.brush, w: p.w, life: p.life, t: Date.now(), opacity: typeof p.opacity === 'number' ? Math.min(1, Math.max(0.1, p.opacity)) : 1 })
    })
    ch.on('broadcast', { event: 'pts' }, ({ payload: p }) => {
      const s = strokes.current.find((k) => k.id === p.id)
      if (s) { s.pts.push(...(p.pts as [number, number][])); s.t = Date.now() }
    })
    ch.on('broadcast', { event: 'undo' }, ({ payload: p }) => { strokes.current = strokes.current.filter((k) => k.id !== p.id) })
    ch.on('broadcast', { event: 'cursor' }, ({ payload: p }) => {
      setCursor({ x: p.x, y: p.y })
      clearTimeout(cursorTimer.current)
      cursorTimer.current = setTimeout(() => setCursor(null), 2500)
    })
    ch.on('broadcast', { event: 'note' }, ({ payload: p }) => dropNoteRef.current(p.x, p.y, p.text, false, p.life))
    ch.on('broadcast', { event: 'sticker' }, ({ payload: p }) => setStickers((all) => (all.some((s) => s.id === p.id) ? all.map((s) => (s.id === p.id ? { ...s, x: p.x, y: p.y } : s)) : [...all, p])))
    ch.on('broadcast', { event: 'ttt' }, ({ payload: p }) => { setBoard(p.cells); setTurn(p.turn) })
    ch.on('broadcast', { event: 'c4' }, ({ payload: p }) => { setC4(p.cells); setTurn4(p.turn) })
    ch.on('broadcast', { event: 'game' }, ({ payload: p }) => setGame(p.game))
    // If the live channel never comes up, say so (recoverable: Retry or Exit). This never closes the canvas.
    const watchdog = setTimeout(() => { if (!dead) dispatch({ type: 'linkDown' }) }, CONNECT_TIMEOUT * 1000)
    ch.subscribe((status) => {
      if (dead) return
      if (status === 'SUBSCRIBED') {
        clearTimeout(watchdog)
        dispatch({ type: 'linkUp' })
        ch.track({ at: Date.now() })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(watchdog)
        dispatch({ type: 'linkDown' })
      }
    })
    return () => {
      dead = true
      clearTimeout(watchdog)
      clearTimeout(peerGoneTimer.current)
      timers.forEach(clearTimeout)
      chan.current = null
      supabase.removeChannel(ch)
    }
  }, [room, myId, attempt])

  // simulated friend — only on sample chats with no real person (can be switched off in Settings)
  useEffect(() => {
    if (phase !== 'live' || room || !G.demoFriend) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const loop = () => {
      const { width, height } = size()
      if (Math.random() < 0.6) {
        const s: Stroke = { id: 'demo' + idc.current++, pts: [], color: THEIRS, t: Date.now(), brush: 'classic', w: 4, life: LIFE }
        strokes.current.push(s)
        const cx = width * (0.2 + Math.random() * 0.6), cy = height * (0.25 + Math.random() * 0.4)
        const rad = 30 + Math.random() * 40
        let i = 0
        const step = () => {
          const a = i * 0.25
          const [wx, wy] = toWorld(cx + Math.cos(a) * rad * (1 + i / 60), cy + Math.sin(a * 1.3) * rad * 0.7)
          s.pts.push([wx, wy])
          s.t = Date.now()
          if (++i < 40) timers.push(setTimeout(step, 28))
        }
        step()
      } else {
        const words = ['hi 👋', 'you there?', 'look!', 'shhh…', 'ok ok']
        const [wx, wy] = toWorld(width * (0.15 + Math.random() * 0.6), height * (0.2 + Math.random() * 0.5))
        dropNote(wx, wy, words[Math.floor(Math.random() * words.length)], false)
      }
      timers.push(setTimeout(loop, 3500 + Math.random() * 2500))
    }
    timers.push(setTimeout(loop, 1500))
    return () => timers.forEach(clearTimeout)
  }, [phase, dropNote])

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = layer.current!.getBoundingClientRect()
    return toWorld(e.clientX - r.left, e.clientY - r.top)
  }

  const eraseAt = (x: number, y: number) => {
    const r = 12 / viewRef.current.z
    const hit = strokes.current.filter((k) => strokeHits(k, x, y, r))
    if (!hit.length) return
    const ids = new Set(hit.map((k) => k.id))
    strokes.current = strokes.current.filter((k) => !ids.has(k.id))
    mine.current = mine.current.filter((id) => !ids.has(id))
    hit.forEach((k) => emit('undo', { id: k.id }))
  }

  const onDown = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect()
    pointers.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
    // capture can be refused (e.g. the pointer already ended); drawing still works without it
    try {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    // a second finger turns the gesture into pan (everyone) and pinch zoom (Pro)
    if (pointers.current.size === 2) {
      const s = drawing.current
      if (s && s.pts.length < 4) {
        strokes.current = strokes.current.filter((k) => k.id !== s.id)
        mine.current = mine.current.filter((id) => id !== s.id)
        emit('undo', { id: s.id })
      }
      drawing.current = null
      const [p1, p2] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 }
      return
    }
    if (pointers.current.size > 2) return
    if (mode === 'ink') {
      if (tool === 'pan' || e.button === 1 || e.altKey || e.shiftKey) {
        panning.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0 }
        return
      }
      if (tool === 'eraser') {
        const [x, y] = pos(e)
        eraseAt(x, y)
        return
      }
      const b = BRUSHES.find((x) => x.id === brush)!
      const s: Stroke = { id: `${sid.current}${idc.current++}`, pts: [pos(e)], color: b.id === 'metal' ? b.color : myColor, t: Date.now(), brush, w: width, life: LIFE, opacity: pro.isPro ? opacity : 1 }
      drawing.current = s
      strokes.current.push(s)
      mine.current.push(s.id)
      redoStack.current = []
      pending.current = { id: s.id, pts: [] }
      emit('stroke', { id: s.id, pt: s.pts[0], color: s.color, brush: s.brush, w: s.w, life: s.life, opacity: s.opacity })
    } else if (mode === 'note') {
      const [x, y] = pos(e)
      dropNote(x, y, noteText || '✨', true, LIFE, true)
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect()
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
    if (pinch.current && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()]
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2
      const prev = pinch.current
      setView((v) => {
        const z = pro.isPro && prev.d > 0 ? Math.min(3, Math.max(0.4, v.z * (d / prev.d))) : v.z
        const k = z / v.z
        return { z, x: cx - (prev.cx - v.x) * k, y: cy - (prev.cy - v.y) * k }
      })
      pinch.current = { d, cx, cy }
      return
    }
    if (panning.current) {
      const dx = e.clientX - panning.current.x, dy = e.clientY - panning.current.y
      panning.current = { x: e.clientX, y: e.clientY, vx: dx, vy: dy }
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
      return
    }
    const p = pos(e)
    if (room && Date.now() - lastCursor.current > 60) { lastCursor.current = Date.now(); emit('cursor', { x: p[0], y: p[1] }) }
    if (mode === 'ink' && tool === 'eraser' && e.buttons) return eraseAt(p[0], p[1])
    const s = drawing.current
    if (!s) return
    s.pts.push(p)
    s.t = Date.now()
    if (pending.current) pending.current.pts.push(p)
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    flush(); drawing.current = null; panning.current = null
  }
  const undo = () => {
    const id = mine.current.pop()
    if (!id) return
    const s = strokes.current.find((k) => k.id === id)
    if (s) redoStack.current.push(s)
    strokes.current = strokes.current.filter((k) => k.id !== id)
    emit('undo', { id })
  }
  const redo = () => {
    const s = redoStack.current.pop()
    if (!s) return
    const again = { ...s, t: Date.now() }
    strokes.current.push(again)
    mine.current.push(again.id)
    emit('stroke', { id: again.id, pt: again.pts[0], color: again.color, brush: again.brush, w: again.w, life: again.life, opacity: again.opacity })
    emit('pts', { id: again.id, pts: again.pts.slice(1) })
  }
  // Invite = a normal chat message asking them to open Ghost Canvas (there is no separate invitation record).
  // The cooldown is kept in a ref so a double-click in one tick can't send two.
  const invite = () => {
    if (!onSend || Date.now() - lastInvite.current < INVITE_COOLDOWN * 1000) return
    lastInvite.current = Date.now()
    onSend(chatId, INVITE_TEXT)
    dispatch({ type: 'invited', at: Date.now() })
    setNow(Date.now())
  }
  const retry = () => {
    if (sessionRef.current.link === 'connecting') return
    dispatch({ type: 'retry' })
    setAttempt((a) => a + 1) // re-runs the channel effect, which closes the old channel first
  }
  const releaseHold = () => {
    setHeld(false)
    if (pinned) return
    // alone in a live room there is nobody to protect the canvas from, so letting go isn't "leaving"
    if (room && session.peer !== 'present') { wasHeld.current = false; return }
    onExit()
  }

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault()
    const t = chatDraft.trim()
    if (!t) return
    onSend?.(chatId, t)
    const { width: w, height: h } = size()
    const [x, y] = toWorld(w * (0.25 + Math.random() * 0.5), h * (0.15 + Math.random() * 0.2))
    dropNote(x, y, t.slice(0, 28), true, LIFE, true)
    setChatDraft('')
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!pro.isPro) return
    const r = layer.current!.getBoundingClientRect()
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    setView((v) => {
      const z = Math.min(3, Math.max(0.4, v.z * (e.deltaY < 0 ? 1.1 : 0.9)))
      const k = z / v.z
      return { z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }

  const addSticker = (glyph: string) => {
    const { width, height } = size()
    const [x, y] = toWorld(width / 2 - 24 + (Math.random() - 0.5) * 120, height / 2 - 24 + (Math.random() - 0.5) * 80)
    const st = { id: `${sid.current}s${idc.current++}`, x, y, glyph }
    setStickers((s) => [...s, st])
    emit('sticker', st)
  }

  const dragSticker = (id: string, e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const r = layer.current!.getBoundingClientRect()
      const [x, y] = toWorld(ev.clientX - r.left - 24 * viewRef.current.z, ev.clientY - r.top - 24 * viewRef.current.z)
      setStickers((all) => all.map((s) => (s.id === id ? { ...s, x, y } : s)))
      if (room) {
        const g = stickersRef.current.find((s) => s.id === id)
        if (g) emit('sticker', { id, x, y, glyph: g.glyph })
      }
    }
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const play = (i: number) => {
    if (board[i] || win || full) return
    if (online && turn !== mySym) return
    const b = [...board]; b[i] = mySym
    setBoard(b)
    if (online) {
      const nt = mySym === 'X' ? 'O' : 'X'
      setTurn(nt); emit('ttt', { cells: b, turn: nt })
      return
    }
    if (winner(b) || b.every(Boolean)) return
    setTimeout(() => {
      const free = b.map((v, k) => (v ? -1 : k)).filter((k) => k >= 0)
      const tryWin = (p: string) => free.find((k) => { const t = [...b]; t[k] = p; return winner(t) === p })
      const pick = tryWin('O') ?? tryWin('X') ?? (free.includes(4) ? 4 : free[Math.floor(Math.random() * free.length)])
      setBoard((cur) => { const n = [...cur]; n[pick] = 'O'; return n })
    }, 700)
  }

  const dropC4 = (col: number) => {
    if (c4win || c4full) return
    let row = -1
    for (let r = C4_ROWS - 1; r >= 0; r--) if (!c4[r * C4_COLS + col]) { row = r; break }
    if (row < 0) return
    if (online && turn4 !== mySym) return
    const b = [...c4]; b[row * C4_COLS + col] = mySym
    setC4(b)
    if (online) {
      const nt = mySym === 'X' ? 'O' : 'X'
      setTurn4(nt); emit('c4', { cells: b, turn: nt })
      return
    }
    if (c4Winner(b) || b.every(Boolean)) return
    setTimeout(() => {
      const playable: number[] = []
      for (let c = 0; c < C4_COLS; c++) for (let r = C4_ROWS - 1; r >= 0; r--) if (!b[r * C4_COLS + c]) { playable.push(r * C4_COLS + c); break }
      const pick = playable.find((idx) => { const t = [...b]; t[idx] = 'O'; return c4Winner(t) === 'O' }) ??
        playable.find((idx) => { const t = [...b]; t[idx] = 'X'; return c4Winner(t) === 'X' }) ??
        playable[Math.floor(Math.random() * playable.length)]
      setC4((cur) => { const n = [...cur]; n[pick] = 'O'; return n })
    }, 700)
  }

  const saveMasterpiece = async () => {
    if (pw.length < 4) return setSaveMsg('Password needs at least 4 characters.')
    if (pw !== pw2) return setSaveMsg('The two passwords do not match.')
    const payload = JSON.stringify({ strokes: strokes.current.filter((s) => Date.now() - s.t < s.life).map((s) => ({ pts: s.pts, color: s.color, brush: s.brush, w: s.w, opacity: s.opacity })), stickers, notes: notes.map(({ x, y, text, mine }) => ({ x, y, text, mine })), view })
    await pro.saveMasterpiece(`Canvas · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, payload, pw)
    setPw(''); setPw2(''); setSavePrompt(false); setSaveMsg('Saved encrypted on this device. Open it in Settings → Chatter Pro.')
    window.setTimeout(() => setSaveMsg(null), 3200)
  }

  const requirePro = (fn: () => void) => () => (pro.isPro ? fn() : onUpgrade())

  const tools: { id: Mode; icon: typeof Brush; label: string; pro?: boolean }[] = [
    { id: 'ink', icon: Brush, label: 'Ink' },
    { id: 'note', icon: StickyNote, label: 'Notes' },
    { id: 'stickers', icon: Sticker, label: 'Collage' },
    { id: 'game', icon: Gamepad2, label: 'Game' },
    { id: 'widgets', icon: Film, label: 'Widgets', pro: true },
  ]

  const showC4 = game === 'connect4'
  const cols = 3, rows = 3

  return (
    <div className="ghost-root absolute inset-0 z-30 flex flex-col overflow-hidden bg-[#0B1210] text-white select-none touch-none">
      <style>{`
        @keyframes ghostDissolve{0%,70%{opacity:1;filter:blur(0)}100%{opacity:0;filter:blur(8px);transform:translateY(-10px) scale(1.05)}}
        @keyframes ghostRing{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.2);opacity:0}}
        @keyframes ghostIn{from{opacity:0}to{opacity:1}}
        .ghost-root{animation:ghostIn .5s ease both}
      `}</style>

      <div className="relative z-10 flex items-center gap-3 px-4 py-3">
        <ShieldCheck size={18} className="text-[#7CF5C0]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ghost Canvas · {friend}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-white/55">
            {phase !== 'live' ? 'Connecting…' : room ? (
              <><span className={`inline-block h-1.5 w-1.5 rounded-full ${session.link === 'failed' ? 'bg-rose-400' : peerOnline ? 'bg-[#7CF5C0] shadow-[0_0_8px_#7CF5C0]' : 'bg-white/30'}`} />{session.link === 'failed' ? 'Connection problem' : session.link === 'connecting' ? 'Connecting…' : peerOnline ? `${friend} is here · live` : session.peer === 'away' ? `${friend} disconnected · canvas kept` : `Waiting for ${friend} to open the canvas`} · vanishes in {lifeSec}s</>
            ) : `Demo canvas (sample chat) · vanishes in ${lifeSec}s`}
          </p>
        </div>
        {phase === 'live' && (
          <button onClick={requirePro(() => setSavePrompt((s) => !s))} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/20 hover:bg-white/10">
            {pro.isPro ? <Save size={12} /> : <Crown size={12} className="text-[#7CF5C0]" />} Save
          </button>
        )}
        <button onClick={() => setPinned((p) => !p)} aria-pressed={pinned} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${pinned ? 'bg-[#7CF5C0] text-black ring-[#7CF5C0]' : 'text-white/70 ring-white/20 hover:bg-white/10'}`}>
          <Pin size={12} /> {pinned ? 'Pinned' : 'Pin'}
        </button>
        <button onClick={onExit} aria-label="Wipe and exit" className="rounded-full p-2 text-white/70 hover:bg-white/10"><X size={18} /></button>
      </div>

      {savePrompt && (
        <div className="relative z-10 mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
          <Lock size={14} className="text-[#7CF5C0]" />
          <SecretInput value={pw} onChange={setPw} placeholder="Masterpiece password" label="Masterpiece password" wrapClassName="min-w-[9rem] flex-1" autoComplete="new-password" className="rounded-full bg-black/30 px-3 py-1.5 text-sm outline-none ring-1 ring-white/15 focus:ring-[#7CF5C0]" />
          <SecretInput value={pw2} onChange={setPw2} placeholder="Type it again" label="Confirm masterpiece password" wrapClassName="min-w-[9rem] flex-1" autoComplete="new-password" className="rounded-full bg-black/30 px-3 py-1.5 text-sm outline-none ring-1 ring-white/15 focus:ring-[#7CF5C0]" />
          <button onClick={saveMasterpiece} className="rounded-full bg-[#7CF5C0] px-3 py-1.5 text-xs font-bold text-black">Encrypt & save</button>
        </div>
      )}
      {saveMsg && <p className="relative z-10 px-4 pb-1 text-center text-xs text-[#7CF5C0]">{saveMsg}</p>}

      {phase === 'waiting' ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {[0, 1, 2].map((i) => (
              <span key={i} className="absolute inset-0 rounded-full border border-[#7CF5C0]" style={{ animation: `ghostRing 2s ${i * 0.6}s infinite ease-out` }} />
            ))}
            <Fingerprint size={38} className="text-[#7CF5C0]" />
          </div>
          <p className="text-sm text-white/70">Opening Ghost Canvas…</p>
        </div>
      ) : (
        <>
          <div
            ref={layer}
            className={`relative z-10 flex-1 overflow-hidden ${mode === 'ink' ? 'cursor-crosshair' : mode === 'note' ? 'cursor-copy' : ''}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{ cursor: mode === 'ink' ? (tool === 'pan' ? 'grab' : tool === 'eraser' ? 'cell' : undefined) : undefined }}
            onWheel={onWheel}
          >
            <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
            {room && (
              <GhostWaiting
                view={viewOf(session, now)}
                peer={session.peer}
                elapsed={elapsedSecs(session, now)}
                inviteWait={inviteWait(session, now)}
                invited={session.invitedAt !== null}
                willWipeOnLeave={G.exitOnLeave && (strokes.current.length > 0 || contentRef.current)}
                onKeepWaiting={() => dispatch({ type: 'keepWaiting' })}
                onReopen={() => dispatch({ type: 'reopen' })}
                onInvite={invite}
                onRetry={retry}
                onExit={onExit}
              />
            )}
            <div className="pointer-events-none absolute inset-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
              {notes.map((n) => (
                <span key={n.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-sm font-medium shadow-lg" style={{ left: n.x, top: n.y, animation: `ghostDissolve ${n.life}ms linear forwards`, background: n.mine ? myColor : THEIRS, color: '#0B1210', rotate: `${(n.id % 5) - 2}deg` }}>
                  {n.text}
                </span>
              ))}
              {cursor && (
                <span className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75" style={{ left: cursor.x, top: cursor.y }}>
                  <span className="block h-3.5 w-3.5 rounded-full" style={{ background: THEIRS, boxShadow: `0 0 0 4px ${THEIRS}33, 0 0 14px ${THEIRS}` }} />
                  <span className="absolute left-4 top-3 whitespace-nowrap rounded-full px-1.5 text-[10px] font-semibold text-black" style={{ background: THEIRS }}>{friend}</span>
                </span>
              )}
              {stickers.map((s) => (
                <div key={s.id} onPointerDown={(e) => { e.stopPropagation(); dragSticker(s.id, e) }} className="pointer-events-auto absolute cursor-grab text-5xl drop-shadow-lg active:cursor-grabbing" style={{ left: s.x, top: s.y }}>{s.glyph}</div>
              ))}
            </div>

            {mode === 'game' && (
              <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/5 p-3 ring-1 ring-white/15" onPointerDown={(e) => e.stopPropagation()}>
                <div className="mb-2 flex gap-1 text-[11px]">
                  <button onClick={() => { setGame('tictactoe'); emit('game', { game: 'tictactoe' }) }} className={`rounded-full px-2.5 py-1 ${!showC4 ? 'bg-[#7CF5C0] text-black' : 'text-white/70'}`}>Tic-tac-toe</button>
                  <button onClick={requirePro(() => { setGame('connect4'); emit('game', { game: 'connect4' }) })} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${showC4 ? 'bg-[#7CF5C0] text-black' : 'text-white/70'}`}>{!pro.isPro && <Crown size={10} />}Connect Four</button>
                </div>
                {!showC4 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {board.map((v, i) => (
                        <button key={i} onClick={() => play(i)} aria-label={`Cell ${i + 1}`} className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/5 text-3xl font-bold transition hover:bg-white/10" style={{ color: v === mySym ? MINE : THEIRS }}>{v}</button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                      <span>{win ? (win === mySym ? 'You win' : `${friend} wins`) : full ? 'Draw' : online ? (turn === mySym ? `Your move (${mySym})` : `${friend}'s move`) : 'Your move (X)'}</span>
                      {(win || full) && <button onClick={() => { const c = Array(9).fill(null); setBoard(c); setTurn('X'); emit('ttt', { cells: c, turn: 'X' }) }} className="font-semibold text-[#7CF5C0]">Again</button>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: C4_COLS }, (_, c) => (
                        <button key={c} onClick={() => dropC4(c)} aria-label={`Column ${c + 1}`} className="flex flex-col gap-1 rounded-lg bg-white/5 p-1 hover:bg-white/10">
                          {Array.from({ length: C4_ROWS }, (_, r) => {
                            const v = c4[r * C4_COLS + c]
                            return <span key={r} className="block h-7 w-7 rounded-full" style={{ background: v === mySym ? MINE : v ? THEIRS : 'rgba(255,255,255,.08)' }} />
                          })}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                      <span>{c4win ? (c4win === mySym ? 'You win' : `${friend} wins`) : c4full ? 'Draw' : online ? (turn4 === mySym ? 'Your turn — drop a disc' : `${friend}'s turn`) : 'Drop a disc'}</span>
                      {(c4win || c4full) && <button onClick={() => { const c = Array(C4_COLS * C4_ROWS).fill(null); setC4(c); setTurn4('X'); emit('c4', { cells: c, turn: 'X' }) }} className="font-semibold text-[#7CF5C0]">Again</button>}
                    </div>
                  </>
                )}
              </div>
            )}

            {showCal && (
              <div
                className="absolute bottom-3 left-3 z-10 max-h-[70%] w-[min(20rem,calc(100%-1.5rem))] overflow-y-auto rounded-2xl bg-[#101a16] p-3 ring-1 ring-white/15"
                style={{ ['--bg-panel' as string]: '16 26 22', ['--bg-panel-soft' as string]: '28 44 37', ['--text-primary' as string]: '240 250 245', ['--text-secondary' as string]: '170 195 183', ['--text-tertiary' as string]: '120 150 137', ['--border' as string]: '52 78 66', ['--accent' as string]: '124 245 192', ['--accent-soft' as string]: '36 62 51', ['--accent-foreground' as string]: '11 18 16' }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between text-xs text-white/70"><span className="flex items-center gap-1"><Calendar size={12} /> Shared calendar</span><button onClick={() => setShowCal(false)} aria-label="Close calendar"><X size={13} /></button></div>
                {calendar ? (
                  <CalendarPanel inline friend={friend} {...calendar} onClose={() => setShowCal(false)} />
                ) : (
                  <p className="py-4 text-center text-xs text-white/60">Calendars are available in one-to-one chats.</p>
                )}
              </div>
            )}
          </div>

          {mode === 'note' && (
            <div className="relative z-10 mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={28} aria-label="Ink note text" className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none ring-1 ring-white/15 focus:ring-[#7CF5C0]" />
              <span className="text-[11px] text-white/50">tap canvas to drop</span>
            </div>
          )}
          {mode === 'stickers' && (
            <div className="relative z-10 mx-auto flex max-w-full gap-1 overflow-x-auto px-4 pb-2">
              {GLYPHS.map((g) => <button key={g} onClick={() => addSticker(g)} className="rounded-xl p-2 text-2xl hover:bg-white/10">{g}</button>)}
            </div>
          )}
          {mode === 'ink' && (
            <div className="relative z-10 mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 pb-2">
              <div className="flex shrink-0 items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button key={c} onClick={() => setMyColor(c)} aria-label={`Ink ${c}`} aria-pressed={myColor === c} className={`h-6 w-6 rounded-full transition ${myColor === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0B1210]' : 'ring-1 ring-white/20'}`} style={{ background: c }} />
                ))}
              </div>
              <input type="range" min={2} max={14} value={width} onChange={(e) => setWidth(+e.target.value)} aria-label="Brush size" className="w-20 shrink-0 accent-[#7CF5C0]" />
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 p-0.5 text-[11px]" title="How long ink lasts">
                {LIFETIMES.map((s) => (
                  <button key={s} onClick={() => setLifeSec(s)} aria-pressed={lifeSec === s} className={`rounded-full px-2 py-1 ${lifeSec === s ? 'bg-[#7CF5C0] font-bold text-black' : 'text-white/70'}`}>{s}s</button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 p-0.5" role="radiogroup" aria-label="Canvas tool">
                {([['pen', PenLine, 'Draw'], ['eraser', Eraser, 'Eraser'], ['pan', Hand, 'Move around']] as const).map(([id, Icon, label]) => (
                  <button key={id} role="radio" aria-checked={tool === id} aria-label={label} title={label} onClick={() => setTool(id)} className={`rounded-full p-1.5 ${tool === id ? 'bg-[#7CF5C0] text-black' : 'text-white/70'}`}><Icon size={14} /></button>
                ))}
              </div>
              <button onClick={undo} aria-label="Undo my last stroke" title="Undo" className="shrink-0 rounded-full p-1.5 text-white/70 ring-1 ring-white/15 hover:bg-white/10"><Undo2 size={14} /></button>
              <button onClick={redo} aria-label="Redo" title="Redo" className="shrink-0 rounded-full p-1.5 text-white/70 ring-1 ring-white/15 hover:bg-white/10"><Redo2 size={14} /></button>
            </div>
          )}
          {mode === 'ink' && (
            <div className="relative z-10 mx-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 px-4 pb-2">
              {BRUSHES.map((b) => (
                <button key={b.id} onClick={() => (b.pro && !pro.isPro ? onUpgrade() : setBrush(b.id))} aria-pressed={brush === b.id} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 transition ${brush === b.id ? 'bg-white/15 ring-[#7CF5C0]' : 'ring-white/15 text-white/70 hover:bg-white/10'}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color, boxShadow: b.id === 'neon' ? `0 0 8px ${b.color}` : undefined }} />
                  {b.label}{b.pro && !pro.isPro && <Crown size={10} className="text-[#7CF5C0]" />}
                </button>
              ))}
              <span className="flex shrink-0 items-center gap-1 pl-2 text-[10px] text-white/45">
                {pro.isPro ? (
                  <>
                    <label className="flex items-center gap-1" title="Opacity">
                      <span className="sr-only">Opacity</span>
                      <input type="range" min={20} max={100} step={10} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(+e.target.value / 100)} aria-label="Ink opacity" className="w-14 accent-[#7CF5C0]" />
                      <span className="w-7 tabular-nums">{Math.round(opacity * 100)}%</span>
                    </label>
                    <button onClick={() => setView((v) => ({ ...v, z: Math.max(0.4, v.z / 1.2) }))} aria-label="Zoom out" className="rounded p-1 hover:bg-white/10"><Minus size={12} /></button>
                    <button onClick={() => setView({ x: 0, y: 0, z: 1 })} aria-label="Reset view" title="Reset view" className="rounded p-1 hover:bg-white/10"><Maximize2 size={11} /></button>
                    <button onClick={() => setView((v) => ({ ...v, z: Math.min(3, v.z * 1.2) }))} aria-label="Zoom in" className="rounded p-1 hover:bg-white/10"><Plus size={12} /></button>
                  </>
                ) : (
                  'Two fingers or the hand tool to move · Pro adds zoom & opacity'
                )}
              </span>
            </div>
          )}
          {mode === 'widgets' && (
            <div className="relative z-10 mx-auto flex max-w-full gap-2 overflow-x-auto px-4 pb-2">
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/40 ring-1 ring-white/10" title="Watching videos together is not available yet"><Film size={13} /> Watch together · coming soon</span>
              <button onClick={() => setShowCal((s) => !s)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 ${showCal ? 'bg-[#7CF5C0] text-black ring-[#7CF5C0]' : 'ring-white/15 text-white/70'}`}><Calendar size={13} /> Shared calendar</button>
              {!pro.isPro && <span className="self-center text-[10px] text-white/45">Pro widgets</span>}
            </div>
          )}

          {onSend && (
            <form onSubmit={sendChat} className="relative z-10 mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-2">
              <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Message (saved in the chat)" aria-label="Chat message, saved in the chat" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none ring-1 ring-white/15 focus:ring-[#7CF5C0]" />
              <button type="submit" aria-label="Send message" className="rounded-full bg-[#7CF5C0] p-2 text-black"><Send size={14} /></button>
            </form>
          )}
          <div className="relative z-10 flex items-center justify-between gap-3 px-4 pb-4 pt-1">
            <div className="flex gap-1 rounded-full bg-white/10 p-1">
              {tools.map(({ id, icon: Icon, label, pro: isProTool }) => (
                <button key={id} onClick={() => (isProTool && !pro.isPro ? onUpgrade() : setMode(id))} aria-label={label} title={label} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${mode === id ? 'bg-[#7CF5C0] text-black' : 'text-white/70 hover:bg-white/10'}`}>
                  <Icon size={15} /> <span className="hidden sm:inline">{label}</span>{isProTool && !pro.isPro && <Crown size={10} className="text-[#7CF5C0]" />}
                </button>
              ))}
            </div>
            <button
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); wasHeld.current = true; setHeld(true) }}
              onPointerUp={releaseHold}
              onPointerCancel={releaseHold}
              className={`flex h-14 items-center gap-2 rounded-full px-5 text-xs font-semibold ring-1 transition ${held || pinned ? 'bg-[#7CF5C0]/20 text-[#7CF5C0] ring-[#7CF5C0]' : 'text-white ring-white/30'}`}
            >
              <Fingerprint size={22} />
              <span>{held || pinned ? 'Canvas alive' : !graceOn || wasHeld.current ? 'Hold to stay' : `Hold to stay · ${grace}s`}</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
