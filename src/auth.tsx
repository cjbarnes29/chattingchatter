import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, appRedirectUrl } from './supabase'

export type User = {
  id: string
  email: string
  name: string
  avatar: string
  about: string
  nickname: string
  age: number | null
  status: string
  /** how contacts see you: automatic, always online, or always offline */
  presence: 'auto' | 'online' | 'offline'
  /** who can open your profile details: everyone, or only you */
  profileVisibility: 'public' | 'private'
  /** permanent shareable ID#, e.g. K7QM4XZ2 (empty until the database has it) */
  publicId: string
}

type ProfileRow = { name: string; avatar: string | null; about: string; nickname: string | null; age: number | null; status: string | null; presence_mode: string | null }

type Result = { ok: true; needsConfirm?: boolean; existing?: boolean; resendError?: string } | { ok: false; error: string; unconfirmed?: boolean }

type AuthState = {
  user: User | null
  signIn: (email: string, password: string) => Promise<Result>
  signUp: (email: string, password: string, name: string) => Promise<Result>
  /** confirms a new account with the 6-digit code from the sign-up email; signs the user in on success */
  verifySignupCode: (email: string, code: string) => Promise<Result>
  resendSignupCode: (email: string) => Promise<Result>
  logout: () => void
  recovering: boolean
  requestReset: (email: string) => Promise<Result>
  verifyResetCode: (email: string, code: string) => Promise<Result>
  setNewPassword: (password: string) => Promise<Result>
  changeEmail: (email: string) => Promise<Result>
  updateProfile: (patch: Partial<Pick<User, 'name' | 'avatar' | 'about' | 'nickname' | 'age' | 'status' | 'presence'>>) => void
  /** emails a one-time code to the signed-in user, used to confirm a password change */
  sendPasswordCode: () => Promise<Result>
  changePasswordWithCode: (code: string, password: string) => Promise<Result>
  uploadAvatar: (file: File) => Promise<Result>
  /** true when `password` is the signed-in account's password (used to confirm a log out from the decoy side) */
  verifyPassword: (password: string) => Promise<boolean>
  setProfileVisibility: (v: 'public' | 'private') => void
}

export const AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
]

export function avatarFor(id: string, avatar?: string | null) {
  if (avatar) return avatar
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATARS[h % AVATARS.length]
}

const AuthContext = createContext<AuthState | null>(null)

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)

