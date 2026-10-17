/** Interface preferences: theme mode, accent, density, inbox layout, navigation and dashboard.
 *  Pure data and validation only (no DOM, no network) so it can be checked in isolation.
 *  Presentation only: nothing here touches permissions, security or who can see what. */

export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type InboxLayout = 'list' | 'grid'
export type PreviewLines = 0 | 1 | 2
export type SortOrder = 'recent' | 'unread' | 'name'
export type TabId = 'all' | 'fav' | 'groups' | 'unread'
export type ShortcutId = 'theme' | 'contacts' | 'newChat' | 'newGroup' | 'archived'
export type SectionId = 'search' | 'stories' | 'pinned' | 'proBanner' | 'archived'
export type WidgetId = 'recent' | 'pinned' | 'groups' | 'reminders' | 'stories' | 'activity'
export type PresetId = 'default' | 'minimal' | 'social' | 'messaging' | 'productivity' | 'compact'

export type InterfacePrefs = {
  version: 1
  /** ms timestamp of the last save, used to pick the newest copy when syncing devices */
  updatedAt: number
  preset: PresetId | 'custom'
  theme: ThemeMode
  accent: string // id from ACCENTS; '' = Chatter's ember
  highContrast: boolean
  relaxedText: boolean
  density: Density
  inboxLayout: InboxLayout
  preview: PreviewLines
  sort: SortOrder
  /** visible inbox tabs, in order; 'all' is always kept */
  tabs: TabId[]
  defaultTab: TabId
  /** visible header shortcuts, in order; settings (your photo) is always shown */
  shortcuts: ShortcutId[]
  sections: Record<SectionId, boolean>
  dashboard: { enabled: boolean; widgets: WidgetId[] }
}

export const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fav', label: 'Favorites' },
  { id: 'groups', label: 'Groups' },
  { id: 'unread', label: 'Unread' },
]

export const ALL_SHORTCUTS: { id: ShortcutId; label: string; desc: string }[] = [
  { id: 'theme', label: 'Light / dark switch', desc: 'Flip the theme from the inbox' },
  { id: 'contacts', label: 'People I added', desc: 'Open your contacts' },
  { id: 'newChat', label: 'New chat', desc: 'Start a conversation (always shown)' },
  { id: 'newGroup', label: 'New group', desc: 'Create a group chat' },
  { id: 'archived', label: 'Archived chats', desc: 'Jump to archived conversations' },
]

export const ALL_SECTIONS: { id: SectionId; label: string; desc: string }[] = [
  { id: 'search', label: 'Search bar', desc: 'Search your chats from the top of the inbox' },
  { id: 'stories', label: 'Stories', desc: 'The row of stories above your chats' },
  { id: 'pinned', label: 'Pinned shortcuts', desc: 'Quick-tap row of your pinned chats' },
  { id: 'proBanner', label: 'Chatter Pro banner', desc: 'The upgrade card (free accounts)' },
  { id: 'archived', label: 'Archived link', desc: 'The “Archived (n)” row above your chats' },
]

export const ALL_WIDGETS: { id: WidgetId; label: string; desc: string }[] = [
  { id: 'recent', label: 'Recent conversations', desc: 'Your latest chats (names only, no message text)' },
  { id: 'pinned', label: 'Pinned chats', desc: 'Chats you pinned' },
  { id: 'groups', label: 'Groups', desc: 'Your group chats and member counts' },
  { id: 'reminders', label: 'Reminders', desc: 'Upcoming events you set in chats' },
  { id: 'stories', label: 'Stories', desc: 'Who has posted a story' },
  { id: 'activity', label: 'Recent activity', desc: 'Unread chats and new messages at a glance' },
]

