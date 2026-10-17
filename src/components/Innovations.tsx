import { useEffect, useMemo, useRef, useState } from 'react'
import { Fingerprint, Lock, Sparkles, Mic, Eye, Tag, X, Send, Clock } from 'lucide-react'
import { usePro } from '../pro'
import { biometricEnabled, biometricEnrolled, verifyBiometric } from '../biometric'
import { fmtWait, validPin, PIN_MAX } from '../pinLock'
import SecretInput from './SecretInput'

/* ---------- Confidential lock ---------- */
/** Asks for proof before showing confidential content: the fingerprint/face check if it is set up,
 *  otherwise (or as a fallback) the real PIN. It never opens without one of them. The decoy PIN does
 *  not open it, and wrong PINs count towards the app lock's wrong-guess limit. */
export function PrivateLock({ onUnlock, onCancel, title = 'Private messages locked', desc = 'Verify it’s you to read confidential messages in this chat.' }: { onUnlock: () => void; onCancel: () => void; title?: string; desc?: string }) {
  const [state, setState] = useState<'idle' | 'scanning' | 'fail'>('idle')
  const [err, setErr] = useState('')
  const [pin, setPin] = useState('')
  const { hasPins, verifyPin, lockedUntil } = usePro()
  const canBio = biometricEnabled() && biometricEnrolled()

  const verify = async () => {
    setErr('')
    setState('scanning')
    const r = await verifyBiometric()
    if (r.ok) return onUnlock()
    setState('fail')
    setErr(r.error ?? 'Verification failed.')
  }
  // typing only fills the box; the PIN is checked when Unlock (or Enter) is used
  const tryPin = (v: string) => setPin(v.slice(0, PIN_MAX))
  const submit = async (v: string) => {
    if (!validPin(v)) return
    if (Date.now() < lockedUntil) return setErr(`Too many wrong PINs. Try again in ${fmtWait(lockedUntil - Date.now())}.`)
    const r = await verifyPin(v)
    if (r === 'real') return onUnlock()
    setPin('')
    setErr(r === 'locked' ? 'Too many wrong PINs. Wait a moment and try again.' : 'That PIN didn’t work.')
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[rgb(var(--bg-panel))] p-6 text-center">
      <button onClick={onCancel} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]">
        <X size={18} />
      </button>
      <div className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))] ${state === 'scanning' ? 'animate-pulse' : ''}`}>
        {canBio ? <Fingerprint size={40} /> : <Lock size={36} />}
      </div>
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-[rgb(var(--text-secondary))]">{desc}</p>
      </div>
      {canBio && (
        <button
          onClick={verify}
          disabled={state === 'scanning'}
          className="flex items-center gap-2 rounded-full bg-[rgb(var(--accent))] px-6 py-2.5 text-sm font-semibold text-[rgb(var(--accent-foreground))] shadow-md transition hover:scale-[1.02] active:scale-95 disabled:opacity-70"
        >
          <Fingerprint size={16} />
          {state === 'scanning' ? 'Verifying…' : 'Unlock with fingerprint or face'}
        </button>
      )}
      {hasPins ? (
        <form onSubmit={(e) => { e.preventDefault(); void submit(pin) }} className="flex items-center gap-2">
          <SecretInput
            autoFocus={!canBio}
            value={pin}
            onChange={tryPin}
            maxLength={PIN_MAX}
            placeholder={canBio ? 'Or enter your PIN' : 'Enter your PIN'}
            label="PIN"
            wrapClassName="w-44"
            className="w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3 py-2 text-center text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]"
          />
          <button type="submit" disabled={!validPin(pin)} aria-label="Unlock" className="rounded-xl bg-[rgb(var(--accent))] p-2 text-[rgb(var(--accent-foreground))] disabled:opacity-40"><Lock size={16} /></button>
        </form>
      ) : (
        !canBio && <p className="max-w-xs text-xs text-[rgb(var(--text-secondary))]">Set a PIN in Settings → Privacy &amp; security to open this.</p>
      )}
      {err && <p role="alert" className="max-w-xs text-xs text-rose-500">{err}</p>}
    </div>
  )
}

/* ---------- On-device AI: smart replies + voice-to-text (simulated locally) ---------- */
export function SmartReplies({ lastText, onPick }: { lastText?: string; onPick: (t: string) => void }) {
  const suggestions = useMemo(() => {
    if (!lastText) return []
    if (/\?$/.test(lastText.trim())) return ['Yes, sounds good 👍', 'Let me check and reply', 'Not sure yet']
    if (/thank/i.test(lastText)) return ['You’re welcome!', 'Anytime 😊']
    return ['Got it', 'Haha 😂', 'Sounds good']
  }, [lastText])
  if (!suggestions.length) return null
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 md:px-5">
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--accent))]">
        <Sparkles size={12} /> On-device
      </span>
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="shrink-0 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-3 py-1 text-xs font-medium transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
        >
          {s}
        </button>
      ))}
    </div>
  )
}

export function VoiceToText({ onText }: { onText: (t: string) => void }) {
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState('')
  const recRef = useRef<any>(null)
  const toggle = async () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    setErr('')
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return setErr('Voice typing is not supported in this browser. Use the mic on your keyboard.')
    // Ask for the microphone first so the permission prompt always appears
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('nomic')
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach((t) => t.stop())
    } catch (e) {
      const n = (e as { name?: string })?.name
      return setErr(n === 'NotAllowedError' ? 'Microphone is blocked. Allow it in your browser or phone settings.' : n === 'NotFoundError' ? 'No microphone found.' : 'Microphone is not available (needs https).')
    }
    const rec = new SR()
    recRef.current = rec
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (ev: any) => {
      let t = ''
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript
      onText(t)
    }
    rec.onerror = (ev: any) => setErr(ev.error === 'not-allowed' ? 'Microphone is blocked. Allow it in settings.' : ev.error === 'no-speech' ? 'Did not hear anything. Try again.' : 'Voice typing failed. Try again.')
    rec.onend = () => setListening(false)
    try {
      rec.start()
      setListening(true)
    } catch {
      setErr('Could not start the microphone.')
    }
  }
  return (
    <div className="relative">
      {err && (
        <p role="alert" onClick={() => setErr('')} className="absolute bottom-14 right-0 z-30 w-56 rounded-xl bg-[rgb(var(--bg-panel))] p-2.5 text-xs text-rose-500 shadow-xl ring-1 ring-[rgb(var(--border))]">{err}</p>
      )}
    <button
      type="button"
      onClick={toggle}
      aria-label="Voice to text"
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow-md transition hover:scale-105 ${listening ? 'ring-4 ring-[rgb(var(--accent-soft))]' : ''}`}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-[rgb(var(--accent))]/40" />}
      <Mic size={18} className="relative" />
    </button>
    </div>
  )
}

