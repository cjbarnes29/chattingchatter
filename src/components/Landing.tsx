import { useEffect, useState } from 'react'
import {
  Download, Smartphone, Globe, Lock, Brush, ShieldCheck, Mic, Crown, Check, ArrowRight, WifiOff, RefreshCw,
  Users, Phone, CalendarDays, Palette, UserRound, Fingerprint, MessageCircle, X, Sparkles, KeyRound,
} from 'lucide-react'
import { DOWNLOADS } from '../downloads'

type BIPEvent = Event & { prompt: () => Promise<void> }

const INK = '#14121C'
const BONE = '#F4EEE3'
const EMBER = '#E8472B'
const APP_VERSION = '1.3'

function useInstall() {
  const [evt, setEvt] = useState<BIPEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  useEffect(() => {
    const p = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent) }
    const i = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', p)
    window.addEventListener('appinstalled', i)
    return () => {
      window.removeEventListener('beforeinstallprompt', p)
      window.removeEventListener('appinstalled', i)
    }
  }, [])
  return { canInstall: !!evt, installed, install: async () => { if (evt) { await evt.prompt(); setEvt(null) } } }
}

type Feature = { i: typeof Lock; t: string; d: string }

const groups: { title: string; blurb: string; items: Feature[] }[] = [
  {
    title: 'Private by design',
    blurb: 'Controls that decide who sees what on your phone.',
    items: [
      { i: Lock, t: 'PIN lock and decoy PIN', d: 'Chatter asks for your PIN on opening and when you log out. A second, decoy PIN opens a different set of chats. Free accounts get 1 decoy chat.' },
      { i: KeyRound, t: 'Locked messages', d: 'Lock individual messages behind your fingerprint, face or phone passcode, on phones that support it.' },
      { i: ShieldCheck, t: 'Protected account changes', d: 'Changing your password needs a code sent to your email. Changing your email needs the answer to your security question.' },
      { i: UserRound, t: 'Online status you control', d: 'Show as online, offline or automatic. Turn read receipts off if you prefer.' },
    ],
  },
  {
    title: 'Talk your way',
    blurb: 'The everyday messenger parts.',
    items: [
      { i: MessageCircle, t: 'Chats that feel alive', d: 'Delivery and read ticks, live typing, swipe to reply, reactions, message tags and Timeline Jump.' },
      { i: Users, t: 'Groups, stories and contacts', d: 'Group chats, stories that expire, and contacts you can favourite, archive or block.' },
      { i: Phone, t: 'Voice and video calls', d: 'Call a friend or start a call in a group chat. Calls need microphone and camera permission and are still in beta.' },
      { i: CalendarDays, t: 'Shared events', d: 'Add an event with an alarm in a one-to-one chat. It is posted into the conversation.' },
      { i: Mic, t: 'Quick replies and dictation', d: 'Suggested replies, plus voice typing where your phone or browser supports speech recognition.' },
    ],
  },
  {
    title: 'Make it yours',
    blurb: 'Under Settings → Appearance and Profile.',
    items: [
      { i: Palette, t: 'Appearance', d: 'Text size, font style, tab and navigation colours, bubble colours and shape, wallpapers and animations.' },
      { i: UserRound, t: 'Profiles', d: 'Nickname, age and status. Tap a photo to zoom it, tap a name to open the full profile.' },
      { i: Brush, t: 'Ghost Canvas', d: 'Tap the ghost button in a one-to-one chat to draw, drop notes, make emoji collages and play tic-tac-toe together. Ink fades away on its own.' },
    ],
  },
]

const pro = [
  'More than one decoy chat (free shows one)',
  'Fingerprint or face unlock on the lock screen, off until you switch it on',
  'Ghost Canvas pan and zoom, plus neon, metallic and watercolour brushes',
  'Connect Four on the canvas',
  'Password-protected canvas keepsakes saved on your device',
  'Focus scheduling that bundles notifications during hours you set',
]

const notYet = [
  'An iPhone app or a Windows, Mac or Linux installer',
  'End-to-end encryption of messages',
  'Taking payment for Pro: billing is not connected yet',
  'Voice-note translation, screenshot blocking and stealth file sharing',
]

