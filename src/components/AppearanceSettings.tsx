import { Moon, Sun, RotateCcw, Check } from 'lucide-react'
import {
  useAppearance, setAppearance, resetAppearance, SIZES, FONTS, TAB_COLORS, NAV_COLORS, BUBBLE_OUT_COLORS, BUBBLE_IN_COLORS, SHAPES,
  type Motion,
} from '../appearance'

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--border))]'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

const Title = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-6 px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{children}</h3>
)

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="px-5 py-3">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c || 'default'}
            onClick={() => onPick(c)}
            aria-label={c ? `${label} ${c}` : `${label} default`}
            aria-pressed={value === c}
            className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--bg-panel))] transition ${value === c ? 'ring-[rgb(var(--text-primary))]' : 'ring-transparent'}`}
            style={c ? { background: c, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .12)' } : undefined}
          >
            {c === '' && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--bg-panel-soft))] text-[9px] font-bold text-[rgb(var(--text-secondary))] ring-1 ring-[rgb(var(--border))]">Auto</span>}
            {c !== '' && value === c && <Check size={14} className="mix-blend-difference text-white" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chips<T extends string | number>({ items, value, onPick }: { items: { id: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2 px-5 pb-3">
      {items.map((i) => (
        <button key={String(i.id)} onClick={() => onPick(i.id)} aria-pressed={value === i.id} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${value === i.id ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

export default function AppearanceSettings({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const a = useAppearance()
  const motions: { id: Motion; label: string }[] = [
    { id: 'lively', label: 'Lively' },
    { id: 'normal', label: 'Normal' },
    { id: 'off', label: 'Off' },
  ]
  return (
    <div className="pb-4">
      {/* live preview of the chat screen */}
      <div className="px-5 pt-4">
        <div className="overflow-hidden rounded-2xl ring-1 ring-[rgb(var(--border))]">
          <div className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold ${a.navColor ? 'nav-custom' : 'bg-[rgb(var(--bg-panel))]'}`}>
            <span className="h-6 w-6 rounded-full bg-[rgb(var(--accent))]" /> Preview chat
          </div>
          <div className="chat-wallpaper space-y-2 px-3 py-3">
            <div className="flex">
              <div className="bubble max-w-[75%] rounded-bl-sm bg-[rgb(var(--bubble-in))] px-3 py-2" style={{ fontSize: 'calc(14.5px * var(--font-scale, 1))', color: 'rgb(var(--bubble-in-fg, var(--text-primary)))' }}>Hey! How do the colours look?</div>
            </div>
            <div className="flex justify-end">
              <div className="bubble max-w-[75%] rounded-br-sm bg-[rgb(var(--bubble-out))] px-3 py-2" style={{ fontSize: 'calc(14.5px * var(--font-scale, 1))', color: 'rgb(var(--bubble-out-fg, var(--text-primary)))' }}>Looking great on my screen.</div>
            </div>
            <div className="flex gap-1.5 pt-1">
              {['All', 'Favorites', 'Groups'].map((t, i) => (
                <span key={t} className={`rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? 'bg-[rgb(var(--tab-active,var(--accent)))] text-[rgb(var(--tab-active-fg,var(--accent-foreground)))]' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 px-5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]">{dark ? <Moon size={16} /> : <Sun size={16} />}</span>
        <div className="flex-1"><p className="text-sm font-semibold">Dark mode</p><p className="text-xs text-[rgb(var(--text-secondary))]">Easier on the eyes at night</p></div>
        <Toggle on={dark} onChange={onToggleDark} label="Dark mode" />
      </div>

      <Title>Text</Title>
      <p className="px-5 pb-2 text-sm font-semibold">Font size</p>
      <Chips items={SIZES.map((s, i) => ({ id: i, label: s.label }))} value={a.fontSize} onPick={(v) => setAppearance({ fontSize: v })} />
      <p className="px-5 pb-2 text-sm font-semibold">Font style</p>
      <div className="flex flex-wrap gap-2 px-5 pb-3">
        {FONTS.map((f) => (
          <button key={f.id} onClick={() => setAppearance({ font: f.id })} aria-pressed={a.font === f.id} style={{ fontFamily: `${f.css}, system-ui` }} className={`rounded-xl px-3.5 py-2 text-sm ring-1 transition ${a.font === f.id ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}>{f.label}</button>
        ))}
      </div>

      <Title>Colours</Title>
      <Swatches label="Tab colour" colors={TAB_COLORS} value={a.tabColor} onPick={(c) => setAppearance({ tabColor: c })} />
      <Swatches label="Navigation bar colour" colors={NAV_COLORS} value={a.navColor} onPick={(c) => setAppearance({ navColor: c })} />
      <Swatches label="Your message bubbles" colors={BUBBLE_OUT_COLORS} value={a.bubbleOut} onPick={(c) => setAppearance({ bubbleOut: c })} />
      <Swatches label="Their message bubbles" colors={BUBBLE_IN_COLORS} value={a.bubbleIn} onPick={(c) => setAppearance({ bubbleIn: c })} />

      <Title>Chat screen</Title>
      <p className="px-5 pb-2 text-sm font-semibold">Bubble shape</p>
      <Chips items={SHAPES.map((s) => ({ id: s.id, label: s.label }))} value={a.bubbleShape} onPick={(v) => setAppearance({ bubbleShape: v })} />
      <div className="flex items-center gap-3 px-5 py-3">
        <div className="flex-1"><p className="text-sm font-semibold">Plain chat background</p><p className="text-xs text-[rgb(var(--text-secondary))]">Hide the contour pattern behind messages</p></div>
        <Toggle on={a.plainChat} onChange={(v) => setAppearance({ plainChat: v })} label="Plain chat background" />
      </div>
      <p className="px-5 pb-2 pt-1 text-xs text-[rgb(var(--text-secondary))]">Wallpapers for a single chat are in that chat's palette menu.</p>

      <Title>Animations</Title>
      <Chips items={motions} value={a.motion} onPick={(v) => setAppearance({ motion: v })} />
      <p className="px-5 text-xs text-[rgb(var(--text-secondary))]">Lively adds a bounce to new messages and buttons. Off removes movement for a calmer app.</p>

      <div className="px-5 pt-5">
        <button onClick={resetAppearance} className="flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--accent))] hover:underline"><RotateCcw size={12} /> Reset appearance</button>
      </div>
    </div>
  )
}