/** Accent colours with a light-mode and dark-mode shade, both chosen to keep text and controls readable. */
export const ACCENTS: { id: string; label: string; light: string; dark: string }[] = [
  { id: '', label: 'Ember', light: '#E04E2A', dark: '#FF754E' },
  { id: 'teal', label: 'Teal', light: '#1F7A63', dark: '#4FC7A4' },
  { id: 'blue', label: 'Ocean', light: '#2F5FB8', dark: '#7FA8F0' },
  { id: 'violet', label: 'Violet', light: '#7A3FB0', dark: '#B98BEA' },
  { id: 'rose', label: 'Rose', light: '#C2335F', dark: '#F17CA0' },
  { id: 'amber', label: 'Amber', light: '#9A6200', dark: '#F5B547' },
  { id: 'graphite', label: 'Graphite', light: '#3B3747', dark: '#C9C3D3' },
]

export const DEFAULT_PREFS: InterfacePrefs = {
  version: 1,
  updatedAt: 0,
  preset: 'default',
  theme: 'light',
  accent: '',
  highContrast: false,
  relaxedText: false,
  density: 'comfortable',
  inboxLayout: 'list',
  preview: 1,
  sort: 'recent',
  tabs: ['all', 'fav', 'groups', 'unread'],
  defaultTab: 'all',
  shortcuts: ['theme', 'contacts', 'newChat'],
  sections: { search: true, stories: true, pinned: false, proBanner: true, archived: true },
  dashboard: { enabled: false, widgets: ['recent', 'pinned', 'reminders', 'groups'] },
}

type LayoutPatch = Partial<Omit<InterfacePrefs, 'version' | 'updatedAt' | 'theme' | 'accent' | 'highContrast' | 'relaxedText'>>

/** Presets change presentation only. Theme mode, accent and accessibility choices are left as the user set them. */
export const PRESETS: { id: PresetId; label: string; desc: string; patch: LayoutPatch }[] = [
  { id: 'default', label: 'Default', desc: 'Chatter as it comes', patch: {} },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Fewer distractions: just your chats',
    patch: {
      tabs: ['all'],
      shortcuts: ['newChat'],
      sections: { search: true, stories: false, pinned: false, proBanner: false, archived: false },
      preview: 1,
      dashboard: { enabled: false, widgets: DEFAULT_PREFS.dashboard.widgets },
    },
  },
  {
    id: 'social',
    label: 'Social',
    desc: 'Stories, friends and groups up front',
    patch: {
      tabs: ['all', 'groups', 'fav'],
      shortcuts: ['contacts', 'newGroup', 'newChat'],
      sections: { search: true, stories: true, pinned: true, proBanner: true, archived: true },
      dashboard: { enabled: true, widgets: ['stories', 'groups', 'recent', 'activity'] },
    },
  },
  {
    id: 'messaging',
    label: 'Messaging',
    desc: 'Conversations first, unread on top',
    patch: {
      tabs: ['all', 'unread', 'fav', 'groups'],
      shortcuts: ['newChat', 'contacts'],
      sort: 'unread',
      preview: 2,
      sections: { search: true, stories: false, pinned: true, proBanner: true, archived: true },
      dashboard: { enabled: false, widgets: DEFAULT_PREFS.dashboard.widgets },
    },
  },
  {
    id: 'productivity',
    label: 'Productivity',
    desc: 'Pinned chats and reminders at hand',
    patch: {
      tabs: ['all', 'fav', 'unread'],
      shortcuts: ['newChat', 'archived'],
      sections: { search: true, stories: false, pinned: true, proBanner: false, archived: true },
      dashboard: { enabled: true, widgets: ['reminders', 'pinned', 'activity', 'recent'] },
    },
  },
  {
    id: 'compact',
    label: 'Compact',
    desc: 'More chats on small screens',
    patch: {
      density: 'compact',
      preview: 0,
      shortcuts: ['newChat'],
      sections: { search: true, stories: false, pinned: false, proBanner: false, archived: true },
      dashboard: { enabled: false, widgets: DEFAULT_PREFS.dashboard.widgets },
    },
  },
]

const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
const listOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T[]): T[] => {
  if (!Array.isArray(v)) return fallback
  const seen = new Set<T>()
  for (const x of v) if (allowed.includes(x as T)) seen.add(x as T)
  return [...seen]
}
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** Accepts anything (old versions, hand-edited storage, another device) and returns a complete, valid set of prefs.
 *  Unknown keys are dropped, missing or bad values fall back to defaults. */
