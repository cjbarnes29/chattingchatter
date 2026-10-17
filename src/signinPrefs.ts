/** Saving the Chatter password to the browser's password manager (Google Password Manager in Chrome)
 *  and signing in with it automatically. Both are off until the user turns them on.
 *
 *  - Uses the browser's Credential Management API, so the password is kept by Google/Chrome, never by Chatter.
 *  - Auto sign-in only fills in the account; the app's PIN lock still applies after that.
 *  - After you log out, Chrome won't sign you back in silently; it asks you to pick the account first.
 *  - The Android app's web view doesn't have this API. There, Android's own Autofill (Google) can offer to
 *    save and fill the password from the sign-in form if Autofill is turned on in phone settings. */

const KEY = 'chatter.signin.v1'
export type SigninPrefs = { save: boolean; auto: boolean }

export function readSignin(): SigninPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { save: v.save === true, auto: v.auto === true && v.save === true }
  } catch {
    return { save: false, auto: false }
  }
}
export function setSignin(patch: Partial<SigninPrefs>) {
  const next = { ...readSignin(), ...patch }
  if (!next.save) next.auto = false // auto sign-in needs a saved password
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

type PwCredCtor = new (o: { id: string; password: string; name?: string }) => Credential
const PwCred = () => (globalThis as unknown as { PasswordCredential?: PwCredCtor }).PasswordCredential

export const passwordManagerSupported = () => typeof PwCred() === 'function' && !!navigator.credentials?.store

/** Offer the password to the browser's password manager (the browser asks the user to confirm). */
export async function storePassword(email: string, password: string, name?: string): Promise<boolean> {
  const C = PwCred()
  if (!C || !readSignin().save) return false
  try {
    await navigator.credentials.store(new C({ id: email, password, name: name || email }))
    return true
  } catch {
    return false
  }
}

/** A saved Chatter password, if auto sign-in is on and the browser has one. */
export async function savedPassword(): Promise<{ email: string; password: string } | null> {
  if (!passwordManagerSupported() || !readSignin().auto) return null
  try {
    const c = (await navigator.credentials.get({ password: true, mediation: 'optional' } as CredentialRequestOptions)) as (Credential & { id: string; password?: string }) | null
    return c && c.type === 'password' && c.password ? { email: c.id, password: c.password } : null
  } catch {
    return null
  }
}

/** Call on log out, so the browser doesn't sign straight back in without asking. */
export function stopSilentSignIn() {
  try { void navigator.credentials?.preventSilentAccess?.() } catch { /* ignore */ }
}
