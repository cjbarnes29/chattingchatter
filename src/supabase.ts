import { createClient } from '@supabase/supabase-js'

// Public values — safe to ship in the app. Your data is protected by
// Row Level Security rules in the database, not by hiding these.
// Hard-coded so the live site (Netlify or anywhere) works without extra settings.
const SUPABASE_URL = 'https://jirquumzasixrqwxulmg.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcnF1dW16YXNpeHJxd3h1bG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NjE5MTEsImV4cCI6MjEwNzUzNzkxMX0.fSXmF-w6Eni73n3YV4mCsD8pMdlgC_H89SkM4CgtEEo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Public website address used in sign-up, reset-password and email-change links.
// Links must point at a real web page: never localhost, file:// or the Android
// app shell (capacitor://), which a phone browser cannot open ("refused to connect").
export const PUBLIC_APP_URL = 'https://chattingchatter.netlify.app'

export function appRedirectUrl(): string {
  if (typeof window === 'undefined') return PUBLIC_APP_URL
  const { protocol, hostname, origin } = window.location
  const isWeb = protocol === 'http:' || protocol === 'https:'
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  if (!isWeb || isLocal) return PUBLIC_APP_URL
  return origin
}
