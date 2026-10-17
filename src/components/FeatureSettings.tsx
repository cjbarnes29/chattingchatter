import { useState } from 'react'
import { Bell, BellRing, Brush, CalendarDays, Check, Ghost, RotateCcw } from 'lucide-react'
import { useCalPrefs, useGhostPrefs, useGesturePrefs, INK_COLORS } from '../prefs'
import { REMIND_OPTIONS, beep, ensureNotifyPermission, useNotifyPermission } from '../calendar'
import { isNative } from '../native'
import { useChatStyle, setSoundOn } from '../chatStyle'
import { SoundControls } from './ChatStyleSheet'
import { readTranscribe, setTranscribe, transcriptionSupported } from '../translate'

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--border))]'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="text-xs text-[rgb(var(--text-secondary))]">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

const sel = 'rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-1.5 text-xs font-medium ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))] outline-none'

export type FeatureSection = 'gestures' | 'sounds' | 'calendar' | 'ghost'

export default function FeatureSettings({ section }: { section: FeatureSection }) {
  const [cal, setCal] = useCalPrefs()
  const [ghost, setGhost, resetGhost] = useGhostPrefs()
  const [perm, setPerm] = useNotifyPermission()
  const permText = perm === 'granted' ? 'On' : perm === 'denied' ? (isNative() ? 'Turned off in phone settings' : 'Blocked in browser') : perm === 'unsupported' ? 'Not supported here' : 'Off'

  const cs = useChatStyle()
  const [gest, setGest] = useGesturePrefs()
  const [transcribe, setTx] = useState(readTranscribe)
  const GESTURES: { key: keyof typeof gest; title: string; desc: string }[] = [
    { key: 'swipeReply', title: 'Swipe right to reply', desc: 'Drag a message to the right to reply to it' },
    { key: 'swipeChat', title: 'Swipe left on a chat', desc: 'Reveal Pin and Archive in your inbox' },
    { key: 'doubleTap', title: 'Double-tap to react', desc: 'Double-tap a message to add or remove a heart' },
    { key: 'longPress', title: 'Long-press for menu', desc: 'Hold a message to edit, tag, react or delete' },
    { key: 'edgeBack', title: 'Swipe from the edge to go back', desc: 'Drag from the screen edge to leave a chat' },
    { key: 'shakeLock', title: 'Shake to lock', desc: 'Shake your phone to lock Chatter (needs a PIN)' },
  ]
  const list = 'divide-y divide-[rgb(var(--border))] px-5'

  if (section === 'gestures')
    return (
      <div className={list}>
        {GESTURES.map((g) => (
          <Row key={g.key} title={g.title} desc={g.desc}>
            <Toggle on={gest[g.key]} onChange={(v) => setGest({ [g.key]: v })} label={g.title} />
          </Row>
        ))}
        <Row
          title="Voice message transcripts"
          desc={transcriptionSupported()
            ? 'Add a written transcript to voice messages you send, so they can be read and translated. Uses your browser’s speech service while you record.'
            : 'Not available on this device, so voice messages are sent without a transcript.'}
        >
          <Toggle on={transcribe && transcriptionSupported()} onChange={(v) => { setTranscribe(v); setTx(v) }} label="Voice message transcripts" />
        </Row>
      </div>
    )

  if (section === 'sounds')
    return (
      <div className={list}>
        <Row title="Message sounds" desc="Play a sound when a new message arrives">
          <Toggle on={cs.soundOn} onChange={setSoundOn} label="Message sounds" />
        </Row>
        <div className="py-3">
          <p className="mb-2 text-sm font-semibold">Your sound</p>
          <SoundControls chatId="global" />
          <p className="mt-2 text-[11px] text-[rgb(var(--text-secondary))]">Pick any audio file from your phone. To use a different sound for one person, open their chat and tap the palette icon.</p>
        </div>
      </div>
    )

  if (section === 'calendar')
    return (
      <div className={list}>
        <Row title="Event notifications" desc={`Status: ${permText}. Alarms also show inside the app and post a chat reminder.`}>
          {perm === 'granted' ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--accent))]"><Check size={13} /> On</span>
          ) : (
            <button disabled={(perm === 'denied' && !isNative()) || perm === 'unsupported'} onClick={async () => setPerm(await ensureNotifyPermission())} className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-50"><Bell size={13} /> Enable</button>
          )}
        </Row>
        <Row title="Alarm sound" desc="Play a short chime when an event alarm goes off">
          <div className="flex items-center gap-2">
            <button onClick={beep} aria-label="Test alarm sound" className="rounded-full p-1.5 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent-soft))]"><BellRing size={15} /></button>
            <Toggle on={cal.sound} onChange={(v) => setCal({ sound: v })} label="Alarm sound" />
          </div>
        </Row>
        <Row title="Default reminder" desc="Pre-selected when you add an event">
          <select value={cal.defaultRemind} onChange={(e) => setCal({ defaultRemind: +e.target.value })} aria-label="Default reminder" className={sel}>
            {REMIND_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </Row>
        <p className="flex items-start gap-2 py-3 text-[11px] leading-relaxed text-[rgb(var(--text-secondary))]"><CalendarDays size={13} className="mt-0.5 shrink-0" /> Open any chat and tap the calendar icon to add an event.</p>
      </div>
    )

  return (
    <div className={list}>
      <Row title="Fade-out time" desc="How long ink and notes last before they dissolve">
        <select value={ghost.lifetime} onChange={(e) => setGhost({ lifetime: +e.target.value })} aria-label="Fade-out time" className={sel}>
          {[5, 10, 20, 30, 60].map((s) => <option key={s} value={s}>{s} seconds</option>)}
        </select>
      </Row>
      <Row title="Ink colour" desc="Your classic brush and notes">
        <div className="flex gap-1.5">
          {INK_COLORS.map((c) => (
            <button key={c} onClick={() => setGhost({ ink: c })} aria-label={`Ink ${c}`} aria-pressed={ghost.ink === c} className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--bg-panel))] ${ghost.ink === c ? 'ring-[rgb(var(--text-primary))]' : 'ring-transparent'}`} style={{ background: c }} />
          ))}
        </div>
      </Row>
      <Row title="Brush thickness" desc={`${ghost.inkWidth}px`}>
        <div className="flex items-center gap-2">
          <Brush size={13} className="text-[rgb(var(--text-tertiary))]" />
          <input type="range" min={2} max={12} value={ghost.inkWidth} onChange={(e) => setGhost({ inkWidth: +e.target.value })} aria-label="Brush thickness" className="w-28 accent-[rgb(var(--accent))]" />
        </div>
      </Row>
      <Row title="Dotted grid" desc="Show the faint dot grid behind drawings">
        <Toggle on={ghost.grid} onChange={(v) => setGhost({ grid: v })} label="Dotted grid" />
      </Row>
      <Row title="Close when I leave" desc="Wipe the canvas if you switch apps or tabs">
        <Toggle on={ghost.exitOnLeave} onChange={(v) => setGhost({ exitOnLeave: v })} label="Close when I leave" />
      </Row>
      <Row title="Demo friend doodles" desc="Simulated scribbles from your friend while testing">
        <Toggle on={ghost.demoFriend} onChange={(v) => setGhost({ demoFriend: v })} label="Demo friend doodles" />
      </Row>
      <div className="flex items-center gap-2 py-3">
        <Ghost size={13} className="text-[rgb(var(--text-tertiary))]" />
        <p className="flex-1 text-[11px] text-[rgb(var(--text-secondary))]">Open a chat and tap the ghost icon to start a canvas. Changes apply the next time you open one.</p>
        <button onClick={resetGhost} className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--accent))] hover:underline"><RotateCcw size={12} /> Reset</button>
      </div>
    </div>
  )
}
