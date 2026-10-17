/** Face ID / Touch ID / fingerprint check using the device's built-in authenticator (WebAuthn).
 *  The phone does the check; Chatter never sees or stores fingerprint or face data. The result is used
 *  on this device only (it unlocks the app lock), so it is as strong as the device's own screen lock. */
import { Device, isNative } from './native'

const CRED = 'chatter.bio.cred'
/** On Android the app uses the phone's BiometricPrompt (strong fingerprint/face only); there is no
 *  WebAuthn credential to store, so this marker stands in for one. */
const NATIVE_CRED = 'android-biometric-prompt'
const ON = 'chatter.bio.on'

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const rand = () => crypto.getRandomValues(new Uint8Array(32))

export const biometricEnabled = () => localStorage.getItem(ON) !== '0'
export const setBiometricEnabled = (v: boolean) => localStorage.setItem(ON, v ? '1' : '0')
export const biometricEnrolled = () => !!localStorage.getItem(CRED)

/** Pro: unlock the lock screen with a fingerprint or face. Off by default. A failed check never opens anything. */
const UNLOCK = 'chatter.bio.unlock'
export const bioUnlockEnabled = () => localStorage.getItem(UNLOCK) === '1'
export const setBioUnlockEnabled = (v: boolean) => localStorage.setItem(UNLOCK, v ? '1' : '0')

export async function biometricSupported(): Promise<boolean> {
  if (isNative()) return Device.getStatus().then((s) => s.biometric === 'available').catch(() => false)
  try {
    if (!window.PublicKeyCredential || !window.isSecureContext) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function explain(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError') return 'Verification was cancelled or not recognised. Try again.'
  if (name === 'SecurityError') return 'Biometrics need a secure (https) connection.'
  if (name === 'NotSupportedError' || name === 'InvalidStateError') return 'This device could not set up biometrics. Make sure a fingerprint or face is enrolled in phone settings.'
  return 'Biometric check failed. Use your PIN instead.'
}

async function nativeVerify(title: string): Promise<{ ok: boolean; error?: string; denied?: boolean }> {
  try {
    const r = await Device.verifyBiometric({ title, subtitle: 'Use your fingerprint or face' })
    if (r.ok) return { ok: true }
    if (r.code === 'not-enrolled') return { ok: false, error: 'No fingerprint or face is set up. Add one in phone settings → Security.' }
    if (r.code === 'unavailable') return { ok: false, error: 'This phone has no strong fingerprint or face unlock.' }
    if (r.code === 'lockout') return { ok: false, error: 'Too many tries. Use your PIN, or unlock your phone first and try again.', denied: true }
    if (r.code === 'cancelled') return { ok: false, error: 'Cancelled. Use your PIN instead.', denied: true }
    return { ok: false, error: r.message || 'Biometric check failed. Use your PIN instead.', denied: true }
  } catch {
    return { ok: false, error: 'Biometric check failed. Use your PIN instead.' }
  }
}

export async function enrollBiometric(userId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (isNative()) {
    const r = await nativeVerify('Turn on fingerprint unlock')
    if (r.ok) localStorage.setItem(CRED, NATIVE_CRED)
    return r
  }
  if (!(await biometricSupported())) return { ok: false, error: 'No Face ID, Touch ID or fingerprint sensor is available here.' }
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: rand(),
        rp: { name: 'Chatter' },
        user: { id: new TextEncoder().encode(userId), name: name || 'chatter', displayName: name || 'Chatter' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
    if (!cred) return { ok: false, error: 'Setup was cancelled.' }
    localStorage.setItem(CRED, b64(cred.rawId))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: explain(e) }
  }
}

export async function verifyBiometric(): Promise<{ ok: boolean; error?: string; denied?: boolean }> {
  const id = localStorage.getItem(CRED)
  if (!id) return { ok: false, error: 'not-enrolled' }
  if (isNative()) return nativeVerify('Unlock Chatter')
  if (id === NATIVE_CRED) return { ok: false, error: 'not-enrolled' }
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: rand(),
        allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    if (!r) return { ok: false, error: 'Verification failed.', denied: true }
    // The authenticator sets the "user verified" flag (bit 2 of the flags byte) only after a real
    // fingerprint, face or device-passcode check. Anything else is treated as a failure.
    const data = new Uint8Array((r as PublicKeyCredential & { response: AuthenticatorAssertionResponse }).response.authenticatorData)
    if (data.length < 33 || !(data[32] & 0x04)) return { ok: false, error: 'This device didn’t confirm it was you. Use your PIN instead.', denied: true }
    return { ok: true }
  } catch (e) {
    // "NotAllowedError" = the phone did not accept this fingerprint / face (or it was cancelled)
    return { ok: false, error: explain(e), denied: (e as { name?: string })?.name === 'NotAllowedError' }
  }
}

export const forgetBiometric = () => localStorage.removeItem(CRED)