// Supabase's built-in email sender allows only a few emails per hour per project.
// Turn that technical error into a clear, friendly message.
const friendlyError = (message: string) => {
  // Supabase allows one email per address every ~60 seconds: "you can only request this after 42 seconds"
  const wait = message.match(/after (\d+) seconds?/i)
  if (wait) return `Please wait ${wait[1]} seconds before asking for another code.`
  if (/rate limit|too many|over_email_send_rate_limit|email rate/i.test(message))
    return 'Too many emails were sent recently. Please wait about an hour and try again, or use the email you already received.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [ready, setReady] = useState(false)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  // while a password-change code is being verified, ignore Supabase's "recovery" event so the normal app stays open
  const quiet = useRef(false)
  // A reset link carries "type=recovery" in the URL. Read it up front so the
  // "choose a new password" screen appears even if Supabase has already processed
  // the token before our listener is attached.
  const [recovering, setRecovering] = useState(() =>
    typeof window !== 'undefined' && /type=recovery/.test(window.location.hash),
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY' && !quiet.current) setRecovering(true)
      setSession(s)
      if (!s) {
        setProfile(null)
        setReady(true)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    supabase
      .rpc('get_profiles', { p_ids: [uid] })
      .then(({ data }) => {
        if (cancelled) return
        setProfile(((data as ProfileRow[] | null)?.[0]) ?? { name: session?.user.email?.split('@')[0] ?? 'Me', avatar: null, about: 'Hey there! I am using Chatter.', nickname: '', age: null, status: '', presence_mode: 'auto' })
        setReady(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // The shareable ID# is read on its own so an older database without the column still signs in
  const [publicId, setPublicId] = useState('')
  useEffect(() => {
    if (!uid) { setPublicId(''); return }
    let cancelled = false
    supabase.from('profiles').select('public_id').eq('id', uid).maybeSingle().then(({ data, error }) => {
      if (!cancelled && !error && data?.public_id) setPublicId(data.public_id as string)
    })
    return () => { cancelled = true }
  }, [uid])

  // Profile privacy lives in its own column; if the database doesn't have it yet, the device remembers the choice
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    let local: 'public' | 'private' | null = null
    try { local = localStorage.getItem(`chatter.profile.visibility.${uid}`) as 'public' | 'private' | null } catch { /* ignore */ }
    if (local === 'public' || local === 'private') setVisibility(local)
    supabase.from('profiles').select('profile_visibility').eq('id', uid).maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setVisibility(data.profile_visibility === 'private' ? 'private' : 'public')
    })
    return () => { cancelled = true }
  }, [uid])

  // "Last active" heartbeat so contacts can see when you are online (while the app is open)
  useEffect(() => {
    if (!uid) return
    const beat = () => {
      if (document.visibilityState === 'visible') supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid).then(() => {})
    }
    beat()
    const t = window.setInterval(beat, 45000)
    document.addEventListener('visibilitychange', beat)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [uid])

  const sendPasswordCode: AuthState['sendPasswordCode'] = useCallback(async () => {
    const email = session?.user.email
    if (!email) return { ok: false, error: 'Please sign in first.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appRedirectUrl() })
    return error ? { ok: false, error: friendlyError(error.message) } : { ok: true }
  }, [session])

  const changePasswordWithCode: AuthState['changePasswordWithCode'] = useCallback(
    async (code, password) => {
      const email = session?.user.email
      if (!email) return { ok: false, error: 'Please sign in first.' }
      if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
      quiet.current = true
      try {
        const v = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' })
        if (v.error) return { ok: false, error: 'That code is wrong or expired. Check it, or tap Resend code.' }
        const { error } = await supabase.auth.updateUser({ password })
        return error ? { ok: false, error: error.message } : { ok: true }
      } finally {
        window.setTimeout(() => { quiet.current = false }, 2500)
      }
    },
    [session],
  )

  const signIn: AuthState['signIn'] = useCallback(async (rawEmail, password) => {
    const email = rawEmail.trim().toLowerCase()
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (/confirm/i.test(error.message)) return { ok: false, error: 'Please confirm your email first. Enter the code we emailed you.', unconfirmed: true }
      return { ok: false, error: error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message }
    }
    return { ok: true }
  }, [])

  const signUp: AuthState['signUp'] = useCallback(async (rawEmail, password, name) => {
    const email = rawEmail.trim().toLowerCase()
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' }
    if (!name.trim()) return { ok: false, error: 'Please enter your display name.' }
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: appRedirectUrl() },
    })
    if (error) return { ok: false, error: friendlyError(error.message) }
    // An existing account comes back with no identities. It may simply never have been confirmed,
    // so send a fresh code and let the person confirm it instead of dead-ending them.
    // Supabase sends nothing for an account that is already confirmed (so nobody can probe which emails exist),
    // and reports an error if a code was requested less than a minute ago. Pass that error on instead of hiding it.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
      return { ok: true, needsConfirm: true, existing: true, resendError: resendError ? friendlyError(resendError.message) : undefined }
    }
    return { ok: true, needsConfirm: !data.session }
  }, [])

  const verifySignupCode: AuthState['verifySignupCode'] = useCallback(async (rawEmail, code) => {
    const email = rawEmail.trim().toLowerCase()
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' })
    if (error) {
      // Supabase uses one message ("Token has expired or is invalid") for both a wrong and an expired code,
      // so check for rate limiting first and word the rest to cover both cases.
      if (/rate limit|too many|attempt/i.test(error.message)) return { ok: false, error: 'Too many tries. Please wait a few minutes and try again.' }
      return { ok: false, error: 'That code is wrong or has expired. Check it, or tap “Resend code” for a new one.' }
    }
    return { ok: true }
  }, [])

  const resendSignupCode: AuthState['resendSignupCode'] = useCallback(async (rawEmail) => {
    const email = rawEmail.trim().toLowerCase()
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return error ? { ok: false, error: friendlyError(error.message) } : { ok: true }
  }, [])

  const verifyPassword: AuthState['verifyPassword'] = useCallback(async (password) => {
    const email = session?.user.email
    if (!email || !password) return false
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return !error
  }, [session])

  const setProfileVisibility: AuthState['setProfileVisibility'] = useCallback(
    (v) => {
      setVisibility(v)
      if (!uid) return
      try { localStorage.setItem(`chatter.profile.visibility.${uid}`, v) } catch { /* ignore */ }
      supabase.from('profiles').update({ profile_visibility: v }).eq('id', uid).then(() => {})
    },
    [uid],
  )

  const logout = useCallback(() => {
    supabase.auth.signOut()
  }, [])

  const requestReset: AuthState['requestReset'] = useCallback(async (rawEmail) => {
    const email = rawEmail.trim().toLowerCase()
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appRedirectUrl() })
    return error ? { ok: false, error: friendlyError(error.message) } : { ok: true }
  }, [])

  // Step 2 of the code-based reset: check the 6-digit code. Supabase signs the user in on success.
  const verifyResetCode: AuthState['verifyResetCode'] = useCallback(async (rawEmail, code) => {
    const email = rawEmail.trim().toLowerCase()
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' })
    if (error) {
      if (/expired/i.test(error.message)) return { ok: false, error: 'This code has expired. Tap “Resend code” for a new one.' }
      if (/rate|too many|attempt/i.test(error.message)) return { ok: false, error: 'Too many tries. Please wait a few minutes and try again.' }
      return { ok: false, error: 'That code is wrong or expired. Please check it and try again.' }
    }
    setRecovering(true)
    return { ok: true }
  }, [])

  // Step 3: set the new password (the user is already signed in from the verified code).
  const setNewPassword: AuthState['setNewPassword'] = useCallback(async (password) => {
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { ok: false, error: error.message }
    setRecovering(false)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + '#app')
    return { ok: true }
  }, [])

  const changeEmail: AuthState['changeEmail'] = useCallback(async (rawEmail) => {
    const email = rawEmail.trim().toLowerCase()
    if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' }
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: appRedirectUrl() })
    return error ? { ok: false, error: friendlyError(error.message) } : { ok: true, needsConfirm: true }
  }, [])

  const updateProfile: AuthState['updateProfile'] = useCallback(
    (patch) => {
      const { presence, ...rest } = patch
      const db: Record<string, unknown> = { ...rest }
      if (presence !== undefined) db.presence_mode = presence
      setProfile((prev) => (prev ? { ...prev, ...rest, ...(presence !== undefined ? { presence_mode: presence } : {}) } : prev))
      if (uid) supabase.from('profiles').update(db).eq('id', uid).then(() => {})
    },
    [uid],
  )

  const uploadAvatar: AuthState['uploadAvatar'] = useCallback(
    async (file) => {
      if (!uid) return { ok: false, error: 'Please sign in first.' }
      if (!file.type.startsWith('image/')) return { ok: false, error: 'Please choose an image file.' }
      if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'Please choose an image under 5 MB.' }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${uid}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) return { ok: false, error: `Could not upload photo: ${upErr.message}` }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl
      const { error: dbErr } = await supabase.from('profiles').update({ avatar: url }).eq('id', uid)
      if (dbErr) return { ok: false, error: `Photo uploaded but not saved: ${dbErr.message}` }
      setProfile((prev) => (prev ? { ...prev, avatar: url } : prev))
      return { ok: true }
    },
    [uid],
  )

  const user: User | null = useMemo(() => {
    if (!session || !profile) return null
    return {
      id: session.user.id,
      email: session.user.email ?? '',
      name: profile.name,
      avatar: avatarFor(session.user.id, profile.avatar),
      about: profile.about,
      nickname: profile.nickname ?? '',
      age: profile.age ?? null,
      status: profile.status ?? '',
      presence: profile.presence_mode === 'online' || profile.presence_mode === 'offline' ? profile.presence_mode : 'auto',
      profileVisibility: visibility,
      publicId,
    }
  }, [session, profile, visibility, publicId])

  const value = useMemo(
    () => ({ user, signIn, signUp, verifySignupCode, resendSignupCode, logout, recovering, requestReset, verifyResetCode, setNewPassword, changeEmail, updateProfile, uploadAvatar, sendPasswordCode, changePasswordWithCode, verifyPassword, setProfileVisibility }),
    [user, signIn, signUp, verifySignupCode, resendSignupCode, logout, recovering, requestReset, verifyResetCode, setNewPassword, changeEmail, updateProfile, uploadAvatar, sendPasswordCode, changePasswordWithCode, verifyPassword, setProfileVisibility],
  )

  if (!ready) return null
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
