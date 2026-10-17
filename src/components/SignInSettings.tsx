import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { passwordManagerSupported, readSignin, setSignin } from '../signinPrefs'

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${on ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--border))]'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/** Settings → Privacy & security → Sign-in: staying signed in, saving the password to Google, auto sign-in. */
export default function SignInSettings() {
  const [p, setP] = useState(readSignin)
  const supported = passwordManagerSupported()
  const row = 'flex items-center gap-3 px-4 py-3'
  return (
    <div className="divide-y divide-[rgb(var(--border))]">
      <p className="flex items-start gap-2 px-4 py-3 text-xs text-[rgb(var(--text-secondary))]">
        <KeyRound size={14} className="mt-0.5 shrink-0 text-[rgb(var(--accent))]" />
        You stay signed in when you close Chatter, so you don’t need your password again unless you log out. Your PIN still protects the app.
      </p>
      <div className={row}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Save password to Google</p>
          <p className="text-xs text-[rgb(var(--text-secondary))]">
            {supported ? 'Next time you sign in, Chrome offers to keep your password in Google Password Manager. Chatter never stores it.' : 'On this device, Android’s Autofill (Google) offers to save the password when you sign in, if Autofill is turned on in phone settings.'}
          </p>
        </div>
        <Switch on={p.save} onChange={(v) => setP(setSignin({ save: v }))} label="Save password to Google" />
      </div>
      <div className={row}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Sign in automatically</p>
          <p className="text-xs text-[rgb(var(--text-secondary))]">
            {!supported ? 'Not available in this app: the web view has no password manager access. Android Autofill can still fill it in for you.' : p.save ? 'If you’re signed out (for example after reinstalling), Chatter signs in with your saved password. After you log out yourself, Chrome asks before signing in again.' : 'Turn on “Save password to Google” first.'}
          </p>
        </div>
        <Switch on={p.auto && supported} disabled={!supported || !p.save} onChange={(v) => setP(setSignin({ auto: v }))} label="Sign in automatically" />
      </div>
    </div>
  )
}
