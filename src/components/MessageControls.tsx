import { X, Timer, Copy, Download, CheckCheck, PenLine, Info } from 'lucide-react'
import { EXPIRY_OPTIONS } from '../messageMeta'
import { setRule, useChatRule, type Tri } from '../chatRules'
import { readPrivacyPrefs } from '../prefs'

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--border))]'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

function TriPick({ value, global, onChange, label }: { value: Tri; global: boolean; onChange: (v: Tri) => void; label: string }) {
  const opts: [Tri, string][] = [['default', `Default (${global ? 'on' : 'off'})`], ['on', 'On'], ['off', 'Off']]
  return (
    <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {opts.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${value === v ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))] ring-[rgb(var(--border))]'}`}>{l}</button>
      ))}
    </div>
  )
}

/** Message Control Center for one conversation. */
export default function MessageControls({ chatId, name, expirySecs, onSetExpiry, onClose }: { chatId: string; name: string; expirySecs: number; onSetExpiry: (secs: number) => void; onClose: () => void }) {
  const rule = useChatRule(chatId)
  const g = readPrivacyPrefs()
  const first = name.split(' ')[0]
  const sec = 'border-t border-[rgb(var(--border))] py-4'
  const head = 'flex items-center gap-2 text-sm font-semibold'
  const desc = 'mt-1 text-xs text-[rgb(var(--text-secondary))]'
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-label="Message controls" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[rgb(var(--bg-panel))] px-5 pb-5 pt-4 shadow-2xl ring-1 ring-[rgb(var(--border))] sm:rounded-3xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-extrabold tracking-tight">Message controls · {first}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
        </div>

        <div className="py-3">
          <p className={head}><Timer size={16} className="text-[rgb(var(--accent))]" /> Disappearing messages</p>
          <p className={desc}>New messages from both of you disappear after this time. Changing it posts a note in the chat so {first} sees it too.</p>
          <div role="radiogroup" aria-label="Disappearing messages" className="mt-2 flex flex-wrap gap-1.5">
            {EXPIRY_OPTIONS.map((o) => (
              <button key={o.secs} role="radio" aria-checked={expirySecs === o.secs} onClick={() => o.secs !== expirySecs && onSetExpiry(o.secs)} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${expirySecs === o.secs ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))] ring-[rgb(var(--border))]'}`}>{o.label}</button>
            ))}
          </div>
        </div>

        <div className={sec}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={head}><Copy size={16} className="text-[rgb(var(--accent))]" /> Block copying and forwarding</p>
              <p className={desc}>Messages you send from now on can’t be copied, selected or dragged out in {first}’s Chatter.</p>
            </div>
            <Switch on={rule.noCopy} onChange={(v) => setRule(chatId, { noCopy: v })} label="Block copying and forwarding" />
          </div>
        </div>

        <div className={sec}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={head}><Download size={16} className="text-[rgb(var(--accent))]" /> Allow saving attachments</p>
              <p className={desc}>When off, {first} can view or play the files and voice messages you send from now on, but Chatter won’t offer to save them.</p>
            </div>
            <Switch on={!rule.noDownload} onChange={(v) => setRule(chatId, { noDownload: !v })} label="Allow saving attachments" />
          </div>
        </div>

        <div className={sec}>
          <p className={head}><CheckCheck size={16} className="text-[rgb(var(--accent))]" /> Read receipts in this chat</p>
          <p className={desc}>Whether {first} sees blue ticks when you’ve read their messages.</p>
          <TriPick value={rule.receipts} global={g.readReceipts} onChange={(v) => setRule(chatId, { receipts: v })} label="Read receipts in this chat" />
        </div>

        <div className={sec}>
          <p className={head}><PenLine size={16} className="text-[rgb(var(--accent))]" /> Typing indicator in this chat</p>
          <p className={desc}>Whether {first} sees “typing…” while you write. Separate from read receipts.</p>
          <TriPick value={rule.typing} global={g.typingIndicator} onChange={(v) => setRule(chatId, { typing: v })} label="Typing indicator in this chat" />
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] p-3 text-[11px] text-[rgb(var(--text-secondary))]">
          <Info size={13} className="mt-0.5 shrink-0" />
          Chatter apps follow these rules, but nothing can stop a screenshot or a photo of the screen, and older app versions ignore them. Defaults for all chats are in Settings → Privacy &amp; security.
        </p>
      </div>
    </div>
  )
}
