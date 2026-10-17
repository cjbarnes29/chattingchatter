import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Lock, Sun, Moon, MonitorSmartphone, RotateCcw, Check, LayoutList, LayoutGrid, Users, MessageSquarePlus, Plus, Archive } from 'lucide-react'
import { Lock as LockIcon } from 'lucide-react'
import { Toggle } from './settingsUi'
import { getInterface, saveInterface, previewInterface, cancelPreview, resolveDark } from '../interface'
import {
  ACCENTS, ALL_SECTIONS, ALL_SHORTCUTS, ALL_TABS, ALL_WIDGETS, DEFAULT_PREFS, ESSENTIAL_SHORTCUTS, ESSENTIAL_TABS, PRESETS,
  applyPreset, move, toggleIn, type InterfacePrefs, type ShortcutId,
} from '../interfacePrefs'

const Title = ({ children, note }: { children: React.ReactNode; note?: string }) => (
  <div className="mt-6 px-5 pb-2">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">{children}</h3>
    {note && <p className="mt-0.5 text-xs text-[rgb(var(--text-secondary))]">{note}</p>}
  </div>
)

function Chips<T extends string | number>({ label, items, value, onPick }: { label: string; items: { id: T; label: string; icon?: React.ReactNode }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="px-5 pb-3">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button
            key={String(i.id)}
            role="radio"
            aria-checked={value === i.id}
            onClick={() => onPick(i.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition ${value === i.id ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}
          >
            {i.icon}
            {i.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SwitchRow({ title, desc, on, onChange }: { title: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="text-xs text-[rgb(var(--text-secondary))]">{desc}</p>}
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  )
}

/** Choose which items show and in what order. Locked items stay visible but can still be moved. */
function OrderList<T extends string>({ items, visible, locked = [], onChange }: { items: { id: T; label: string; desc?: string }[]; visible: T[]; locked?: T[]; onChange: (next: T[]) => void }) {
  const hidden = items.filter((i) => !visible.includes(i.id))
  const shown = visible.map((id) => items.find((i) => i.id === id)!).filter(Boolean)
  const arrow = 'rounded-lg p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))] disabled:opacity-30'
  return (
    <ul className="mx-5 divide-y divide-[rgb(var(--border))] rounded-2xl bg-[rgb(var(--bg-panel-soft))]">
      {[...shown, ...hidden].map((item) => {
        const on = visible.includes(item.id)
        const isLocked = locked.includes(item.id)
        const i = visible.indexOf(item.id)
        return (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${on ? '' : 'text-[rgb(var(--text-secondary))]'}`}>{item.label}</p>
              {item.desc && <p className="text-xs text-[rgb(var(--text-secondary))]">{item.desc}</p>}
            </div>
            {on && (
              <>
                <button className={arrow} disabled={i === 0} onClick={() => onChange(move(visible, item.id, -1))} aria-label={`Move ${item.label} up`}><ChevronUp size={16} /></button>
                <button className={arrow} disabled={i === visible.length - 1} onClick={() => onChange(move(visible, item.id, 1))} aria-label={`Move ${item.label} down`}><ChevronDown size={16} /></button>
              </>
            )}
            {isLocked ? (
              <span className="flex w-11 justify-center text-[rgb(var(--text-tertiary))]" title="Always shown"><Lock size={14} aria-label="Always shown" /></span>
            ) : (
              <Toggle on={on} onChange={(v) => onChange(toggleIn(visible, item.id, v))} label={`Show ${item.label}`} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

const SHORTCUT_ICON: Record<ShortcutId, React.ReactNode> = {
  theme: <Moon size={13} />,
  contacts: <Users size={13} />,
  newChat: <MessageSquarePlus size={13} />,
  newGroup: <Plus size={13} />,
  archived: <Archive size={13} />,
  lock: <LockIcon size={13} />,
}
const SAMPLE = [
  { name: 'Amy Chen', text: 'See you at 7! I’ll bring the snacks and the board game.', time: '18:42', unread: 2 },
  { name: 'Weekend plans', text: 'Sam: Who’s driving on Saturday morning?', time: '17:05', unread: 0 },
  { name: 'Jordan', text: 'Thanks for the help today', time: '09:12', unread: 0 },
]

/** Small inbox mock-up that reflects the draft (colours come from the live preview on the page). */
function Preview({ p }: { p: InterfacePrefs }) {
  const pad = p.density === 'compact' ? 'py-1' : p.density === 'spacious' ? 'py-3' : 'py-2'
  const av = p.density === 'compact' ? 'h-7 w-7' : p.density === 'spacious' ? 'h-10 w-10' : 'h-8 w-8'
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl bg-[rgb(var(--bg-panel))] ring-1 ring-[rgb(var(--border))]">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="text-sm font-extrabold">Inbox</span>
        <span className="flex items-center gap-1.5 text-[rgb(var(--text-secondary))]">
          {p.shortcuts.map((s) => <span key={s}>{SHORTCUT_ICON[s]}</span>)}
          <span className="h-5 w-5 rounded-full bg-[rgb(var(--accent-soft))] ring-1 ring-[rgb(var(--accent))]" />
        </span>
      </div>
      {p.sections.search && <div className="mx-3 mt-2 h-6 rounded-lg bg-[rgb(var(--bg-panel-soft))]" />}
      {p.sections.stories && (
        <div className="flex gap-2 px-3 pt-2">{[0, 1, 2, 3].map((i) => <span key={i} className="h-7 w-7 rounded-full bg-gradient-to-br from-[rgb(var(--accent))] to-amber-400" />)}</div>
      )}
      <div className="flex gap-1 px-3 py-2">
        {p.dashboard.enabled && <span className="rounded-full bg-[rgb(var(--bg-panel-soft))] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--text-secondary))]">Home</span>}
        {p.tabs.map((t) => (
          <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t === p.defaultTab ? 'bg-[rgb(var(--tab-active))] text-[rgb(var(--tab-active-fg))]' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}>
            {ALL_TABS.find((x) => x.id === t)?.label}
          </span>
        ))}
      </div>
      {p.inboxLayout === 'grid' ? (
        <div className="grid grid-cols-3 gap-1 px-2 pb-3">
          {SAMPLE.map((c) => (
            <div key={c.name} className={`flex flex-col items-center gap-1 ${pad}`}>
              <span className={`${av} rounded-full bg-[rgb(var(--bg-panel-soft))] ring-1 ring-[rgb(var(--border))]`} />
              <span className="w-full truncate text-center text-[10px] font-semibold">{c.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="px-2 pb-2">
          {SAMPLE.map((c) => (
            <li key={c.name} className={`flex items-center gap-2 rounded-lg px-1.5 ${pad}`}>
              <span className={`${av} shrink-0 rounded-full bg-[rgb(var(--bg-panel-soft))] ring-1 ring-[rgb(var(--border))]`} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="text-[rgb(var(--text-tertiary))]">{c.time}</span>
                </div>
                {p.preview > 0 && <p className={`text-[10px] text-[rgb(var(--text-secondary))] ${p.preview === 2 ? 'line-clamp-2' : 'truncate'}`}>{c.text}</p>}
              </div>
              {c.unread > 0 && <span className="rounded-full bg-[rgb(var(--accent))] px-1.5 text-[10px] font-bold text-[rgb(var(--accent-foreground))]">{c.unread}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const same = (a: InterfacePrefs, b: InterfacePrefs) => JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 })

export default function InterfaceSettings({ onOpenAppearance, onDone }: { onOpenAppearance?: () => void; onDone?: () => void }) {
  const [saved, setSaved] = useState<InterfacePrefs>(getInterface)
  const [draft, setDraft] = useState<InterfacePrefs>(getInterface)
  const [justSaved, setJustSaved] = useState(false)
  const dirty = !same(draft, saved)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  // colours, contrast and spacing preview live on the whole app while this page is open
  useEffect(() => {
    previewInterface(draft)
  }, [draft])
  // leaving without saving puts the saved look back
  useEffect(() => () => {
    if (dirtyRef.current) cancelPreview()
  }, [])

  const edit = (patch: Partial<InterfacePrefs>) => {
    setJustSaved(false)
    setDraft((d) => ({ ...d, ...patch, preset: 'custom' }))
  }
  const save = () => {
    saveInterface(draft)
    const now = getInterface()
    setSaved(now)
    setDraft(now)
    setJustSaved(true)
  }
  const cancel = () => {
    setDraft(saved)
    cancelPreview()
    onDone?.()
  }
  const reset = () => {
    setJustSaved(false)
    setDraft({ ...DEFAULT_PREFS, preset: 'default', updatedAt: draft.updatedAt })
  }
  const dark = resolveDark(draft)

  return (
    <div>
      <div className="px-5 pt-4">
        <Preview p={draft} />
        <p className="mt-2 text-xs text-[rgb(var(--text-secondary))]">Colours and text changes preview across the app. Nothing is kept until you tap Save.</p>
      </div>

      <Title note="Presets change layout and navigation only. Your theme, accent and account stay as they are.">Presets</Title>
      <div className="grid grid-cols-2 gap-2 px-5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setJustSaved(false)
              setDraft((d) => applyPreset(d, p.id))
            }}
            aria-pressed={draft.preset === p.id}
            className={`rounded-2xl p-3 text-left ring-1 transition ${draft.preset === p.id ? 'bg-[rgb(var(--accent-soft))] ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}
          >
            <p className="flex items-center gap-1.5 text-sm font-bold">{draft.preset === p.id && <Check size={14} className="text-[rgb(var(--accent))]" />}{p.label}</p>
            <p className="mt-0.5 text-xs text-[rgb(var(--text-secondary))]">{p.desc}</p>
          </button>
        ))}
      </div>
      {draft.preset === 'custom' && <p className="px-5 pt-2 text-xs text-[rgb(var(--text-secondary))]">Custom: you’ve adjusted things by hand.</p>}

      <Title>Theme</Title>
      <Chips
        label="Mode"
        items={[
          { id: 'light', label: 'Light', icon: <Sun size={13} /> },
          { id: 'dark', label: 'Dark', icon: <Moon size={13} /> },
          { id: 'system', label: 'Match device', icon: <MonitorSmartphone size={13} /> },
        ]}
        value={draft.theme}
        onPick={(v) => edit({ theme: v })}
      />
      <div className="px-5 pb-3">
        <p className="mb-2 text-sm font-semibold">Accent colour</p>
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id || 'ember'}
              role="radio"
              aria-checked={draft.accent === a.id}
              aria-label={a.label}
              title={a.label}
              onClick={() => edit({ accent: a.id })}
              className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--bg-panel))] transition ${draft.accent === a.id ? 'ring-[rgb(var(--text-primary))]' : 'ring-transparent'}`}
              style={{ background: dark ? a.dark : a.light }}
            >
              {draft.accent === a.id && <Check size={15} className={dark ? 'text-black' : 'text-white'} />}
            </button>
          ))}
        </div>
      </div>
      <SwitchRow title="High-contrast text" desc="Darker grey text and clearer borders" on={draft.highContrast} onChange={(v) => edit({ highContrast: v })} />
      <SwitchRow title="Relaxed line spacing" desc="More space between lines for easier reading" on={draft.relaxedText} onChange={(v) => edit({ relaxedText: v })} />
      {onOpenAppearance && (
        <button onClick={onOpenAppearance} className="px-5 pt-1 text-xs font-semibold text-[rgb(var(--accent))] hover:underline">
          Text size, fonts and bubble colours are in Appearance →
        </button>
      )}

      <Title>Inbox layout</Title>
      <Chips
        label="View"
        items={[
          { id: 'list', label: 'List', icon: <LayoutList size={13} /> },
          { id: 'grid', label: 'Grid', icon: <LayoutGrid size={13} /> },
        ]}
        value={draft.inboxLayout}
        onPick={(v) => edit({ inboxLayout: v })}
      />
      <Chips
        label="Density"
        items={[
          { id: 'compact', label: 'Compact' },
          { id: 'comfortable', label: 'Comfortable' },
          { id: 'spacious', label: 'Spacious' },
        ]}
        value={draft.density}
        onPick={(v) => edit({ density: v })}
      />
      {draft.inboxLayout === 'list' && (
        <Chips
          label="Message preview"
          items={[
            { id: 0, label: 'Hidden' },
            { id: 1, label: '1 line' },
            { id: 2, label: '2 lines' },
          ]}
          value={draft.preview}
          onPick={(v) => edit({ preview: v })}
        />
      )}
      <Chips
        label="Sort chats by"
        items={[
          { id: 'recent', label: 'Most recent' },
          { id: 'unread', label: 'Unread first' },
          { id: 'name', label: 'Name' },
        ]}
        value={draft.sort}
        onPick={(v) => edit({ sort: v })}
      />
      <p className="px-5 pb-2 text-xs text-[rgb(var(--text-secondary))]">Pinned chats always stay at the top.</p>
      <Chips label="Open on tab" items={draft.tabs.map((t) => ({ id: t, label: ALL_TABS.find((x) => x.id === t)!.label }))} value={draft.defaultTab} onPick={(v) => edit({ defaultTab: v })} />

      <Title note="Choose which filters appear above your chats and their order. All is always there.">Inbox tabs</Title>
      <OrderList
        items={ALL_TABS}
        visible={draft.tabs}
        locked={ESSENTIAL_TABS}
        onChange={(tabs) => edit({ tabs, defaultTab: tabs.includes(draft.defaultTab) ? draft.defaultTab : 'all' })}
      />

      <Title note="Buttons at the top of the inbox. New chat and Settings (your photo) are always shown.">Navigation shortcuts</Title>
      <OrderList items={ALL_SHORTCUTS} visible={draft.shortcuts} locked={ESSENTIAL_SHORTCUTS} onChange={(shortcuts) => edit({ shortcuts })} />

      <Title>Inbox sections</Title>
      {ALL_SECTIONS.map((s) => (
        <SwitchRow key={s.id} title={s.label} desc={s.desc} on={draft.sections[s.id]} onChange={(v) => edit({ sections: { ...draft.sections, [s.id]: v } })} />
      ))}

      <Title note="Shows names, counts and times only, never message text.">Home dashboard</Title>
      <SwitchRow
        title="Show Home dashboard"
        desc="A Home tab on phones, and the empty panel on larger screens"
        on={draft.dashboard.enabled}
        onChange={(v) => edit({ dashboard: { ...draft.dashboard, enabled: v } })}
      />
      {draft.dashboard.enabled && (
        <div className="pt-2">
          <OrderList items={ALL_WIDGETS} visible={draft.dashboard.widgets} onChange={(widgets) => edit({ dashboard: { ...draft.dashboard, widgets } })} />
        </div>
      )}

      <div className="mt-6 px-5">
        <button onClick={reset} className="flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--accent))] hover:underline">
          <RotateCcw size={12} /> Reset to default
        </button>
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-5 py-3">
        <p className="min-w-0 flex-1 text-xs text-[rgb(var(--text-secondary))]" aria-live="polite">
          {dirty ? 'Unsaved changes' : justSaved ? 'Saved' : 'No changes'}
        </p>
        <button onClick={cancel} className="rounded-xl border border-[rgb(var(--border))] px-4 py-2.5 text-sm font-semibold transition hover:bg-[rgb(var(--bg-panel-soft))]">
          Cancel
        </button>
        <button onClick={save} disabled={!dirty} className="rounded-xl bg-[rgb(var(--accent))] px-5 py-2.5 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:opacity-90 disabled:opacity-50">
          Save
        </button>
      </div>
    </div>
  )
}
