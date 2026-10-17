import { useEffect, useState } from 'react'
import { X, MessageCircle, Wand2, UserRound, ShieldCheck, Lock, EyeOff, LifeBuoy, ShieldAlert, ArrowLeft, ArrowRight, Check } from 'lucide-react'

type Step = {
  icon: React.ReactNode
  title: string
  body: string
  points: string[]
  /** only shown in the real app, never in the decoy profile */
  realOnly?: boolean
}

const STEPS: Step[] = [
  {
    icon: <MessageCircle size={28} />,
    title: 'Welcome to Chatter',
    body: 'Chatter is a private messenger. Here is a two-minute tour of the main parts.',
    points: [
      'Your inbox lists every conversation. Tap one to open it.',
      'Use the + button to start a chat with a friend by email, or make a group.',
      'Stories, voice and video calls, a shared calendar and a Ghost Canvas for drawing together are all one tap away.',
    ],
  },
  {
    icon: <Wand2 size={28} />,
    title: 'Messages and chats',
    body: 'Press and hold a message to see what you can do with it.',
    points: [
      'Reply, react with an emoji, tag it (Work, Plans, Ideas, Memories) or copy it.',
      'Edits and “Delete for me” change how a message looks on your device only.',
      'Pin, favourite or archive chats by swiping them in the inbox, and give a chat its own wallpaper and sound.',
    ],
  },
  {
    icon: <UserRound size={28} />,
    title: 'Photos and profiles',
    body: 'Tap anyone’s picture to see it large.',
    points: [
      'In the photo viewer, pinch, scroll or double-tap to zoom, and drag to look around.',
      'Choose “View profile info” to see someone’s nickname, age, status and about.',
      'People can set their profile to Public or Private. A Private profile shows only a name and photo.',
    ],
  },
  {
    icon: <ShieldCheck size={28} />,
    title: 'Privacy settings',
    body: 'Settings → Privacy & security decides what other people can see.',
    points: [
      'Read receipts: turn them off and senders never see a blue tick.',
      'Online status: automatic, always online, or always appear offline.',
      'Profile visibility: Public or Private, as described on the last page.',
    ],
    realOnly: true,
  },
  {
    icon: <Lock size={28} />,
    title: 'PIN lock and security controls',
    body: 'A PIN keeps your chats safe if someone picks up your phone.',
    points: [
      'A PIN is 4 or more characters. You type it twice when you set it, and the eye icon shows or hides what you typed.',
      'Chatter asks for the PIN when it opens, after you leave, and before you log out. Nothing happens until you tap the check key or Unlock.',
      'After 5 wrong PINs there is a wait that gets longer each time, and you are told about wrong tries next time you unlock.',
      'Confidential chats need your PIN or fingerprint every time. Use “Lock now” in the inbox to lock right away.',
    ],
    realOnly: true,
  },
  {
    icon: <EyeOff size={28} />,
    title: 'Decoy Mode',
    body: 'A second, different PIN opens a harmless look-alike Chatter.',
    points: [
      'Set a decoy PIN in Settings → Privacy & security, and edit the pretend chats in Settings → Decoy chats.',
      'In the decoy profile nothing from your real account is loaded. Attachments are switched off and the account, privacy and PIN pages are hidden.',
      'Logging out there just locks Chatter again. Only your real PIN or account password logs you out of the real account.',
    ],
    realOnly: true,
  },
  {
    icon: <LifeBuoy size={28} />,
    title: 'Account recovery',
    body: 'If you forget your password you are never locked out for good.',
    points: [
      'On the sign-in screen, tap “Forgot password?” to get a code by email and choose a new password.',
      'Inside the app, Settings → Account can change your password with an emailed code, and set a security question that guards email changes.',
      'From the decoy profile, swipe up and hold at the bottom of Settings to recover the real account. It needs an emailed code and asks you to confirm before it resets anything.',
    ],
    realOnly: true,
  },
  {
    icon: <ShieldAlert size={28} />,
    title: 'You’re ready',
    body: 'That is the tour. You can open it again any time from Settings → Tutorial.',
    points: [
      'Make the app yours in Settings → Interface and Appearance.',
      'Keep your PIN and password to yourself, and use a PIN that is not easy to guess.',
    ],
  },
]

/** A step-by-step tour of Chatter for first-time users. In the decoy profile it leaves out everything about hidden features. */
export default function Tutorial({ onClose, decoy = false }: { onClose: () => void; decoy?: boolean }) {
  const steps = STEPS.filter((s) => !(decoy && s.realOnly))
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setI((n) => Math.min(steps.length - 1, n + 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, steps.length])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Chatter tutorial" onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-md flex-col rounded-3xl bg-[rgb(var(--bg-panel))] p-6 shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Step {i + 1} of {steps.length}</span>
          <button onClick={onClose} aria-label="Close tutorial" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]">{step.icon}</div>
          <h2 className="text-xl font-extrabold tracking-tight">{step.title}</h2>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">{step.body}</p>
          <ul className="mt-4 space-y-2.5">
            {step.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm leading-relaxed">
                <Check size={16} className="mt-0.5 shrink-0 text-[rgb(var(--accent))]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
          {steps.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-6 bg-[rgb(var(--accent))]' : 'w-1.5 bg-[rgb(var(--border))]'}`} />)}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setI((n) => n - 1)} disabled={i === 0} className="flex items-center justify-center gap-1.5 rounded-xl border border-[rgb(var(--border))] px-4 py-2.5 text-sm font-semibold disabled:opacity-40"><ArrowLeft size={15} /> Back</button>
          <button onClick={() => (last ? onClose() : setI((n) => n + 1))} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[rgb(var(--accent))] py-2.5 text-sm font-semibold text-[rgb(var(--accent-foreground))]">
            {last ? 'Finish' : <>Next <ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
