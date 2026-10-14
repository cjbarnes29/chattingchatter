import { useEffect, useState } from 'react'
import {
  Download, Smartphone, Monitor, Globe, Lock, Sparkles, Brush, Clock, ShieldCheck,
  Mic, Tags, Crown, Check, ArrowRight, WifiOff, RefreshCw, Play,
} from 'lucide-react'
import { DOWNLOADS } from '../downloads'
import { useLatestRelease, findAsset } from '../useLatestRelease'

type BIPEvent = Event & { prompt: () => Promise<void> }

const INK = '#14121C'
const BONE = '#F4EEE3'
const EMBER = '#E8472B'

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

function DlButton({ href, icon, label, sub, loading }: { href: string; icon: React.ReactNode; label: string; sub: string; loading?: boolean }) {
  const ready = !!href
  const cls = 'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition'
  const style = { borderColor: 'rgba(244,238,227,.18)', background: ready ? 'rgba(244,238,227,.06)' : 'transparent', opacity: ready ? 1 : 0.55 }
  const inner = (
    <>
      <span style={{ color: EMBER }}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs" style={{ opacity: 0.65 }}>
          {ready ? sub : loading ? 'Checking latest release…' : 'Not published yet · use browser install'}
        </span>
      </span>
      {ready && <Download size={16} />}
    </>
  )
  return ready ? (
    <a href={href} className={`${cls} hover:bg-white/10`} style={style}>{inner}</a>
  ) : (
    <div className={cls} style={style} aria-disabled>{inner}</div>
  )
}

const features = [
  { i: Lock, t: 'Private-message locks', d: 'Lock sensitive threads behind a PIN or biometric gate. A decoy PIN opens harmless chats and hides the rest.' },
  { i: Sparkles, t: 'On-device smart replies', d: 'Quick reply suggestions and voice-to-text that run on your device, not on someone else’s server.' },
  { i: Clock, t: 'Timeline Jump', d: 'Leap to any moment in a long conversation instead of scrolling for ages.' },
  { i: Tags, t: 'Message tags', d: 'Tag the messages that matter, then find them again in a tap.' },
  { i: Brush, t: 'Ghost Canvas', d: 'A shared space to draw, stick notes, build emoji collages and play tic-tac-toe. Everything fades away on its own.' },
  { i: Mic, t: 'Typing, receipts and reads', d: 'Grouped bubbles, timestamps, delivery and read ticks, plus live typing indicators.' },
]

const pro = [
  'Decoy profiles and extra privacy controls',
  'Canvas pan and zoom, neon, metallic and watercolour brushes',
  'Shared media player and shared calendar',
  'Connect Four on the canvas',
  'Encrypted, password-protected canvas keepsakes',
]

