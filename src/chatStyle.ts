import { useSyncExternalStore, type CSSProperties } from 'react'

export type Wallpaper = { kind: 'preset' | 'color' | 'image'; value: string }
type State = {
  pins: Record<string, boolean> // locally pinned chats (groups)
  pinColors: Record<string, string>
  favs: Record<string, boolean>
  wallpapers: Record<string, Wallpaper>
  soundOn: boolean
  soundNames: Record<string, string> // 'global' or chat id -> file name
}

export const PIN_COLORS = ['#F5A524', '#E0573B', '#E0457B', '#8A4FB8', '#3A7BD5', '#1FA3A3', '#2F9E6B', '#64748B']
export const DEFAULT_PIN = '#F5A524'
export const WALL_COLORS = ['#F3EDE2', '#E8DCC8', '#D9E6DC', '#D6E2F0', '#EBD7E3', '#1C1926', '#13242B', '#2A1F1A']
export const WALL_PRESETS: { id: string; label: string; css: CSSProperties }[] = [
  { id: 'dusk', label: 'Dusk', css: { backgroundImage: 'linear-gradient(160deg,#3b2a4d,#c2563a)' } },
  { id: 'forest', label: 'Forest', css: { backgroundImage: 'linear-gradient(160deg,#10302b,#4b8f6a)' } },
  { id: 'ocean', label: 'Ocean', css: { backgroundImage: 'linear-gradient(160deg,#10294d,#3aa0c9)' } },
  { id: 'sand', label: 'Sand', css: { backgroundImage: 'linear-gradient(160deg,#f6e7cf,#e0b88a)' } },
  { id: 'blush', label: 'Blush', css: { backgroundImage: 'linear-gradient(160deg,#fbe3e8,#e9a9c0)' } },
  { id: 'dots', label: 'Dots', css: { backgroundColor: '#efe8dc', backgroundImage: 'radial-gradient(#c9bda9 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' } },
]

const KEY = 'chatter.style'
const blank: State = { pins: {}, pinColors: {}, favs: {}, wallpapers: {}, soundOn: true, soundNames: {} }
let state: State = (() => {
  try {
    return { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return blank
  }
})()
const subs = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full */ }
  subs.forEach((f) => f())
}
export function useChatStyle() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)
}

export const setPinColor = (id: string, c: string) => set({ pinColors: { ...state.pinColors, [id]: c } })
export const setLocalPin = (id: string, v: boolean) => set({ pins: { ...state.pins, [id]: v } })
export const setFav = (id: string, v: boolean) => set({ favs: { ...state.favs, [id]: v } })
export const setSoundOn = (v: boolean) => set({ soundOn: v })
export function setWallpaper(id: string, w: Wallpaper | null) {
  const next = { ...state.wallpapers }
  if (w) next[id] = w
  else delete next[id]
  set({ wallpapers: next })
}
export function wallpaperStyle(w?: Wallpaper): CSSProperties | undefined {
  if (!w) return undefined
  if (w.kind === 'color') return { backgroundColor: w.value, backgroundImage: 'none' }
  if (w.kind === 'image') return { backgroundImage: `url(${w.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return WALL_PRESETS.find((p) => p.id === w.value)?.css
}

export function fileToWallpaper(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const s = Math.min(1, 1200 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => reject(new Error('bad image'))
    img.src = url
  })
}

// ---- sounds: files live in IndexedDB so they survive restarts
const db = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open('chatter-sounds', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('s')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((res, rej) => {
    const rq = fn(d.transaction('s', mode).objectStore('s'))
    rq.onsuccess = () => res(rq.result)
    rq.onerror = () => rej(rq.error)
  })
}
export async function saveSound(key: string, file: File) {
  await idb('readwrite', (s) => s.put(file, key))
  set({ soundNames: { ...state.soundNames, [key]: file.name } })
}
export async function clearSound(key: string) {
  await idb('readwrite', (s) => s.delete(key))
  const n = { ...state.soundNames }
  delete n[key]
  set({ soundNames: n })
}

let ctx: AudioContext | null = null
function beep() {
  try {
    ctx = ctx ?? new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.12, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.36)
  } catch { /* no audio */ }
}
// Plays the chat's own sound, else the global one, else a soft default chime
export async function playSound(chatId?: string, force = false) {
  if (!state.soundOn && !force) return
  const keys = [chatId, 'global'].filter((k): k is string => !!k && !!state.soundNames[k])
  for (const k of keys) {
    try {
      const blob = await idb<Blob | undefined>('readonly', (s) => s.get(k))
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = new Audio(url)
        a.onended = () => URL.revokeObjectURL(url)
        await a.play()
        return
      }
    } catch { /* fall through */ }
  }
  beep()
}
