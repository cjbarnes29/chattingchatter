import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { checkPin, fromB64, hashPin, lockoutMs, toB64 } from './pinLock'

export type Plan = 'free' | 'pro'
export type Billing = 'monthly' | 'yearly'

export type Masterpiece = { id: string; name: string; createdAt: number; cipher: string; iv: string; salt: string }

export type FocusSchedule = {
  enabled: boolean
  days: boolean[] // Mon..Sun
  startHour: number
  endHour: number
  meetingMode: boolean
  /** messages from favourite chats still pop up during focus */
  allowFavorites: boolean
}

/** Seconds the app may sit in the background before it locks again. */
export type AutoLock = 0 | 60 | 300

type ProData = {
  plan: Plan
  billing: Billing
  renewsAt: number | null
  trialEndsAt: number | null
  /** the free trial can be used once per account on this device */
  trialUsed: boolean
  decoyPinHash: string | null
  realPinHash: string | null
  decoyChatIds: string[]
  focus: FocusSchedule
  masterpieces: Masterpiece[]
  /** wrong PINs in a row, and when the next try is allowed */
  failedAttempts: number
  lockedUntil: number
  /** times of wrong PINs since the owner last unlocked with the real PIN */
  intrusions: number[]
  /** chats that need the PIN or fingerprint to open */
  lockedChatIds: string[]
  autoLock: AutoLock
}

export type PinResult = 'real' | 'decoy' | 'none' | 'locked'

type ProState = ProData & {
  isPro: boolean
  trialActive: boolean
  startTrial: (billing: Billing) => boolean
  cancelPlan: () => void
  setBilling: (b: Billing) => void
  setRealPin: (pin: string) => Promise<void>
  setDecoyPin: (pin: string) => Promise<void>
  clearDecoy: () => void
  /** turns the PIN lock off; needs the current real PIN */
  removePins: (currentPin: string) => Promise<boolean>
  setDecoyChatIds: (ids: string[]) => void
  /** Unlock check for lock screens: counts wrong guesses and enforces waits. */
  verifyPin: (pin: string) => Promise<PinResult>
  /** Compare without counting as a guess (used when choosing new PINs in settings). */
  matchPin: (pin: string) => Promise<'real' | 'decoy' | 'none'>
  hasPins: boolean
  /** intrusions seen at the last real unlock, for the "wrong PINs were tried" notice */
  takeIntrusions: () => number[]
  updateFocus: (patch: Partial<FocusSchedule>) => void
  setChatLocked: (chatId: string, locked: boolean) => void
  setAutoLock: (v: AutoLock) => void
  saveMasterpiece: (name: string, payload: string, password: string) => Promise<Masterpiece>
  openMasterpiece: (id: string, password: string) => Promise<string>
  deleteMasterpiece: (id: string) => void
  /** encrypted file contents for download; still needs the password to open */
  exportMasterpiece: (id: string) => string | null
  importMasterpiece: (fileText: string) => Masterpiece | null
}

const DEFAULT_FOCUS: FocusSchedule = { enabled: false, days: [true, true, true, true, true, false, false], startHour: 9, endHour: 17, meetingMode: false, allowFavorites: true }
const DEFAULT: ProData = {
  plan: 'free', billing: 'yearly', renewsAt: null, trialEndsAt: null, trialUsed: false,
  decoyPinHash: null, realPinHash: null, decoyChatIds: [], focus: DEFAULT_FOCUS, masterpieces: [],
  failedAttempts: 0, lockedUntil: 0, intrusions: [], lockedChatIds: [], autoLock: 0,
}

const ProContext = createContext<ProState | null>(null)
const key = (email: string) => `chatter.pro.${email}`
const DAY = 24 * 60 * 60 * 1000

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

function load(email: string): ProData {
  try {
    const raw = localStorage.getItem(key(email))
    if (!raw) return DEFAULT
    const d = { ...DEFAULT, ...JSON.parse(raw) } as ProData
    // older saves: a past trial counts as used; focus gains new fields
    return { ...d, trialUsed: d.trialUsed || !!d.trialEndsAt, focus: { ...DEFAULT_FOCUS, ...d.focus } }
  } catch {
    return DEFAULT
  }
}

