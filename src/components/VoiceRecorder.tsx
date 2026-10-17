import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Trash2, Send, Lock, ChevronLeft } from 'lucide-react'
import { MAX_FILE_BYTES, MAX_VOICE_SECONDS, formatDuration, toWave } from '../attachmentFormat'
import { ensureMedia } from '../permissions'
import { readTranscribe, startTranscript } from '../translate'

export type Recording = { blob: Blob; type: string; duration: number; wave: number[]; transcript?: string; lang?: string }
type Phase = 'idle' | 'starting' | 'holding' | 'locked'

const MIME = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
const pickMime = () => (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported ? MIME.find((m) => MediaRecorder.isTypeSupported(m)) : undefined)
const CANCEL_DX = -90
const LOCK_DY = -70

/** WhatsApp-style voice recording: hold the mic to record, release to send, slide left to cancel,
 *  slide up to lock and record hands-free. Keyboard: Enter or Space starts a locked recording. */
export default function VoiceRecorder({ onSend, onError, onActiveChange }: { onSend: (r: Recording) => void; onError: (msg: string) => void; onActiveChange?: (active: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secs, setSecs] = useState(0)
  const [slide, setSlide] = useState({ x: 0, y: 0 })
  const [bars, setBars] = useState<number[]>([])
  const phaseRef = useRef<Phase>('idle')
  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p) }
  const r = useRef<{
    rec?: MediaRecorder; stream?: MediaStream; ctx?: AudioContext; chunks: Blob[]; size: number; t0: number; levels: number[]
    tick?: ReturnType<typeof setInterval>; tx?: ReturnType<typeof startTranscript>; start: { x: number; y: number }; released: boolean; mime: string
  }>({ chunks: [], size: 0, t0: 0, levels: [], start: { x: 0, y: 0 }, released: false, mime: '' })

  useEffect(() => { onActiveChange?.(phase !== 'idle') }, [phase, onActiveChange])

  const cleanup = () => {
    const s = r.current
    clearInterval(s.tick)
    s.stream?.getTracks().forEach((t) => t.stop())
    s.ctx?.close().catch(() => {})
    s.rec = s.stream = s.ctx = undefined
    s.tick = undefined
  }

  const finish = useCallback(async (send: boolean) => {
    const s = r.current
    const p = phaseRef.current
    if (p !== 'holding' && p !== 'locked') return
    setP('idle')
    setSlide({ x: 0, y: 0 })
    const rec = s.rec
    const duration = (Date.now() - s.t0) / 1000
    const stopped = new Promise<void>((res) => {
      if (!rec || rec.state === 'inactive') return res()
      rec.addEventListener('stop', () => res(), { once: true })
      rec.stop()
    })
    await stopped
    const levels = s.levels
    const tx = s.tx
    s.tx = undefined
    cleanup()
    if (!send) { tx?.cancel(); return }
    if (duration < 1) { tx?.cancel(); onError('Hold the mic to record, then let go to send.'); return }
    const blob = new Blob(s.chunks, { type: s.mime || 'audio/webm' })
    if (blob.size > MAX_FILE_BYTES) { tx?.cancel(); onError('That recording is over 1 MB, so it wasn’t sent. Try a shorter one.'); return }
    const transcript = tx ? await tx.stop() : ''
    onSend({ blob, type: blob.type, duration: Math.min(duration, MAX_VOICE_SECONDS), wave: toWave(levels), transcript: transcript || undefined, lang: transcript ? tx?.lang : undefined })
  }, [onError, onSend])

  const begin = async (locked: boolean) => {
    if (phaseRef.current !== 'idle') return
    const s = r.current
    s.released = false
    setP('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' })
      await ensureMedia(false)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (s.released && !locked) {
        // let go before the microphone was ready (often the first time, while the permission prompt was up)
        stream.getTracks().forEach((t) => t.stop())
        setP('idle')
        onError('Hold the mic to record, then let go to send.')
        return
      }
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 })
      Object.assign(s, { stream, rec, chunks: [], size: 0, levels: [], t0: Date.now(), mime: rec.mimeType || mime || 'audio/webm' })
      rec.ondataavailable = (e) => {
        if (!e.data.size) return
        s.chunks.push(e.data)
        s.size += e.data.size
        if (s.size > MAX_FILE_BYTES * 0.92) void finish(true) // stop before the 1 MB limit
      }
      let analyser: AnalyserNode | null = null
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        s.ctx = new Ctx()
        analyser = s.ctx.createAnalyser()
        analyser.fftSize = 512
        s.ctx.createMediaStreamSource(stream).connect(analyser)
      } catch { analyser = null }
      const buf = new Uint8Array(512)
      s.tick = setInterval(() => {
        let level = 0.15
        if (analyser) {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += ((v - 128) / 128) ** 2
          level = Math.sqrt(sum / buf.length)
        }
        s.levels.push(level)
        setBars((b) => [...b.slice(-27), level])
        const el = (Date.now() - s.t0) / 1000
        setSecs(el)
        if (el >= MAX_VOICE_SECONDS) void finish(true)
      }, 100)
      if (readTranscribe()) s.tx = startTranscript()
      rec.start(500)
      setSecs(0)
      setBars([])
      setP(locked ? 'locked' : 'holding')
    } catch (e) {
      cleanup()
      setP('idle')
      const n = (e as { name?: string })?.name
      onError(
        n === 'NotAllowedError' ? 'Chatter needs the microphone to record voice messages. You can allow it in Settings.'
          : n === 'NotFoundError' ? 'No microphone was found.'
            : n === 'NotSupportedError' ? 'Voice messages aren’t supported on this device.'
              : 'Couldn’t start recording. Try again.',
      )
    }
  }

  useEffect(() => () => { r.current.tx?.cancel(); cleanup() }, [])

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not all pointers can be captured */ }
    r.current.start = { x: e.clientX, y: e.clientY }
    void begin(false)
  }
  const move = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'holding') return
    const dx = Math.min(0, e.clientX - r.current.start.x)
    const dy = Math.min(0, e.clientY - r.current.start.y)
    setSlide({ x: dx, y: dy })
    if (dx < CANCEL_DX) void finish(false)
    else if (dy < LOCK_DY) { setSlide({ x: 0, y: 0 }); setP('locked') }
  }
  const up = () => {
    r.current.released = true
    if (phaseRef.current === 'holding') void finish(true)
  }

  const active = phase === 'holding' || phase === 'locked'
  const level = (v: number) => Math.max(3, Math.min(22, v * 90))

  return (
    <>
      {active && (
        <div className={`absolute inset-y-0 left-0 z-20 flex items-center gap-3 bg-[rgb(var(--bg-panel))] px-3 md:px-5 ${phase === 'locked' ? 'right-0' : 'right-16'}`} role="status" aria-live="polite">
          {phase === 'locked' && (
            <button type="button" onClick={() => void finish(false)} aria-label="Delete recording" className="rounded-full p-2.5 text-rose-500 hover:bg-rose-500/10"><Trash2 size={20} /></button>
          )}
          <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /> {formatDuration(secs)}
          </span>
          <span className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
            {bars.map((v, i) => <span key={i} className="w-[3px] shrink-0 rounded-full bg-[rgb(var(--accent))]" style={{ height: level(v) }} />)}
          </span>
          {phase === 'holding' ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-[rgb(var(--text-secondary))]" style={{ transform: `translateX(${slide.x}px)`, opacity: 1 + slide.x / 140 }}>
              <ChevronLeft size={14} /> Slide to cancel
            </span>
          ) : (
            <button type="button" onClick={() => void finish(true)} aria-label="Send voice message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow-md"><Send size={18} className="translate-x-px" /></button>
          )}
        </div>
      )}
      {phase === 'holding' && (
        <span className="pointer-events-none absolute bottom-full right-4 z-20 mb-2 flex flex-col items-center gap-1 rounded-full bg-[rgb(var(--bg-panel))] px-2 py-2 text-[rgb(var(--text-secondary))] shadow-lg ring-1 ring-[rgb(var(--border))]" style={{ transform: `translateY(${Math.max(slide.y, LOCK_DY)}px)` }} aria-hidden>
          <Lock size={14} /> <span className="text-[10px]">↑</span>
        </span>
      )}
      {phase !== 'locked' && (
        <button
          type="button"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => void finish(false)}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && phaseRef.current === 'idle') { e.preventDefault(); void begin(true) } }}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Record voice message (hold to record, release to send)"
          title="Hold to record, release to send. Slide up to lock."
          className={`relative z-30 flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-full shadow-md transition ${active || phase === 'starting' ? 'scale-125 bg-rose-500 text-white' : 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] hover:scale-105'}`}
        >
          <Mic size={20} />
        </button>
      )}
    </>
  )
}