const faqs: [string, string][] = [
  ['Is Chatter free?', 'Yes. Chatter Pro is optional. You can start the 7-day trial from inside the app. Payments are not connected yet, so nothing is charged. Planned prices are $2.99 a month or $24.99 a year.'],
  ['Are my messages end-to-end encrypted?', 'No. Messages are stored on Chatter’s servers and protected by account rules, so only you and the person you message can read them. Only Pro canvas keepsakes are encrypted, on your device, with your own password.'],
  ['How does fingerprint unlock work?', 'It is a Pro setting under Privacy & security and is off by default. Set a real PIN and a decoy PIN first. Then swipe up on the lock screen. A fingerprint or face your phone accepts opens your real chats. One it rejects opens your decoy chats. Android reports a cancelled prompt the same way as a wrong fingerprint, so cancelling also opens the decoy chats.'],
  ['Does it work offline?', 'The app opens offline, but sending and receiving messages needs an internet connection.'],
  ['How do I update?', 'The web version shows an Update button when a new version is ready. On Android, download the newest APK from this page and install it over the old one.'],
  ['Which devices are supported?', 'Android through the APK download, and any modern browser. On a computer you can install the web version from Chrome or Edge.'],
]

export default function Landing() {
  const { canInstall, installed, install } = useInstall()
  const apk = DOWNLOADS.androidApk
  const openApp = () => { window.location.hash = '#app'; window.location.reload() }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isAndroid = /android/i.test(ua)
  const isIos = /iphone|ipad|ipod/i.test(ua)
  const platformName = isAndroid ? 'Android' : isIos ? 'iPhone' : 'your computer'
  const platformHint = isAndroid
    ? 'Download the Android app (APK) and install it in a few taps.'
    : isIos
      ? 'There is no iPhone app yet. In Safari tap Share, then Add to Home Screen to use the web version.'
      : 'Open the web version and install it from Chrome or Edge using the install icon in the address bar.'

  const pill = { background: EMBER, color: '#fff' }

  return (
    <div style={{ background: INK, color: BONE, fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }} className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <a href="#top" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-xl" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
          Chatter
        </a>
        <nav className="hidden items-center gap-7 text-sm sm:flex" style={{ opacity: 0.8 }}>
          <a href="#features">Features</a>
          <a href="#pro">Pro</a>
          <a href="#install">Download</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button onClick={openApp} className="rounded-full px-4 py-2 text-sm font-semibold" style={pill}>Open web app</button>
      </header>

      <section id="top" className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.1fr_.9fr] md:pt-20">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full blur-3xl" style={{ background: 'rgba(232,71,43,.22)' }} />
        <div className="relative">
          <p className="mb-5 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest" style={{ borderColor: 'rgba(244,238,227,.25)', color: '#FF9A7A' }}>
            Version {APP_VERSION} · Android and web
          </p>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            Talk freely.<br /><span style={{ color: EMBER }}>Keep it yours.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg" style={{ opacity: 0.75 }}>
            Chatter is a messenger with a PIN lock, decoy chats, groups, calls and Ghost Canvas, a shared drawing space where ink fades away.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#install" className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold" style={pill}>
              <Download size={18} /> Get Chatter
            </a>
            <button onClick={openApp} className="inline-flex items-center gap-2 rounded-full border px-6 py-3 font-semibold" style={{ borderColor: 'rgba(244,238,227,.3)' }}>
              Try it in your browser <ArrowRight size={18} />
            </button>
          </div>
          <p className="mt-4 text-sm" style={{ opacity: 0.55 }}>Free to use. Chatter Pro is optional.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[300px]">
          <div className="rounded-[2.5rem] border-[6px] p-3" style={{ borderColor: '#2A2638', background: '#0F0E16', boxShadow: '0 30px 80px rgba(232,71,43,.25)' }}>
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: '#2D293C' }}>
              <div className="h-9 w-9 rounded-full" style={{ background: 'linear-gradient(135deg,#FF754E,#7A2C1C)' }} />
              <div>
                <div className="text-sm font-bold">Maya</div>
                <div className="text-[11px]" style={{ color: '#FF9A7A' }}>typing…</div>
              </div>
              <Brush size={14} className="ml-auto" style={{ color: '#FF9A7A' }} />
              <Lock size={14} style={{ opacity: 0.6 }} />
            </div>
            <div className="space-y-2 py-4 text-[13px]">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2" style={{ background: '#242130' }}>Dinner at 8? I’ll sketch you the route.</div>
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2" style={{ background: '#7A2C1C' }}>Perfect. Opening Ghost Canvas.</div>
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2" style={{ background: '#242130' }}>It fades away on its own, right?</div>
              <div className="flex gap-1.5 pt-1">
                {['Yes!', 'Draw more', 'Open canvas'].map((s) => (
                  <span key={s} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: '#3A3550', color: '#FF9A7A' }}>{s}</span>
                ))}
              </div>
            </div>
            <div className="rounded-full px-4 py-2 text-xs" style={{ background: '#1F1C2A', opacity: 0.8 }}>Message</div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">What Chatter does today</h2>
        <p className="mt-3 max-w-xl" style={{ opacity: 0.7 }}>Everything listed here is in the app you can download now.</p>
        <div className="mt-12 space-y-14">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h3 className="text-2xl font-extrabold tracking-tight" style={{ color: EMBER }}>{g.title}</h3>
                <p className="text-sm" style={{ opacity: 0.6 }}>{g.blurb}</p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-3xl sm:grid-cols-2 lg:grid-cols-3" style={{ background: 'rgba(244,238,227,.12)' }}>
                {g.items.map(({ i: Icon, t, d }) => (
                  <div key={t} className="p-7" style={{ background: INK }}>
                    <Icon size={24} style={{ color: EMBER }} />
                    <h4 className="mt-4 text-lg font-bold">{t}</h4>
                    <p className="mt-2 text-sm leading-relaxed" style={{ opacity: 0.7 }}>{d}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="install" className="px-5 py-20" style={{ background: BONE, color: INK }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Get Chatter</h2>
          <p className="mt-3 max-w-xl" style={{ opacity: 0.7 }}>Download the Android app, or open the web version on any device and install it from your browser.</p>

          <div className="mt-8 flex flex-col gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center" style={{ borderColor: 'rgba(232,71,43,.5)', background: 'rgba(232,71,43,.07)' }}>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: EMBER }}>Recommended for you</p>
              <h3 className="mt-1 text-2xl font-extrabold">Chatter for {platformName}</h3>
              <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>{platformHint}</p>
            </div>
            {isAndroid ? (
              <a href={apk} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold" style={pill}>
                <Download size={18} /> Download APK
              </a>
            ) : installed ? (
              <span className="flex items-center gap-2 font-semibold"><Check size={18} /> Installed</span>
            ) : (
              <button onClick={canInstall ? install : openApp} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold" style={pill}>
                <Globe size={18} /> {canInstall ? 'Install now' : 'Open web app'}
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border p-6" style={{ borderColor: 'rgba(20,18,28,.15)' }}>
              <Smartphone size={26} style={{ color: EMBER }} />
              <h3 className="mt-3 text-xl font-bold">Android app · v{APP_VERSION}</h3>
              <p className="mb-5 mt-1 text-sm" style={{ opacity: 0.7 }}>A direct download. It is not on Google Play yet.</p>
              <a href={apk} className="flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold" style={{ background: INK, color: BONE }}>
                <Download size={18} /> Download chatter.apk
              </a>
              <div className="mt-5 rounded-2xl p-4 text-xs" style={{ background: 'rgba(20,18,28,.05)' }}>
                <p className="font-semibold">Install in 3 steps</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4" style={{ opacity: 0.8 }}>
                  <li>Open this page on your phone and tap <b>Download chatter.apk</b>.</li>
                  <li>Open the file and allow installs from your browser when asked.</li>
                  <li>Tap <b>Install</b>, then open Chatter.</li>
                </ol>
                <p className="mt-2" style={{ opacity: 0.7 }}>Updating from an older version? Install over it and your account carries on.</p>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <img
                  alt="QR code to download the Chatter APK"
                  className="h-24 w-24 rounded-lg bg-white p-1"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.origin + apk)}`}
                />
                <p className="text-xs" style={{ opacity: 0.7 }}>On a computer? Scan this with your phone camera to download.</p>
              </div>
            </div>

            <div className="rounded-3xl p-6" style={{ background: INK, color: BONE }}>
              <Globe size={26} style={{ color: EMBER }} />
              <h3 className="mt-3 text-xl font-bold">Web version</h3>
              <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>Works in any modern browser and can be installed like an app.</p>
              {installed ? (
                <p className="mt-5 flex items-center gap-2 text-sm font-semibold"><Check size={16} /> Chatter is installed on this device</p>
              ) : canInstall ? (
                <button onClick={install} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold" style={pill}>
                  <Download size={18} /> Install now
                </button>
              ) : (
                <ul className="mt-5 space-y-2 text-sm" style={{ opacity: 0.8 }}>
                  <li><b>Android Chrome:</b> menu ⋮ → Install app</li>
                  <li><b>Windows or Mac:</b> install icon in the address bar of Chrome or Edge</li>
                  <li><b>iPhone Safari:</b> Share → Add to Home Screen</li>
                </ul>
              )}
              <button onClick={openApp} className="mt-5 inline-flex items-center gap-2 text-sm underline underline-offset-4" style={{ opacity: 0.85 }}>
                Open the web app <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="mt-10 grid gap-4 text-sm sm:grid-cols-3">
            {[
              { i: WifiOff, t: 'Needs the internet to chat', d: 'The app opens offline, but sending and receiving messages needs a connection.' },
              { i: RefreshCw, t: 'Updates', d: 'The web version shows an Update button. On Android, install the newest APK over the old one.' },
              { i: ShieldCheck, t: 'PINs stay on your device', d: 'Your PINs are stored on your phone as a one-way hash. Messages are not end-to-end encrypted.' },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <Icon size={20} style={{ color: EMBER }} className="mt-0.5 shrink-0" />
                <div><b>{t}</b><p style={{ opacity: 0.7 }}>{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pro" className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-20 md:grid-cols-2">
        <div>
          <Crown size={28} style={{ color: EMBER }} />
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Chatter Pro</h2>
          <p className="mt-3 max-w-md" style={{ opacity: 0.75 }}>More privacy and canvas tools. Start a 7-day trial inside the app. Billing is not connected yet, so nothing is charged.</p>
          <ul className="mt-6 space-y-3">
            {pro.map((p) => (
              <li key={p} className="flex gap-3 text-sm"><Check size={18} style={{ color: EMBER }} className="shrink-0" /> {p}</li>
            ))}
          </ul>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-3xl border p-6" style={{ borderColor: 'rgba(244,238,227,.2)' }}>
              <div className="text-sm" style={{ opacity: 0.65 }}>Planned monthly</div>
              <div className="mt-2 text-4xl font-extrabold">$2.99</div>
            </div>
            <div className="rounded-3xl p-6" style={pill}>
              <div className="text-sm opacity-80">Planned yearly</div>
              <div className="mt-2 text-4xl font-extrabold">$24.99</div>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border p-7" style={{ borderColor: 'rgba(244,238,227,.2)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#FF9A7A' }}><Sparkles size={16} /> Not available yet</div>
          <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>We would rather tell you than let you find out.</p>
          <ul className="mt-5 space-y-3">
            {notYet.map((n) => (
              <li key={n} className="flex gap-3 text-sm" style={{ opacity: 0.85 }}><X size={18} className="shrink-0" style={{ color: '#FF9A7A' }} /> {n}</li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-2 text-sm" style={{ opacity: 0.7 }}><Fingerprint size={16} /> Fingerprint unlock needs a phone with a fingerprint or face sensor.</div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="text-4xl font-extrabold tracking-tight">Questions</h2>
        <div className="mt-8 divide-y" style={{ borderColor: 'rgba(244,238,227,.15)' }}>
          {faqs.map(([q, a]) => (
            <details key={q} className="py-4">
              <summary className="cursor-pointer list-none text-lg font-semibold">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed" style={{ opacity: 0.7 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t px-5 py-8 text-center text-sm" style={{ borderColor: 'rgba(244,238,227,.12)', opacity: 0.7 }}>
        <p>© {new Date().getFullYear()} Chatter · Talk freely.</p>
        <p className="mt-2"><a href="/terms" className="underline">Terms and Conditions</a></p>
      </footer>
    </div>
  )
}
