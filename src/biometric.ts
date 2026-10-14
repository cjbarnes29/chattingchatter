/** Real Face ID / Touch ID / fingerprint check using the device's built-in authenticator (WebAuthn). */
const CRED = 'chatter.bio.cred'
const ON = 'chatter.bio.on'

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const rand = () => crypto.getRandomValues(new Uint8Array(32))

export const biometricEnabled = () => localStorage.getItem(ON) !== '0'
export const setBiometricEnabled = (v: boolean) => localStorage.setItem(ON, v ? '1' : '0')
export const biometricEnrolled = () => !!localStorage.getItem(CRED)

export async function biometricSupported(): Promise<boolean> {
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

export async function enrollBiometric(userId: string, name: string): Promise<{ ok: boolean; error?: string }> {
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

export async function verifyBiometric(): Promise<{ ok: boolean; error?: string }> {
  const id = localStorage.getItem(CRED)
  if (!id) return { ok: false, error: 'not-enrolled' }
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: rand(),
        allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return r ? { ok: true } : { ok: false, error: 'Verification failed.' }
  } catch (e) {
    return { ok: false, error: explain(e) }
  }
}

export const forgetBiometric = () => localStorage.removeItem(CRED)
