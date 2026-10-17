import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { ACCENTS, DEFAULT_PREFS, accentForeground, hexToRgb, mix, validatePrefs, type InterfacePrefs } from './interfacePrefs'

/** Interface preferences store. Saved on this device straight away and, when signed in, copied to the
 *  user's own row in `ui_prefs` so they follow the account to other devices. Applied as classes and CSS
 *  variables on <html>, so the real app and the decoy profile look the same. */

const KEY = 'chatter.interface'
const LEGACY_DARK_KEY = 'chatter.dark'

function load(): InterfacePrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return validatePrefs(JSON.parse(raw))
    // first run after this update: keep the old dark-mode switch
    return validatePrefs({ ...DEFAULT_PREFS, theme: localStorage.getItem(LEGACY_DARK_KEY) === '1' ? 'dark' : 'light' })
  } catch {
    return DEFAULT_PREFS
  }
}

let state: InterfacePrefs = load()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
export const resolveDark = (p: Pick<InterfacePrefs, 'theme'>) => (p.theme === 'system' ? systemDark() : p.theme === 'dark')

// panel colours from index.css, used to tint the accent for soft backgrounds
const PANEL_LIGHT: [number, number, number] = [250, 247, 241]
const PANEL_DARK: [number, number, number] = [22, 20, 31]

/** Paint a set of prefs onto the page. Used for the saved prefs and for live previews. */
export function applyInterface(p: InterfacePrefs) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const dark = resolveDark(p)
  root.classList.toggle('dark', dark)
  root.classList.toggle('hc', p.highContrast)
  root.classList.toggle('relaxed', p.relaxedText)
  root.dataset.density = p.density
  root.style.colorScheme = dark ? 'dark' : 'light'
  const accent = ACCENTS.find((a) => a.id === p.accent)
  const rgb = accent && accent.id ? hexToRgb(dark ? accent.dark : accent.light) : null
  if (rgb) {
    root.style.setProperty('--accent', rgb.join(' '))
    root.style.setProperty('--accent-foreground', accentForeground(rgb).join(' '))
    root.style.setProperty('--accent-soft', mix(rgb, dark ? PANEL_DARK : PANEL_LIGHT, dark ? 0.24 : 0.16).join(' '))
  } else {
    ;['--accent', '--accent-foreground', '--accent-soft'].forEach((v) => root.style.removeProperty(v))
  }
}
applyInterface(state)

// follow the phone/computer setting while "System" is chosen
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (state.theme === 'system') {
      applyInterface(state)
      emit()
    }
  })
}

function persistLocal(p: InterfacePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
    localStorage.setItem(LEGACY_DARK_KEY, resolveDark(p) ? '1' : '0')
  } catch {
    /* storage full or blocked: prefs still apply for this session */
  }
}

// ---------- account sync ----------
let syncUser: string | null = null
let syncAvailable = true

async function pushRemote(p: InterfacePrefs) {
  if (!syncUser || !syncAvailable) return
  const { error } = await supabase.from('ui_prefs').upsert({ user_id: syncUser, prefs: p, updated_at: new Date(p.updatedAt).toISOString() })
  // table not created yet: keep working locally and stop trying this session
  if (error && /ui_prefs|relation|schema cache|PGRST205|42P01/i.test(`${error.code} ${error.message}`)) syncAvailable = false
}

/** Called once the user is known. Pulls their saved prefs and keeps whichever copy is newer. */
export async function startInterfaceSync(userId: string | null) {
  syncUser = userId
  if (!userId || !syncAvailable) return
  const { data, error } = await supabase.from('ui_prefs').select('prefs').eq('user_id', userId).maybeSingle()
  if (error) {
    if (/ui_prefs|relation|schema cache|PGRST205|42P01/i.test(`${error.code} ${error.message}`)) syncAvailable = false
    return
  }
  if (syncUser !== userId) return
  const remote = data ? validatePrefs(data.prefs) : null
  if (remote && remote.updatedAt > state.updatedAt) {
    state = remote
    persistLocal(state)
    applyInterface(state)
    emit()
  } else if (state.updatedAt > (remote?.updatedAt ?? -1)) {
    void pushRemote(state)
  }
}

// ---------- public API ----------
/** Save new prefs: validates, stamps the time, applies, stores locally and syncs. */
export function saveInterface(next: InterfacePrefs) {
  state = validatePrefs({ ...next, updatedAt: Date.now() })
  persistLocal(state)
  applyInterface(state)
  emit()
  void pushRemote(state)
}
export const updateInterface = (patch: Partial<InterfacePrefs>) => saveInterface({ ...state, ...patch })
export const resetInterface = () => saveInterface({ ...DEFAULT_PREFS, preset: 'default' })
/** Show unsaved prefs on the page; call cancelPreview() to go back to the saved look. */
export const previewInterface = (draft: InterfacePrefs) => applyInterface(validatePrefs(draft))
export const cancelPreview = () => applyInterface(state)
export const getInterface = () => state
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const useInterface = () => useSyncExternalStore(subscribe, () => state)
/** True when the dark palette is showing (resolves "System", and updates when the device setting changes). */
export const useIsDark = () => useSyncExternalStore(subscribe, () => resolveDark(state))
/** The quick light/dark switch: leaves "System" for an explicit choice. */
export const toggleDark = () => updateInterface({ theme: resolveDark(state) ? 'light' : 'dark' })
