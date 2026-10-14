import { useEffect, useState } from 'react'
import { Mail, KeyRound, ShieldQuestion } from 'lucide-react'
import { useAuth } from '../auth'
import { getSecurityQuestion, checkSecurityAnswer, setSecurityQuestion } from '../security'

type Msg = { ok: boolean; text: string } | null
const field = 'w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]'
const btn = 'w-full rounded-xl border border-[rgb(var(--border))] py-2.5 text-sm font-semibold transition hover:bg-[rgb(var(--accent-soft))] disabled:opacity-60'
const primary = 'w-full rounded-xl bg-[rgb(var(--accent))] py-2.5 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:opacity-90 disabled:opacity-60'
const SUGGESTIONS = ['What was the name of my first pet?', 'What street did I grow up on?', 'What was my first school called?', 'What is my favourite childhood food?']

const Note = ({ m }: { m: Msg }) => (m ? <p role="status" className={`text-xs ${m.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{m.text}</p> : null)
const Head = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]">{icon}</span>
    <div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-[rgb(var(--text-secondary))]">{desc}</p></div>
  </div>
)

export default function AccountSettings() {
  const { user, sendPasswordCode, changePasswordWithCode, changeEmail } = useAuth()
  const [question, setQuestion] = useState<string | null | undefined>(undefined) // undefined = loading

  // password
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<Msg>(null)
  const [pwBusy, setPwBusy] = useState(false)

  // security question
  const [editQ, setEditQ] = useState(false)
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [oldA, setOldA] = useState('')
  const [qMsg, setQMsg] = useState<Msg>(null)
  const [qBusy, setQBusy] = useState(false)

  // email
  const [ans, setAns] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emMsg, setEmMsg] = useState<Msg>(null)
  const [emBusy, setEmBusy] = useState(false)

  useEffect(() => { getSecurityQuestion().then(setQuestion) }, [])

  const sendCode = async () => {
    setPwBusy(true); setPwMsg(null)
    const r = await sendPasswordCode()
    setPwBusy(false)
    if (r.ok) { setCodeSent(true); setPwMsg({ ok: true, text: `We emailed a 6-digit code to ${user?.email}.` }) }
    else setPwMsg({ ok: false, text: r.error })
  }
  const updatePassword = async () => {
    if (pw !== pw2) return setPwMsg({ ok: false, text: 'Passwords do not match.' })
    setPwBusy(true); setPwMsg(null)
    const r = await changePasswordWithCode(code, pw)
    setPwBusy(false)
    if (r.ok) { setPwMsg({ ok: true, text: 'Password updated.' }); setCodeSent(false); setCode(''); setPw(''); setPw2('') }
    else setPwMsg({ ok: false, text: r.error })
  }

  const saveQuestion = async () => {
    setQBusy(true); setQMsg(null)
    const r = await setSecurityQuestion(q.trim(), a.trim(), question ? oldA.trim() : undefined)
    setQBusy(false)
    if (r.ok) { setQuestion(q.trim()); setEditQ(false); setQ(''); setA(''); setOldA(''); setQMsg({ ok: true, text: 'Security question saved.' }) }
    else setQMsg({ ok: false, text: r.error })
  }

  const updateEmail = async () => {
    setEmBusy(true); setEmMsg(null)
    const good = await checkSecurityAnswer(ans)
    if (!good) { setEmBusy(false); return setEmMsg({ ok: false, text: 'That answer is not correct.' }) }
    const r = await changeEmail(newEmail)
    setEmBusy(false)
    if (r.ok) { setEmMsg({ ok: true, text: `Confirmation sent. Open the link we emailed to ${newEmail.trim()} (and your current inbox) to finish.` }); setAns(''); setNewEmail('') }
    else setEmMsg({ ok: false, text: r.error })
  }

  const showQForm = question === null || editQ

  return (
    <div className="space-y-8 px-5 py-5">
      <section className="space-y-3">
        <Head icon={<ShieldQuestion size={16} />} title="Security question" desc="A secret only you know. It is asked before your email address can be changed." />
        {question === undefined ? (
          <p className="text-xs text-[rgb(var(--text-secondary))]">Loading…</p>
        ) : !showQForm ? (
          <>
            <p className="rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm">{question}</p>
            <button onClick={() => { setEditQ(true); setQMsg(null) }} className={btn}>Change question</button>
          </>
        ) : (
          <div className="space-y-2.5">
            {question && <input type="password" value={oldA} onChange={(e) => setOldA(e.target.value)} placeholder="Current answer" autoComplete="off" className={field} />}
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={90} placeholder="Your question" className={field} />
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => setQ(s)} className="rounded-full bg-[rgb(var(--bg-panel-soft))] px-2.5 py-1 text-[11px] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]">{s}</button>)}
            </div>
            <input type="password" value={a} onChange={(e) => setA(e.target.value)} maxLength={60} placeholder="Your answer" autoComplete="off" className={field} />
            <div className="flex gap-2">
              {question && <button onClick={() => setEditQ(false)} className={btn}>Cancel</button>}
              <button onClick={saveQuestion} disabled={qBusy || q.trim().length < 4 || a.trim().length < 2 || (!!question && !oldA)} className={primary}>{qBusy ? 'Saving…' : 'Save question'}</button>
            </div>
          </div>
        )}
        <Note m={qMsg} />
      </section>

      <section className="space-y-3">
        <Head icon={<Mail size={16} />} title="Change email" desc="Answer your security question, then confirm the new address from your inbox." />
        {question === null ? (
          <p className="rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-xs text-[rgb(var(--text-secondary))]">Set a security question above first. It protects your account if someone borrows your phone.</p>
        ) : question === undefined ? null : (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[rgb(var(--text-secondary))]">{question}</p>
            <input type="password" value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Your answer" autoComplete="off" className={field} />
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" autoComplete="email" className={field} />
            <button onClick={updateEmail} disabled={emBusy || !ans || !newEmail} className={btn}>{emBusy ? 'Checking…' : 'Verify and update email'}</button>
          </div>
        )}
        <Note m={emMsg} />
      </section>

      <section className="space-y-3">
        <Head icon={<KeyRound size={16} />} title="Change password" desc="We email you a one-time code to confirm it is really you." />
        {!codeSent ? (
          <button onClick={sendCode} disabled={pwBusy} className={btn}>{pwBusy ? 'Sending…' : `Email me a code`}</button>
        ) : (
          <div className="space-y-2.5">
            <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Code from your email" autoComplete="one-time-code" className={field} />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" className={field} />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" className={field} />
            <div className="flex gap-2">
              <button onClick={sendCode} disabled={pwBusy} className={btn}>Resend code</button>
              <button onClick={updatePassword} disabled={pwBusy || code.length < 6 || !pw} className={primary}>{pwBusy ? 'Updating…' : 'Update password'}</button>
            </div>
          </div>
        )}
        <Note m={pwMsg} />
      </section>
    </div>
  )
}