export function ProProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const [data, setData] = useState<ProData>(DEFAULT)

  useEffect(() => {
    if (email) setData(load(email))
  }, [email])

  // Every update starts from the newest copy, so quick changes in a row never undo each other.
  const latest = useRef(data)
  latest.current = data
  const update = useCallback(
    (fn: (d: ProData) => ProData) => {
      const next = fn(latest.current)
      latest.current = next
      setData(next)
      if (email) {
        try {
          localStorage.setItem(key(email), JSON.stringify(next))
        } catch {
          /* storage full: change still applies for this session */
        }
      }
    },
    [email],
  )

  // plan expiry
  useEffect(() => {
    if (data.plan === 'pro' && data.renewsAt && Date.now() > data.renewsAt) update((d) => ({ ...d, plan: 'free', renewsAt: null }))
  }, [data.plan, data.renewsAt, update])

  const isPro = data.plan === 'pro'
  const trialActive = isPro && !!data.trialEndsAt && Date.now() < data.trialEndsAt

  const startTrial = useCallback<ProState['startTrial']>(
    (billing) => {
      if (latest.current.trialUsed) return false
      const now = Date.now()
      update((d) => ({ ...d, plan: 'pro', billing, trialUsed: true, trialEndsAt: now + 7 * DAY, renewsAt: now + 7 * DAY }))
      return true
    },
    [update],
  )
  const cancelPlan = useCallback(() => update((d) => ({ ...d, plan: 'free', renewsAt: null, trialEndsAt: null })), [update])
  const setBilling = useCallback((b: Billing) => update((d) => ({ ...d, billing: b })), [update])

  const setRealPin = useCallback(async (pin: string) => {
    const h = await hashPin(pin)
    update((d) => ({ ...d, realPinHash: h, failedAttempts: 0, lockedUntil: 0 }))
  }, [update])
  const setDecoyPin = useCallback(async (pin: string) => {
    const h = await hashPin(pin)
    update((d) => ({ ...d, decoyPinHash: h }))
  }, [update])
  const clearDecoy = useCallback(() => update((d) => ({ ...d, decoyPinHash: null, decoyChatIds: [] })), [update])
  const setDecoyChatIds = useCallback((ids: string[]) => update((d) => ({ ...d, decoyChatIds: ids })), [update])

  const matchPin = useCallback<ProState['matchPin']>(async (pin) => {
    const d = latest.current
    const real = await checkPin(pin, d.realPinHash, 'real')
    if (real.ok) return 'real'
    const decoy = await checkPin(pin, d.decoyPinHash, 'decoy')
    return decoy.ok ? 'decoy' : 'none'
  }, [])

  const verifyPin = useCallback<ProState['verifyPin']>(async (pin) => {
    const d = latest.current
    if (Date.now() < d.lockedUntil) return 'locked'
    // check both every time so the time taken doesn't hint which PIN exists
    const [real, decoy] = await Promise.all([checkPin(pin, d.realPinHash, 'real'), checkPin(pin, d.decoyPinHash, 'decoy')])
    if (real.ok) {
      const upgraded = real.legacy ? await hashPin(pin) : null
      update((x) => ({ ...x, failedAttempts: 0, lockedUntil: 0, realPinHash: upgraded ?? x.realPinHash }))
      return 'real'
    }
    if (decoy.ok) {
      // the decoy PIN doesn't reset the guess counter, or it could be used to get unlimited guesses
      if (decoy.legacy) {
        const h = await hashPin(pin)
        update((x) => ({ ...x, decoyPinHash: h }))
      }
      return 'decoy'
    }
    update((x) => {
      const failedAttempts = x.failedAttempts + 1
      const wait = lockoutMs(failedAttempts)
      return { ...x, failedAttempts, lockedUntil: wait ? Date.now() + wait : 0, intrusions: [...x.intrusions, Date.now()].slice(-50) }
    })
    return 'none'
  }, [update])

  const removePins = useCallback<ProState['removePins']>(async (currentPin) => {
    if ((await verifyPin(currentPin)) !== 'real') return false
    // confidential chats are opened with the PIN, so their locks go with it
    update((d) => ({ ...d, realPinHash: null, decoyPinHash: null, decoyChatIds: [], lockedChatIds: [], failedAttempts: 0, lockedUntil: 0, intrusions: [] }))
    return true
  }, [update, verifyPin])

  const takeIntrusions = useCallback(() => {
    const list = latest.current.intrusions
    if (list.length) update((d) => ({ ...d, intrusions: [] }))
    return list
  }, [update])

  const updateFocus = useCallback((patch: Partial<FocusSchedule>) => update((d) => ({ ...d, focus: { ...d.focus, ...patch } })), [update])
  const setChatLocked = useCallback(
    (chatId: string, locked: boolean) => update((d) => ({ ...d, lockedChatIds: locked ? [...new Set([...d.lockedChatIds, chatId])] : d.lockedChatIds.filter((c) => c !== chatId) })),
    [update],
  )
  const setAutoLock = useCallback((v: AutoLock) => update((d) => ({ ...d, autoLock: v })), [update])

  const saveMasterpiece = useCallback<ProState['saveMasterpiece']>(async (name, payload, password) => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const k = await deriveKey(password, salt)
    const encd = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(payload))
    const m: Masterpiece = { id: `mp${Date.now()}`, name, createdAt: Date.now(), cipher: toB64(encd), iv: toB64(iv), salt: toB64(salt) }
    update((d) => ({ ...d, masterpieces: [m, ...d.masterpieces] }))
    return m
  }, [update])

  const openMasterpiece = useCallback<ProState['openMasterpiece']>(async (id, password) => {
    const m = latest.current.masterpieces.find((x) => x.id === id)
    if (!m) throw new Error('Not found')
    const k = await deriveKey(password, fromB64(m.salt))
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(m.iv) }, k, fromB64(m.cipher))
    return new TextDecoder().decode(dec)
  }, [])

  const deleteMasterpiece = useCallback((id: string) => update((d) => ({ ...d, masterpieces: d.masterpieces.filter((m) => m.id !== id) })), [update])

  const exportMasterpiece = useCallback((id: string) => {
    const m = latest.current.masterpieces.find((x) => x.id === id)
    return m ? JSON.stringify({ format: 'chatter-masterpiece', version: 1, ...m }) : null
  }, [])

  const importMasterpiece = useCallback((fileText: string) => {
    try {
      const o = JSON.parse(fileText)
      const str = (v: unknown) => typeof v === 'string' && v.length > 0
      if (o?.format !== 'chatter-masterpiece' || ![o.cipher, o.iv, o.salt].every(str)) return null
      const m: Masterpiece = { id: `mp${Date.now()}`, name: str(o.name) ? String(o.name).slice(0, 60) : 'Imported canvas', createdAt: Number(o.createdAt) || Date.now(), cipher: o.cipher, iv: o.iv, salt: o.salt }
      update((d) => ({ ...d, masterpieces: [m, ...d.masterpieces] }))
      return m
    } catch {
      return null
    }
  }, [update])

  const value = useMemo<ProState>(
    () => ({
      ...data, isPro, trialActive, hasPins: !!data.realPinHash,
      startTrial, cancelPlan, setBilling, setRealPin, setDecoyPin, clearDecoy, removePins, setDecoyChatIds,
      verifyPin, matchPin, takeIntrusions, updateFocus, setChatLocked, setAutoLock,
      saveMasterpiece, openMasterpiece, deleteMasterpiece, exportMasterpiece, importMasterpiece,
    }),
    [data, isPro, trialActive, startTrial, cancelPlan, setBilling, setRealPin, setDecoyPin, clearDecoy, removePins, setDecoyChatIds, verifyPin, matchPin, takeIntrusions, updateFocus, setChatLocked, setAutoLock, saveMasterpiece, openMasterpiece, deleteMasterpiece, exportMasterpiece, importMasterpiece],
  )

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>
}

export function usePro() {
  const ctx = useContext(ProContext)
  if (!ctx) throw new Error('usePro must be used inside ProProvider')
  return ctx
}