export function validatePrefs(raw: unknown): InterfacePrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_PREFS
  const tabs = listOf(r.tabs, ALL_TABS.map((t) => t.id), d.tabs)
  if (!tabs.includes('all')) tabs.unshift('all')
  const sec = (r.sections && typeof r.sections === 'object' ? r.sections : {}) as Record<string, unknown>
  const dash = (r.dashboard && typeof r.dashboard === 'object' ? r.dashboard : {}) as Record<string, unknown>
  const defaultTab = oneOf(r.defaultTab, ALL_TABS.map((t) => t.id), d.defaultTab)
  return {
    version: 1,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
    preset: oneOf(r.preset, [...PRESETS.map((p) => p.id), 'custom'] as const, d.preset),
    theme: oneOf(r.theme, ['light', 'dark', 'system'] as const, d.theme),
    accent: oneOf(r.accent, ACCENTS.map((a) => a.id), d.accent),
    highContrast: bool(r.highContrast, d.highContrast),
    relaxedText: bool(r.relaxedText, d.relaxedText),
    density: oneOf(r.density, ['compact', 'comfortable', 'spacious'] as const, d.density),
    inboxLayout: oneOf(r.inboxLayout, ['list', 'grid'] as const, d.inboxLayout),
    preview: oneOf(r.preview, [0, 1, 2] as const, d.preview),
    sort: oneOf(r.sort, ['recent', 'unread', 'name'] as const, d.sort),
    tabs,
    defaultTab: tabs.includes(defaultTab) ? defaultTab : 'all',
    shortcuts: (() => {
      // "New chat" is essential, so it can be moved but not removed
      const s = listOf(r.shortcuts, ALL_SHORTCUTS.map((x) => x.id), d.shortcuts)
      return s.includes('newChat') ? s : [...s, 'newChat']
    })(),
    sections: Object.fromEntries(ALL_SECTIONS.map((s) => [s.id, bool(sec[s.id], d.sections[s.id])])) as Record<SectionId, boolean>,
    dashboard: { enabled: bool(dash.enabled, d.dashboard.enabled), widgets: listOf(dash.widgets, ALL_WIDGETS.map((w) => w.id), d.dashboard.widgets) },
  }
}

/** Apply a preset on top of the user's current prefs, keeping their theme and accessibility choices. */
export function applyPreset(current: InterfacePrefs, id: PresetId): InterfacePrefs {
  const keep = { theme: current.theme, accent: current.accent, highContrast: current.highContrast, relaxedText: current.relaxedText }
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0]
  return validatePrefs({ ...DEFAULT_PREFS, ...preset.patch, ...keep, preset: preset.id, updatedAt: current.updatedAt })
}

/** Move an item one step within an ordered list (used for reordering tabs, shortcuts and widgets). */
export function move<T>(list: T[], item: T, dir: -1 | 1): T[] {
  const i = list.indexOf(item)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Shortcuts and tabs that are always shown so core actions stay discoverable. */
export const ESSENTIAL_SHORTCUTS: ShortcutId[] = ['newChat']
export const ESSENTIAL_TABS: TabId[] = ['all']

/** Toggle an item in an ordered list, appending it at the end when turned on. */
export function toggleIn<T>(list: T[], item: T, on: boolean): T[] {
  if (on) return list.includes(item) ? list : [...list, item]
  return list.filter((x) => x !== item)
}

// ---------- colour helpers (WCAG contrast) ----------
export const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lin = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
export const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const WHITE: [number, number, number] = [255, 255, 255]
const INK: [number, number, number] = [24, 12, 8]
/** Text colour for a filled accent button: whichever of white or near-black reads better. */
export const accentForeground = (rgb: [number, number, number]) => (contrast(rgb, WHITE) >= contrast(rgb, INK) ? WHITE : INK)
/** A soft tint of the accent over the panel colour, for selected rows and icon chips. */
export const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [0, 1, 2].map((i) => Math.round(a[i] * t + b[i] * (1 - t))) as [number, number, number]