export default function Landing() {
  const { canInstall, installed, install } = useInstall()
  const { release, loading: releaseLoading } = useLatestRelease()
  const apkAsset = findAsset(release, /\.apk$/i)
  const exeAsset = findAsset(release, /\.exe$/i)
  const dmgAsset = findAsset(release, /\.dmg$/i)
  const appImageAsset = findAsset(release, /\.AppImage$/i)
  const releasePage = release?.pageUrl ?? DOWNLOADS.windows
  const androidApkUrl = DOWNLOADS.androidApk // always the site's own /chatter.apk
  void apkAsset
  const winUrl = exeAsset?.url ?? releasePage
  const macUrl = dmgAsset?.url ?? releasePage
  const linuxUrl = appImageAsset?.url ?? releasePage
  const versionLabel = release?.version ? ` · ${release.version}` : ''
  const openApp = () => { window.location.hash = '#app'; window.location.reload() }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const platform = (() => {
    if (/android/i.test(ua)) return { name: 'Android', native: DOWNLOADS.playStore || androidApkUrl, hint: 'Install straight from your browser in one tap. It works offline and updates itself.' }
    if (/iphone|ipad|ipod/i.test(ua)) return { name: 'iPhone', native: '', hint: 'In Safari tap Share, then Add to Home Screen.' }
    if (/windows/i.test(ua)) return { name: 'Windows', native: winUrl, hint: 'Install from Chrome or Edge in one click. It opens in its own window like a normal app.' }
    if (/macintosh|mac os/i.test(ua)) return { name: 'Mac', native: macUrl, hint: 'Install from Chrome or Edge in one click, or use Safari: File, Add to Dock.' }
    if (/linux|cros/i.test(ua)) return { name: 'Linux', native: linuxUrl, hint: 'Install from Chrome or Edge in one click.' }
    return { name: 'your device', native: '', hint: 'Install from your browser in one tap.' }
  })()

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
          <a href="#install">Install</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button onClick={openApp} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: EMBER, color: '#fff' }}>
          Open web app
        </button>
      </header>

      <section id="top" className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.1fr_.9fr] md:pt-20">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full blur-3xl" style={{ background: 'rgba(232,71,43,.22)' }} />
        <div className="relative">
          <p className="mb-5 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest" style={{ borderColor: 'rgba(244,238,227,.25)', color: '#FF9A7A' }}>
            Messaging with a private streak
          </p>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            Talk freely.<br /><span style={{ color: EMBER }}>Leave no trace</span> you don’t want.
          </h1>
          <p className="mt-6 max-w-xl text-lg" style={{ opacity: 0.75 }}>
            Chatter is a fast, friendly messenger with locked chats, on-device smart replies and Ghost Canvas, a shared space that disappears when you’re done.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#install" className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold" style={{ background: EMBER, color: '#fff' }}>
              <Download size={18} /> Install Chatter
            </a>
            <button onClick={openApp} className="inline-flex items-center gap-2 rounded-full border px-6 py-3 font-semibold" style={{ borderColor: 'rgba(244,238,227,.3)' }}>
              Try it in your browser <ArrowRight size={18} />
            </button>
          </div>
          <p className="mt-4 text-sm" style={{ opacity: 0.55 }}>Free to use · Chatter Pro from $2.99/month</p>
        </div>

        {/* Phone mockup */}
        <div className="relative mx-auto w-full max-w-[300px]">
          <div className="rounded-[2.5rem] border-[6px] p-3 shadow-2xl" style={{ borderColor: '#2A2638', background: '#0F0E16', boxShadow: '0 30px 80px rgba(232,71,43,.25)' }}>
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: '#2D293C' }}>
              <div className="h-9 w-9 rounded-full" style={{ background: 'linear-gradient(135deg,#FF754E,#7A2C1C)' }} />
              <div>
                <div className="text-sm font-bold">Maya</div>
                <div className="text-[11px]" style={{ color: '#FF9A7A' }}>typing…</div>
              </div>
              <Lock size={14} className="ml-auto" style={{ opacity: 0.6 }} />
            </div>
            <div className="space-y-2 py-4 text-[13px]">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2" style={{ background: '#242130' }}>Dinner at 8? I’ll draw you the map 🗺️</div>
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2" style={{ background: '#7A2C1C' }}>Perfect. Sending it to Ghost Canvas now</div>
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2" style={{ background: '#242130' }}>It vanishes in 24h, right?</div>
              <div className="flex gap-1.5 pt-1">
                {['Yes, 24h', 'Keep it', 'Lock chat'].map((s) => (
                  <span key={s} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: '#3A3550', color: '#FF9A7A' }}>{s}</span>
                ))}
              </div>
            </div>
            <div className="rounded-full px-4 py-2 text-xs" style={{ background: '#1F1C2A', opacity: 0.8 }}>Message</div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">Everything you expect. A few things you don’t.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl sm:grid-cols-2 lg:grid-cols-3" style={{ background: 'rgba(244,238,227,.12)' }}>
          {features.map(({ i: Icon, t, d }) => (
            <div key={t} className="p-7" style={{ background: INK }}>
              <Icon size={24} style={{ color: EMBER }} />
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ opacity: 0.7 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="install" className="px-5 py-20" style={{ background: BONE, color: INK }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Install Chatter</h2>
          <p className="mt-3 max-w-xl" style={{ opacity: 0.7 }}>Pick your device. The web version installs in one tap and works offline after the first visit.</p>

          <div className="mt-8 flex flex-col gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center" style={{ borderColor: 'rgba(232,71,43,.5)', background: 'rgba(232,71,43,.07)' }}>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: EMBER }}>Recommended for you</p>
              <h3 className="mt-1 text-2xl font-extrabold">Chatter for {platform.name}</h3>
              <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>{platform.hint}</p>
            </div>
            {installed ? (
              <span className="flex items-center gap-2 font-semibold"><Check size={18} /> Installed</span>
            ) : platform.native ? (
              <a href={platform.native} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold" style={{ background: EMBER, color: '#fff' }}>
                <Download size={18} /> Download
              </a>
            ) : (
              <button onClick={canInstall ? install : openApp} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold" style={{ background: EMBER, color: '#fff' }}>
                <Download size={18} /> {canInstall ? 'Install now' : 'Open & install'}
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl p-6" style={{ background: INK, color: BONE }}>
              <Globe size={26} style={{ color: EMBER }} />
              <h3 className="mt-3 text-xl font-bold">Install from your browser</h3>
              <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>Android, Windows, Mac, Linux, ChromeOS.</p>
              {installed ? (
                <p className="mt-5 flex items-center gap-2 text-sm font-semibold"><Check size={16} /> Chatter is installed on this device</p>
              ) : canInstall ? (
                <button onClick={install} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold" style={{ background: EMBER, color: '#fff' }}>
                  <Download size={18} /> Install now
                </button>
              ) : (
                <ul className="mt-5 space-y-2 text-sm" style={{ opacity: 0.8 }}>
                  <li><b>Android Chrome:</b> menu ⋮ → Install app</li>
                  <li><b>Windows / Mac:</b> install icon in the address bar of Chrome or Edge</li>
                  <li><b>iPhone Safari:</b> Share → Add to Home Screen</li>
                </ul>
              )}
              <button onClick={openApp} className="mt-4 text-sm underline underline-offset-4" style={{ opacity: 0.8 }}>Or just open the web app</button>
            </div>

            <div className="rounded-3xl border p-6" style={{ borderColor: 'rgba(20,18,28,.15)' }}>
              <Smartphone size={26} style={{ color: EMBER }} />
              <h3 className="mt-3 text-xl font-bold">Android</h3>
              <p className="mb-5 mt-1 text-sm" style={{ opacity: 0.7 }}>Download the APK and install it in a few taps.</p>
              <div className="space-y-3" style={{ color: BONE }}>
                <div className="rounded-2xl" style={{ background: INK }}>
                  <DlButton href={androidApkUrl} icon={<Smartphone size={22} />} label="Direct APK" sub={`Download .apk${versionLabel}`} loading={releaseLoading} />
                </div>
              </div>
              {!apkAsset && !releaseLoading && (
                <p className="mt-4 text-xs" style={{ opacity: 0.7 }}>
                  The APK isn’t published yet. Please check back shortly, or install from the browser above.
                </p>
              )}
              <div className="mt-5 rounded-2xl p-4 text-xs" style={{ background: 'rgba(20,18,28,.05)' }}>
                <p className="font-semibold">Install the APK in 3 steps</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4" style={{ opacity: 0.8 }}>
                  <li>Tap <b>Direct APK</b> above on your phone.</li>
                  <li>Open the downloaded file and allow installs from your browser when asked.</li>
                  <li>Tap <b>Install</b>, then open Chatter.</li>
                </ol>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <img
                  alt="QR code to download the Chatter APK"
                  className="h-24 w-24 rounded-lg bg-white p-1"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(androidApkUrl)}`}
                />
                <p className="text-xs" style={{ opacity: 0.7 }}>Scan with your phone camera to download the APK directly.</p>
              </div>
            </div>

          </div>

          <div className="mt-10 grid gap-4 text-sm sm:grid-cols-3">
            {[
              { i: WifiOff, t: 'Works offline', d: 'Open Chatter without a connection after your first visit.' },
              { i: RefreshCw, t: 'Stays up to date', d: 'You’ll see an Update prompt whenever a new version is ready.' },
              { i: ShieldCheck, t: 'Private by design', d: 'Locks, decoy PINs and encrypted keepsakes stay on your device.' },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <Icon size={20} style={{ color: EMBER }} className="mt-0.5 shrink-0" />
                <div><b>{t}</b><p style={{ opacity: 0.7 }}>{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pro" className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
        <div>
          <Crown size={28} style={{ color: EMBER }} />
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Chatter Pro</h2>
          <p className="mt-3 max-w-md" style={{ opacity: 0.75 }}>Superpowers, not just fewer ads. Try it free for 7 days.</p>
          <ul className="mt-6 space-y-3">
            {pro.map((p) => (
              <li key={p} className="flex gap-3 text-sm"><Check size={18} style={{ color: EMBER }} className="shrink-0" /> {p}</li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border p-6" style={{ borderColor: 'rgba(244,238,227,.2)' }}>
            <div className="text-sm" style={{ opacity: 0.65 }}>Monthly</div>
            <div className="mt-2 text-4xl font-extrabold">$2.99</div>
            <div className="text-xs" style={{ opacity: 0.55 }}>per month</div>
          </div>
          <div className="rounded-3xl p-6" style={{ background: EMBER, color: '#fff' }}>
            <div className="text-sm opacity-80">Yearly · save 30%</div>
            <div className="mt-2 text-4xl font-extrabold">$24.99</div>
            <div className="text-xs opacity-80">about $2.08 / month</div>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="text-4xl font-extrabold tracking-tight">Questions</h2>
        <div className="mt-8 divide-y" style={{ borderColor: 'rgba(244,238,227,.15)' }}>
          {[
            ['Is Chatter free?', 'Yes. Chatter Pro is optional and starts with a 7-day free trial.'],
            ['Does it work offline?', 'Once installed or opened once, the app loads offline. Messages need a connection to sync when accounts are enabled.'],
            ['How do updates work?', 'The web app shows an Update button when a new version is ready. Store versions update through Google Play; desktop installers are re-downloaded from this page.'],
            ['Which platforms are supported?', 'Android, Windows, Mac and Linux, plus any modern browser.'],
          ].map(([q, a]) => (
            <details key={q} className="group py-4" style={{ borderColor: 'rgba(244,238,227,.15)' }}>
              <summary className="cursor-pointer list-none text-lg font-semibold">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed" style={{ opacity: 0.7 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t px-5 py-8 text-center text-sm" style={{ borderColor: 'rgba(244,238,227,.12)', opacity: 0.6 }}>
        © {new Date().getFullYear()} Chatter · Talk freely.
      </footer>
    </div>
  )
}
