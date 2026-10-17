/** PIN hashing and wrong-guess limits for the on-device app lock. Pure functions, no React or storage.
 *
 *  What this protects against: someone picking up an unlocked-then-locked phone and guessing the PIN.
 *  What it does not: the PIN lock lives on this device. Someone with full access to the device's
 *  storage can still attempt an offline guess, which the slow hash below makes expensive but, for a
 *  4–6 digit PIN, not impossible. Your real messages are protected by your account sign-in on the server. */

const ITERATIONS = 210_000
const enc = new TextEncoder()

export const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  // build the string in chunks so large inputs don't overflow the call stack
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

async function sha256Legacy(text: string) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, 256))
}

/** Hash a PIN for storage: `pbkdf2$<iterations>$<salt>$<hash>` with a fresh random salt. */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${await pbkdf2(pin, salt, ITERATIONS)}`
}

/** Constant-time string compare so timing doesn't reveal how much of a hash matched. */
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** Check a PIN against a stored hash. `role` is only used for the older unsalted format
 *  ("real:" / "decoy:" prefix); `legacy: true` means the caller should re-save with hashPin(). */
export async function checkPin(pin: string, stored: string | null, role: 'real' | 'decoy'): Promise<{ ok: boolean; legacy: boolean }> {
  if (!stored) return { ok: false, legacy: false }
  if (stored.startsWith('pbkdf2$')) {
    const [, it, salt, h] = stored.split('$')
    const iterations = Number(it)
    if (!Number.isInteger(iterations) || iterations < 1 || !salt || !h) return { ok: false, legacy: false }
    return { ok: same(await pbkdf2(pin, fromB64(salt), iterations), h), legacy: false }
  }
  const ok = same(await sha256Legacy(`${role}:${pin}`), stored)
  return { ok, legacy: ok }
}

export const validPin = (pin: string) => /^\d{4,6}$/.test(pin)

// ---------- wrong-guess limits ----------
export const FREE_TRIES = 5
const BASE_WAIT = 30_000
const MAX_WAIT = 15 * 60_000

/** How long to wait after `failures` wrong PINs in a row: none for the first 5, then 30s doubling up to 15 min. */
export function lockoutMs(failures: number) {
  if (failures < FREE_TRIES) return 0
  return Math.min(MAX_WAIT, BASE_WAIT * 2 ** (failures - FREE_TRIES))
}

export const fmtWait = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s}s`
}
