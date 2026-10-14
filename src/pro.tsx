import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './auth'

export type Plan = 'free' | 'pro'
export type Billing = 'monthly' | 'yearly'

export type Masterpiece = { id: string; name: string; createdAt: number; cipher: string; iv: string; salt: string }

export type FocusSchedule = {
  enabled: boolean
  days: boolean[] // Mon..Sun
  startHour: number
  endHour: number
  meetingMode: boolean
}

type ProData = {
  plan: Plan
  billing: Billing
  renewsAt: number | null
  trialEndsAt: number | null
  decoyPinHash: string | null
  realPinHash: string | null
  decoyChatIds: string[]
  focus: FocusSchedule
  masterpieces: Masterpiece[]
}

type ProState = ProData & {
  isPro: boolean
  startTrial: (billing: Billing) => void
  cancelPlan: () => void
  setBilling: (b: Billing) => void
  setRealPin: (pin: string) => Promise<void>
  setDecoyPin: (pin: string) => Promise<void>
  clearDecoy: () => void
  setDecoyChatIds: (ids: string[]) => void
  verifyPin: (pin: string) => Promise<'real' | 'decoy' | 'none'>
  hasPins: boolean
  updateFocus: (patch: Partial<FocusSchedule>) => void
  saveMasterpiece: (name: string, payload: string, password: string) => Promise<Masterpiece>
  openMasterpiece: (id: string, password: string) => Promise<string>
  deleteMasterpiece: (id: string) => void
}

const DEFAULT_FOCUS: FocusSchedule = { enabled: false, days: [true, true, true, true, true, false, false], startHour: 9, endHour: 17, meetingMode: false }
const DEFAULT: ProData = { plan: 'free', billing: 'yearly', renewsAt: null, trialEndsAt: null, decoyPinHash: null, realPinHash: null, decoyChatIds: [], focus: DEFAULT_FOCUS, masterpieces: [] }

const ProContext = createContext<ProState | null>(null)
const key = (email: string) => `chatter.pro.${email}`
const DAY = 24 * 60 * 60 * 1000

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer as ArrayBuffer)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export function ProProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const [data, setData] = useState<ProData>(DEFAULT)

  useEffect(() => {
    if (!email) return
    try {
      const raw = localStorage.getItem(key(email))
      setData(raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT)
    } catch {
      setData(DEFAULT)
    }
  }, [email])

  const latest = useRef(data)
  latest.current = data
  const persist = useCallback(
    (next: ProData) => {
      latest.current = next
      setData(next)
      if (email) localStorage.setItem(key(email), JSON.stringify(next))
    },
    [email],
  )

  // Trial expiry check
  useEffect(() => {
    if (data.plan === 'pro' && data.renewsAt && Date.now() > data.renewsAt) persist({ ...data, plan: 'free', renewsAt: null })
  }, [data, persist])

  const isPro = data.plan === 'pro'

  const startTrial = useCallback<ProState['startTrial']>(
    (billing) => {
      const now = Date.now()
      persist({ ...data, plan: 'pro', billing, trialEndsAt: now + 7 * DAY, renewsAt: now + (billing === 'yearly' ? 365 : 30) * DAY })
    },
    [data, persist],
  )

  const cancelPlan = useCallback(() => persist({ ...data, plan: 'free', renewsAt: null, trialEndsAt: null }), [data, persist])
  const setBilling = useCallback((b: Billing) => persist({ ...data, billing: b }), [data, persist])

  const setRealPin = useCallback(
    async (pin: string) => { const h = await sha256('real:' + pin); persist({ ...latest.current, realPinHash: h }) },
    [persist],
  )
  const setDecoyPin = useCallback(
    async (pin: string) => { const h = await sha256('decoy:' + pin); persist({ ...latest.current, decoyPinHash: h }) },
    [persist],
  )
  const clearDecoy = useCallback(() => persist({ ...data, decoyPinHash: null, decoyChatIds: [] }), [data, persist])
  const setDecoyChatIds = useCallback((ids: string[]) => persist({ ...latest.current, decoyChatIds: ids }), [persist])

  const verifyPin = useCallback<ProState['verifyPin']>(
    async (pin) => {
      if (data.realPinHash && data.realPinHash === (await sha256('real:' + pin))) return 'real'
      if (data.decoyPinHash && data.decoyPinHash === (await sha256('decoy:' + pin))) return 'decoy'
      return 'none'
    },
    [data],
  )

  const updateFocus = useCallback((patch: Partial<FocusSchedule>) => persist({ ...data, focus: { ...data.focus, ...patch } }), [data, persist])

  const saveMasterpiece = useCallback<ProState['saveMasterpiece']>(
    async (name, payload, password) => {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const k = await deriveKey(password, salt)
      const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(payload))
      const m: Masterpiece = { id: `mp${Date.now()}`, name, createdAt: Date.now(), cipher: toB64(enc), iv: toB64(iv), salt: toB64(salt) }
      persist({ ...data, masterpieces: [m, ...data.masterpieces] })
      return m
    },
    [data, persist],
  )

  const openMasterpiece = useCallback<ProState['openMasterpiece']>(
    async (id, password) => {
      const m = data.masterpieces.find((x) => x.id === id)
      if (!m) throw new Error('Not found')
      const k = await deriveKey(password, fromB64(m.salt))
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(m.iv) }, k, fromB64(m.cipher))
      return new TextDecoder().decode(dec)
    },
    [data],
  )

  const deleteMasterpiece = useCallback((id: string) => persist({ ...data, masterpieces: data.masterpieces.filter((m) => m.id !== id) }), [data, persist])

  const value = useMemo<ProState>(
    () => ({
      ...data,
      isPro,
      hasPins: !!data.realPinHash,
      startTrial,
      cancelPlan,
      setBilling,
      setRealPin,
      setDecoyPin,
      clearDecoy,
      setDecoyChatIds,
      verifyPin,
      updateFocus,
      saveMasterpiece,
      openMasterpiece,
      deleteMasterpiece,
    }),
    [data, isPro, startTrial, cancelPlan, setBilling, setRealPin, setDecoyPin, clearDecoy, setDecoyChatIds, verifyPin, updateFocus, saveMasterpiece, openMasterpiece, deleteMasterpiece],
  )

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>
}

export function usePro() {
  const ctx = useContext(ProContext)
  if (!ctx) throw new Error('usePro must be used inside ProProvider')
  return ctx
}

