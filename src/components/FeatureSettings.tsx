import { useState } from 'react'
import { Bell, BellRing, Brush, CalendarDays, Camera, Check, Ghost, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useCalPrefs, useGhostPrefs, useGesturePrefs, INK_COLORS } from '../prefs'
import { useDecoyItems, updateDecoy, removeDecoy, addDecoy, resetDecoys } from '../decoyStore'
import { fileToAvatar } from '../edits'
import { REMIND_OPTIONS, beep, ensureNotifyPermission } from '../calendar'
import { useChatStyle, setSoundOn } from '../chatStyle'
import { SoundControls } from './ChatStyleSheet'

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
const fld = 'w-full rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-1.5 text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]'

export type FeatureSection = 'gestures' | 'sounds' | 'decoy' | 'calendar' | 'ghost'

export default function FeatureSettings({ section }: { section: FeatureSection }) {
  const [cal, setCal] = useCalPrefs()
  const [ghost, setGhost, resetGhost] = useGhostPrefs()
  const [perm, setPerm] = useState<string>(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const permText = perm === 'granted' ? 'On' : perm === 'denied' ? 'Blocked in browser' : perm === 'unsupported' ? 'Not supported here' : 'Off'

  const cs = useChatStyle()
  const [gest, setGest] = useGesturePrefs()
  const decoys = useDecoyItems()
  const pickDecoyPhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) updateDecoy(id, { avatar: await fileToAvatar(f) })
  }
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

  if (section === 'decoy')
    return (
      <div className="space-y-3 px-5 py-2">
        <p className="text-xs text-[rgb(var(--text-secondary))]">These are the harmless chats shown when you enter your decoy PIN. Edit names, messages and times so it looks believable. Set the decoy PIN itself under Privacy &amp; security.</p>
        {decoys.map((d) => (
          <div key={d.id} className="flex items-start gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3">
            <label className="relative shrink-0 cursor-pointer" aria-label={`Change photo for ${d.name}`}>
              <img src={d.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"><Camera size={10} /></span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickDecoyPhoto(d.id, e)} />
            </label>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input value={d.name} onChange={(e) => updateDecoy(d.id, { name: e.target.value })} aria-label="Decoy name" maxLength={30} className={fld} />
              <input value={d.text} onChange={(e) => updateDecoy(d.id, { text: e.target.value })} aria-label="Decoy message" maxLength={80} className={fld} />
              <input type="time" value={/^\d{2}:\d{2}$/.test(d.time) ? d.time : '12:00'} onChange={(e) => updateDecoy(d.id, { time: e.target.value })} aria-label="Decoy time" className={fld} />
            </div>
            <button onClick={() => removeDecoy(d.id)} aria-label={`Remove ${d.name}`} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button onClick={addDecoy} className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))]"><Plus size={13} /> Add decoy chat</button>
          <button onClick={resetDecoys} className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--accent))] hover:underline"><RotateCcw size={12} /> Reset</button>
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
            <button disabled={perm === 'denied' || perm === 'unsupported'} onClick={async () => setPerm(await ensureNotifyPermission())} className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-50"><Bell size={13} /> Enable</button>
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
      <Row title="Hold-to-stay time" desc="Seconds to press and hold before the canvas closes">
        <select value={ghost.grace} onChange={(e) => setGhost({ grace: +e.target.value })} aria-label="Hold-to-stay time" className={sel}>
          {[3, 5, 8, 12].map((s) => <option key={s} value={s}>{s} seconds</option>)}
        </select>
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