/* ---------- Loopable animated activity indicators (mood-based) ---------- */
export type Mood = 'playful' | 'calm' | 'excited'
export function MoodIndicator({ mood }: { mood: Mood }) {
  if (mood === 'playful')
    return (
      <div className="flex items-end gap-0.5" aria-label="Typing, playful">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="mood-bar w-1 rounded-full bg-[rgb(var(--accent))]" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    )
  if (mood === 'excited')
    return (
      <div className="flex items-center gap-1" aria-label="Typing, excited">
        {[0, 1, 2].map((i) => (
          <span key={i} className="mood-pop h-2 w-2 rounded-full bg-[rgb(var(--accent))]" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    )
  return (
    <div className="flex items-center gap-1" aria-label="Typing, calm">
      {[0, 1, 2].map((i) => (
        <span key={i} className="mood-wave h-1.5 w-1.5 rounded-full bg-[rgb(var(--text-secondary))]" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  )
}

/* ---------- Emoji stories: 🌅+☕+📖 chained animated mini-story ---------- */
export function EmojiStory({ text }: { text: string }) {
  const parts = text.split('+').map((p) => p.trim()).filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-3xl" aria-label={`Emoji story: ${parts.join(' then ')}`}>
      {parts.map((p, i) => (
        <span key={i} className="story-step inline-block" style={{ animationDelay: `${i * 0.25}s` }}>
          {p}
          {i < parts.length - 1 && <span className="ml-1.5 text-base font-bold text-[rgb(var(--accent))]">+</span>}
        </span>
      ))}
    </div>
  )
}

export function isEmojiStory(text: string) {
  return /\+/.test(text) && /\p{Extended_Pictographic}/u.test(text) && text.split('+').every((p) => p.trim().length > 0 && p.trim().length <= 8)
}

/* ---------- Viewing cue: blinking eye + lighter bubble ---------- */
export function ViewingEye({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[rgb(var(--accent))]" title="Viewing now">
      <Eye size={12} className="blink-eye" />
      viewing
    </span>
  )
}

/* ---------- Tags ---------- */
export const TAG_DEFS = [
  { id: 'work', label: 'Work', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
  { id: 'plans', label: 'Plans', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  { id: 'ideas', label: 'Ideas', color: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
  { id: 'memories', label: 'Memories', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-300' },
] as const

export type TagId = (typeof TAG_DEFS)[number]['id']

export function TagChip({ id }: { id: TagId }) {
  const def = TAG_DEFS.find((t) => t.id === id)!
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${def.color}`}>
      <Tag size={10} /> {def.label}
    </span>
  )
}

export function TagPicker({ value, onChange }: { value: TagId[]; onChange: (t: TagId[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_DEFS.map((t) => {
        const on = value.includes(t.id)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== t.id) : [...value, t.id])}
            aria-pressed={on}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${on ? t.color + ' ring-1 ring-current' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Timeline Jump: weekly strip of media thumbnails as time anchors ---------- */
export type TimelineAnchor = { id: string; label: string; thumb: string }

export function TimelineJump({ anchors, onJump }: { anchors: TimelineAnchor[]; onJump: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null)
  if (!anchors.length) return null
  return (
    <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-4 py-2 md:px-5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))]">
        <Clock size={12} /> Timeline · this week
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {anchors.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              setActive(a.id)
              onJump(a.id)
            }}
            aria-label={`Jump to ${a.label}`}
            className={`group flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition ${active === a.id ? 'bg-[rgb(var(--accent-soft))]' : 'hover:bg-[rgb(var(--bg-panel-soft))]'}`}
          >
            <span className="relative block h-12 w-16 overflow-hidden rounded-lg ring-1 ring-[rgb(var(--border))]">
              <img src={a.thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
            </span>
            <span className="text-[10px] font-medium text-[rgb(var(--text-secondary))]">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- Notification quick-reply panel (shown from the "pull-down" preview) ---------- */
export function NotificationPanel({
  name,
  avatar,
  preview,
  onReply,
  onClose,
}: {
  name: string
  avatar: string
  preview: string
  onReply: (t: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  useEffect(() => {
    const t = window.setTimeout(onClose, 25000)
    return () => window.clearTimeout(t)
  }, [onClose])
  return (
    <div className="pointer-events-auto fixed left-1/2 top-4 z-50 w-[min(92vw,380px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-3 shadow-2xl slide-down">
      <div className="flex items-start gap-3">
        <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="truncate text-sm font-semibold">{name}</p>
            <button onClick={onClose} aria-label="Dismiss" className="rounded-full p-1 text-[rgb(var(--text-tertiary))] hover:bg-[rgb(var(--accent-soft))]">
              <X size={14} />
            </button>
          </div>
          <p className="truncate text-sm text-[rgb(var(--text-secondary))]">{preview}</p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          onReply(text.trim())
          setText('')
          onClose()
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick reply…"
          aria-label="Quick reply"
          className="min-w-0 flex-1 rounded-full bg-[rgb(var(--bg-panel-soft))] px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]"
        />
        <button type="submit" aria-label="Send quick reply" className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]">
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}
