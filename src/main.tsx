import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Landing from './components/Landing.tsx'
import UpdatePrompt from './components/UpdatePrompt.tsx'
import PermissionPrompt from './components/PermissionPrompt.tsx'
import './index.css'
import './appearance'

// Installed apps (PWA / Capacitor / desktop) open the messenger directly.
// Everyone else lands on the website; "#app" opens the web messenger.
const isInstalled =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'file:' ||
  (window as unknown as { Capacitor?: unknown }).Capacitor !== undefined
// Supabase email links (password reset, sign-up confirmation, email change) put their
// tokens in the address after "#". Those links must open the messenger, not the landing page.
const hash = window.location.hash
const isAuthLink = /access_token=|refresh_token=|type=(recovery|signup|magiclink|invite|email_change)|error_code=/.test(hash)
const showApp = isInstalled || hash === '#app' || isAuthLink

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showApp ? <App /> : <Landing />}
    <UpdatePrompt />
    <PermissionPrompt />
  </StrictMode>,
)
