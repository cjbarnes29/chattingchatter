import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Download, Languages, FileText, Loader2 } from 'lucide-react'
import { formatDuration, type VoiceAtt } from '../attachmentFormat'
import { saveFromUrl, type AttachmentApi } from '../attachmentStore'
import { LANGUAGES, deviceLang, translateText } from '../translate'

const SPEEDS = [1, 1.5, 2]

/** A voice message bubble: play/pause, waveform you can tap or drag to seek, playback speed,
 *  save a copy, and (when the sender added a transcript) read and translate it. */
export default function VoiceMessage({ att, api, fromMe, canSave = true }: { att: VoiceAtt; api?: AttachmentApi; fromMe: boolean; canSave?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [err, setErr] = useState('')
  const [showTx, setShowTx] = useState(false)
  const [lang, setLang] = useState(deviceLang())
  const [tr, setTr] = useState<{ busy: boolean; text?: string; error?: string }>({ busy: false })
  const wave = att.wave.length ? att.wave : Array(40).fill(2)
  const dur = att.duration || 1

  useEffect(() => () => { audio.current?.pause() }, [])

  const resolve = async () => {
    if (url) return url
    if (!api) { setErr('This voice message isn’t available here.'); return null }
    setLoading(true)
    const u = await api.url(att.key)
    setLoading(false)
    if (!u) { setErr('This voice message isn’t available.'); return null }
    setUrl(u)
    return u
  }

  const ensureAudio = async () => {
    if (audio.current) return audio.current
    const u = await resolve()
    if (!u) return null
    const a = new Audio(u)
    a.preload = 'auto'
    a.ontimeupdate = () => setCur(a.currentTime)
    a.onended = () => { setPlaying(false); setCur(0) }
    a.onpause = () => setPlaying(false)
    a.onplay = () => setPlaying(true)
    a.onerror = () => { setErr('This voice message can’t be played on this device.'); setPlaying(false) }
    audio.current = a
    return a
  }

  const toggle = async () => {
    setErr('')
    const a = await ensureAudio()
    if (!a) return
    if (a.paused) {
      a.playbackRate = speed
      try { await a.play() } catch { setErr('Couldn’t play this voice message.') }
    } else a.pause()
  }

  const seek = async (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const a = await ensureAudio()
    if (!a) return
    a.currentTime = ratio * dur
    setCur(a.currentTime)
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audio.current) audio.current.playbackRate = next
  }

  const save = async () => {
    setErr('')
    const u = await resolve()
    if (!u) return
    const ext = att.type.includes('mp4') ? 'm4a' : att.type.includes('ogg') ? 'ogg' : 'webm'
    try { await saveFromUrl(u, `voice-message-${new Date().toISOString().slice(0, 10)}.${ext}`, att.type) } catch { setErr('Couldn’t save the voice message.') }
  }

  const translate = async () => {
    if (!att.transcript) return
    setTr({ busy: true })
    const r = await translateText(att.transcript, att.lang, lang)
    setTr(r.ok ? { busy: false, text: r.text } : { busy: false, error: r.error })
  }

  const progress = Math.min(1, cur / dur)
  const btn = 'rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-black/5 dark:hover:bg-white/10'

  return (
    <div className="w-[min(17rem,70vw)]" data-testid="voice-message">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${fromMe ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]'}`}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : playing ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
        </button>
        <div className="min-w-0 flex-1">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Voice message position"
            aria-valuemin={0}
            aria-valuemax={Math.round(dur)}
            aria-valuenow={Math.round(cur)}
            aria-valuetext={`${formatDuration(cur)} of ${formatDuration(dur)}`}
            onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); void seek(e.clientX, e.currentTarget) }}
            onPointerMove={(e) => { if (e.buttons) void seek(e.clientX, e.currentTarget) }}
            onKeyDown={async (e) => {
              const a = await ensureAudio()
              if (!a) return
              if (e.key === 'ArrowRight') a.currentTime = Math.min(dur, a.currentTime + 5)
              if (e.key === 'ArrowLeft') a.currentTime = Math.max(0, a.currentTime - 5)
            }}
            className="flex h-7 cursor-pointer touch-none items-center gap-[2px]"
          >
            {wave.map((v, i) => (
              <span key={i} className={`w-[3px] flex-1 rounded-full ${i / wave.length < progress ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--text-tertiary))]/50'}`} style={{ height: `${Math.max(12, v * 11)}%` }} />
            ))}
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-[rgb(var(--text-secondary))]">
            <span className="tabular-nums">{playing || cur > 0 ? formatDuration(cur) : formatDuration(dur)}</span>
            <span className="flex items-center gap-0.5">
              <button type="button" onClick={cycleSpeed} aria-label={`Playback speed ${speed}×`} className="rounded-full px-1.5 py-0.5 text-[11px] font-bold hover:bg-black/5 dark:hover:bg-white/10">{speed}×</button>
              <button type="button" onClick={() => setShowTx((s) => !s)} aria-label={showTx ? 'Hide transcript and translation' : 'Transcript and translation'} aria-pressed={showTx} className={btn}>{att.transcript ? <FileText size={13} /> : <Languages size={13} />}</button>
              {canSave && <button type="button" onClick={save} aria-label="Save voice message" className={btn}><Download size={13} /></button>}
            </span>
          </div>
        </div>
      </div>
      {err && <p role="alert" className="mt-1 text-[11px] text-rose-500">{err}</p>}
      {showTx && att.transcript && (
        <div className="mt-2 rounded-lg bg-black/5 p-2 text-[13px] dark:bg-white/5">
          <p className="whitespace-pre-wrap break-words">{att.transcript}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <Languages size={13} className="text-[rgb(var(--text-secondary))]" />
            <select value={lang} onChange={(e) => { setLang(e.target.value); setTr({ busy: false }) }} aria-label="Translate to" className="rounded-md bg-[rgb(var(--bg-panel))] px-1.5 py-0.5 ring-1 ring-[rgb(var(--border))]">
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
            <button type="button" onClick={translate} disabled={tr.busy} className="rounded-full bg-[rgb(var(--accent))] px-2.5 py-0.5 font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-50">
              {tr.busy ? 'Translating…' : 'Translate'}
            </button>
          </div>
          {tr.text && <p className="mt-2 whitespace-pre-wrap break-words border-t border-[rgb(var(--border))] pt-2" lang={lang}>{tr.text}</p>}
          {tr.error && <p role="alert" className="mt-2 text-[11px] text-rose-500">{tr.error}</p>}
        </div>
      )}
      {!att.transcript && showTx && <p className="mt-1 text-[11px] text-[rgb(var(--text-secondary))]">No transcript was recorded with this message, so it can’t be translated.</p>}
    </div>
  )
}
