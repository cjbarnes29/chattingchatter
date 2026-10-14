import { useSyncExternalStore } from 'react'

/** Look & feel the user can customise: text size and style, tab / navigation / bubble colours, bubble shape and motion.
 *  Values are applied as CSS variables on <html>, so the real app and the decoy profile always look the same. */
export type Motion = 'lively' | 'normal' | 'off'
export type BubbleShape = 'pill' | 'round' | 'square'

export type Appearance = {
  fontSize: number // index into SIZES
  font: string
  tabColor: string // '' = theme default
  navColor: string
  bubbleOut: string
  bubbleIn: string
  bubbleShape: BubbleShape
  plainChat: boolean // hide the contour-line pattern behind messages
  motion: Motion
}

export const SIZES = [
  { label: 'Small', scale: 0.88 },
  { label: 'Default', scale: 1 },
  { label: 'Large', scale: 1.12 },
  { label: 'Huge', scale: 1.26 },
]

export const FONTS = [
  { id: 'bricolage', label: 'Bricolage', css: "'Bricolage Grotesque'" },
  { id: 'nunito', label: 'Nunito', css: "'Nunito'" },
  { id: 'lora', label: 'Lora', css: "'Lora'" },
  { id: 'mono', label: 'JetBrains Mono', css: "'JetBrains Mono'" },
  { id: 'atkinson', label: 'Atkinson', css: "'Atkinson Hyperlegible'" },
]

export const TAB_COLORS = ['', '#E04E2A', '#2F9E6B', '#3A7BD5', '#8A4FB8', '#E0457B', '#F5A524', '#1C1926']
export const NAV_COLORS = ['', '#1C1926', '#E04E2A', '#2F6B4F', '#2B4C8C', '#8A4FB8', '#F5C451', '#FFFFFF']
export const BUBBLE_OUT_COLORS = ['', '#FFD6C0', '#CDEBD8', '#CFE0F7', '#E9D5F5', '#FFE7A6', '#E04E2A', '#2F6B4F']
export const BUBBLE_IN_COLORS = ['', '#FFFFFF', '#EDE7DA', '#DDEBFF', '#2A2635', '#1F3B2E']
export const SHAPES: { id: BubbleShape; label: string; r: string }[] = [
  { id: 'pill', label: 'Pill', r: '1.5rem' },
  { id: 'round', label: 'Rounded', r: '1rem' },
  { id: 'square', label: 'Square', r: '0.375rem' },
]

export const APPEARANCE_DEFAULT: Appearance = {
  fontSize: 1,
  font: 'bricolage',
  tabColor: '',
  navColor: '',
  bubbleOut: '',
  bubbleIn: '',
  bubbleShape: 'round',
  plainChat: false,
  motion: 'normal',
}

const KEY = 'chatter.appearance'
let state: Appearance = (() => {
  try {
    return { ...APPEARANCE_DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return APPEARANCE_DEFAULT
  }
})()
const subs = new Set<() => void>()

const triplet = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbVar = (hex: string) => triplet(hex)?.join(' ') ?? null
/** readable text colour (as an "r g b" triplet) for a given background */
const fgFor = (hex: string) => {
  const t = triplet(hex)
  if (!t) return null
  const lum = (0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2]) / 255
  return lum > 0.58 ? '28 25 38' : '255 255 255'
}

function apply(a: Appearance) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const set = (name: string, v: string | null) => (v ? root.style.setProperty(name, v) : root.style.removeProperty(name))
  const scale = SIZES[a.fontSize]?.scale ?? 1
  root.style.fontSize = `${16 * scale}px`
  root.style.setProperty('--font-scale', String(scale))
  set('--font-body', FONTS.find((f) => f.id === a.font)?.css ?? FONTS[0].css)
  set('--tab-active', rgbVar(a.tabColor))
  set('--tab-active-fg', fgFor(a.tabColor))
  set('--nav-bg', rgbVar(a.navColor))
  set('--nav-fg', fgFor(a.navColor))
  set('--bubble-out', rgbVar(a.bubbleOut))
  set('--bubble-out-fg', fgFor(a.bubbleOut))
  set('--bubble-in', rgbVar(a.bubbleIn))
  set('--bubble-in-fg', fgFor(a.bubbleIn))
  set('--bubble-r', SHAPES.find((s) => s.id === a.bubbleShape)?.r ?? '1rem')
  root.classList.toggle('plain-chat', a.plainChat)
  root.classList.toggle('motion-off', a.motion === 'off')
  root.classList.toggle('motion-lively', a.motion === 'lively')
}
apply(state)

export function setAppearance(patch: Partial<Appearance>) {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full */ }
  apply(state)
  subs.forEach((f) => f())
}
export const resetAppearance = () => setAppearance({ ...APPEARANCE_DEFAULT })
export const useAppearance = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)
