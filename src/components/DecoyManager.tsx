import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, CheckCheck, ChevronDown, ChevronUp, Copy, Crown, Eye, Pencil, Plus, RotateCcw, Smile, Trash2, Type, Undo2 } from 'lucide-react'
import { usePro } from '../pro'
import { limit } from '../entitlements'
import { fileToAvatar } from '../edits'
import { insertAtCaret } from '../caret'
import { parseAttachment, previewText } from '../attachmentFormat'
import { dateLabel, initialsAvatar, LIMITS, sortMessages, timeLabel, toLocalStamp, validStamp, type DecoyContact, type DecoyMsg, type DecoyStatus } from '../decoyModel'
import {
  addContact, addMessage, decoySaveFailed, duplicate, moveContact, removeContact, removeMessage, resetDecoys, updateContact, updateMessage, useDecoyContacts,
} from '../decoyStore'
import EmojiPicker from './EmojiPicker'

const fld = 'w-full rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-1.5 text-sm outline-none ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))]'
const iconBtn = 'rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))] disabled:opacity-30'
const LAST_SEEN = ['online', 'last seen recently', 'last seen today at 09:30', 'last seen yesterday at 21:04', 'last seen a long time ago']

const lastText = (c: DecoyContact) => {
  const m = sortMessages(c.messages)[c.messages.length - 1]
  return m ? (m.fromMe ? 'You: ' : '') + previewText(m.text) : 'No messages yet'
}

function SavedNote() {
  useDecoyContacts() // re-render after every save
  return decoySaveFailed()
    ? <p role="alert" className="text-xs font-semibold text-rose-500">Couldn’t save: this device’s storage is full. Remove a photo or some messages.</p>
    : <p className="flex items-center gap-1 text-[11px] text-[rgb(var(--text-tertiary))]"><Check size={12} /> Saved on this device only</p>
}

/** Settings → Decoy chats: create and edit the fake contacts and conversations shown in decoy mode (any wrong PIN).
 *  Everything stays on this device; nothing here reads real chats, contacts or files. */
export default function DecoyManager() {
  const contacts = useDecoyContacts()
  const { isPro } = usePro()
  const max = limit('decoyChats', isPro)
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const open = contacts.find((c) => c.id === openId)

  if (open) return <ContactEditor contact={open} onBack={() => setOpenId(null)} />

  // which ones actually appear in decoy mode (free plan: the first visible one)
  const shown = new Set(contacts.filter((c) => !c.hidden).slice(0, Number.isFinite(max) ? max : undefined).map((c) => c.id))

  return (
    <div className="space-y-3 px-5 py-3">
      <p className="text-xs text-[rgb(var(--text-secondary))]">
        These fake chats appear when <b>any PIN other than yours</b> is entered on the lock screen. Write both sides of each conversation, set the times, and preview it. They’re kept on this device only and never mix with your real chats. Decoy mode needs a PIN lock (Privacy &amp; security).
      </p>
      {!isPro && <p className="flex items-center gap-1.5 rounded-xl bg-[rgb(var(--accent-soft))] px-3 py-2 text-xs font-semibold text-[rgb(var(--accent))]"><Crown size={13} /> Free plan shows 1 decoy chat. Chatter Pro shows them all.</p>}
      <ul className="space-y-2" aria-label="Decoy chats">
        {contacts.length === 0 && <li className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4 text-center text-sm text-[rgb(var(--text-secondary))]">No decoy chats yet.</li>}
        {contacts.map((c, i) => (
          <li key={c.id} className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-2.5">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setOpenId(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${c.name}`}>
                <img src={c.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    {c.hidden ? <span className="shrink-0 rounded-full bg-[rgb(var(--border))] px-1.5 py-0.5 text-[10px] font-semibold">Hidden</span>
                      : !shown.has(c.id) ? <span className="shrink-0 rounded-full bg-[rgb(var(--accent-soft))] px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--accent))]">Pro to show</span> : null}
                  </span>
                  <span className="block truncate text-xs text-[rgb(var(--text-secondary))]">{lastText(c)}</span>
                </span>
              </button>
              <span className="flex shrink-0 items-center">
                <button type="button" onClick={() => moveContact(c.id, -1)} disabled={i === 0} aria-label={`Move ${c.name} up`} className={iconBtn}><ChevronUp size={15} /></button>
                <button type="button" onClick={() => moveContact(c.id, 1)} disabled={i === contacts.length - 1} aria-label={`Move ${c.name} down`} className={iconBtn}><ChevronDown size={15} /></button>
                <button type="button" onClick={() => duplicate(c.id)} disabled={contacts.length >= LIMITS.contacts} aria-label={`Duplicate ${c.name}`} className={iconBtn}><Copy size={15} /></button>
                <button type="button" onClick={() => setOpenId(c.id)} aria-label={`Open ${c.name} editor`} className={iconBtn}><Pencil size={15} /></button>
                <button type="button" onClick={() => setConfirmDel(c.id)} aria-label={`Delete ${c.name}`} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={15} /></button>
              </span>
            </div>
            {confirmDel === c.id && (
              <div role="alertdialog" aria-label={`Delete ${c.name}?`} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs">
                <span className="flex-1">Delete {c.name} and the whole conversation? This can’t be undone.</span>
                <button type="button" onClick={() => setConfirmDel(null)} className="rounded-full px-3 py-1 font-semibold hover:bg-[rgb(var(--bg-panel))]">Cancel</button>
                <button type="button" onClick={() => { removeContact(c.id); setConfirmDel(null) }} className="rounded-full bg-rose-500 px-3 py-1 font-semibold text-white">Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => { const c = addContact(); if (c) setOpenId(c.id) }} disabled={contacts.length >= LIMITS.contacts} className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--accent))] px-3.5 py-2 text-xs font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-40">
          <Plus size={14} /> New decoy chat
        </button>
        {confirmReset ? (
          <span className="flex items-center gap-2 text-xs">
            Replace all decoy chats with the samples?
            <button type="button" onClick={() => setConfirmReset(false)} className="font-semibold">Cancel</button>
            <button type="button" onClick={() => { resetDecoys(); setConfirmReset(false) }} className="font-semibold text-rose-500">Reset</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)} className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--accent))] hover:underline"><RotateCcw size={12} /> Reset to samples</button>
        )}
      </div>
      <SavedNote />
    </div>
  )
}

function ContactEditor({ contact: c, onBack }: { contact: DecoyContact; onBack: () => void }) {
  const [tab, setTab] = useState<'messages' | 'preview'>('messages')
  const [photoErr, setPhotoErr] = useState('')
  const msgs = useMemo(() => sortMessages(c.messages), [c.messages])

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setPhotoErr('')
    try { updateContact(c.id, { avatar: await fileToAvatar(f) }) } catch { setPhotoErr('That picture couldn’t be used. Try another one.') }
  }

  const add = (fromMe: boolean) => {
    const last = msgs[msgs.length - 1]
    const at = last ? new Date(new Date(last.at).getTime() + 60_000) : new Date()
    addMessage(c.id, { fromMe, text: '', at: toLocalStamp(at), status: fromMe ? 'read' : undefined })
  }

  return (
    <div className="space-y-4 px-5 py-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--accent))]"><ArrowLeft size={14} /> All decoy chats</button>

      <div className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <img src={c.avatar} alt={`${c.name}’s picture`} className="h-16 w-16 rounded-full object-cover" />
          <label className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[rgb(var(--accent))]">
            <Camera size={12} /> Photo
            <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} aria-label={`Change photo for ${c.name}`} />
          </label>
          <button type="button" onClick={() => updateContact(c.id, { avatar: initialsAvatar(c.name) })} className="flex items-center gap-1 text-[11px] font-semibold text-[rgb(var(--text-secondary))]"><Type size={12} /> Initials</button>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Name
            <input value={c.name} onChange={(e) => updateContact(c.id, { name: e.target.value })} onBlur={() => !c.name.trim() && updateContact(c.id, { name: 'Contact' })} maxLength={LIMITS.name} className={`${fld} mt-1 normal-case tracking-normal`} />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Status under the name
            <input value={c.lastSeen} onChange={(e) => updateContact(c.id, { lastSeen: e.target.value })} list="decoy-last-seen" maxLength={LIMITS.lastSeen} className={`${fld} mt-1 normal-case tracking-normal`} />
            <datalist id="decoy-last-seen">{LAST_SEEN.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!c.hidden} onChange={(e) => updateContact(c.id, { hidden: !e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Show in decoy mode
          </label>
        </div>
      </div>
      {photoErr && <p role="alert" className="text-xs text-rose-500">{photoErr}</p>}

      <div role="tablist" aria-label="Decoy chat editor" className="flex gap-1 rounded-full bg-[rgb(var(--bg-panel-soft))] p-1">
        {(['messages', 'preview'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold ${tab === t ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : 'text-[rgb(var(--text-secondary))]'}`}>
            {t === 'messages' ? <><Pencil size={13} /> Messages</> : <><Eye size={13} /> Preview</>}
          </button>
        ))}
      </div>

      {tab === 'messages' ? (
        <div className="space-y-2">
          {msgs.length === 0 && <p className="rounded-xl bg-[rgb(var(--bg-panel-soft))] p-3 text-center text-xs text-[rgb(var(--text-secondary))]">No messages. Add one below.</p>}
          {msgs.map((m) => <MessageRow key={m.id} contactId={c.id} m={m} name={c.name} />)}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => add(false)} disabled={c.messages.length >= LIMITS.messages} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-[rgb(var(--border))] hover:bg-[rgb(var(--bg-panel-soft))] disabled:opacity-40"><Plus size={13} /> {c.name.split(' ')[0] || 'Their'}’s message</button>
            <button type="button" onClick={() => add(true)} disabled={c.messages.length >= LIMITS.messages} className="flex items-center gap-1 rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-40"><Plus size={13} /> Your message</button>
          </div>
          <p className="text-[11px] text-[rgb(var(--text-tertiary))]">Messages are ordered by their date and time. Empty messages aren’t shown in decoy mode.</p>
        </div>
      ) : (
        <Preview contact={c} msgs={msgs} />
      )}
      <SavedNote />
    </div>
  )
}

function MessageRow({ contactId, m, name }: { contactId: string; m: DecoyMsg; name: string }) {
  const [emoji, setEmoji] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const att = parseAttachment(m.text)
  const side = (fromMe: boolean) => updateMessage(contactId, m.id, { fromMe, status: fromMe ? m.status ?? 'read' : undefined })

  return (
    <div className={`relative rounded-xl p-2.5 ring-1 ${m.fromMe ? 'bg-[rgb(var(--accent-soft))] ring-[rgb(var(--accent))]/20' : 'bg-[rgb(var(--bg-panel-soft))] ring-[rgb(var(--border))]'}`} data-testid="decoy-message">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span role="group" aria-label="Who sent it" className="flex rounded-full bg-[rgb(var(--bg-panel))] p-0.5 text-[11px] font-semibold ring-1 ring-[rgb(var(--border))]">
          <button type="button" aria-pressed={!m.fromMe} onClick={() => side(false)} className={`rounded-full px-2.5 py-0.5 ${!m.fromMe ? 'bg-[rgb(var(--text-primary))] text-[rgb(var(--bg-panel))]' : ''}`}>{name.split(' ')[0] || 'Them'}</button>
          <button type="button" aria-pressed={m.fromMe} onClick={() => side(true)} className={`rounded-full px-2.5 py-0.5 ${m.fromMe ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : ''}`}>You</button>
        </span>
        <input
          type="datetime-local"
          value={m.at}
          onChange={(e) => validStamp(e.target.value) && updateMessage(contactId, m.id, { at: e.target.value })}
          aria-label="Date and time"
          className="rounded-lg bg-[rgb(var(--bg-panel))] px-2 py-1 text-xs ring-1 ring-[rgb(var(--border))] focus:ring-[rgb(var(--accent))] outline-none"
        />
        {m.fromMe && (
          <select value={m.status ?? 'read'} onChange={(e) => updateMessage(contactId, m.id, { status: e.target.value as DecoyStatus })} aria-label="Ticks" className="rounded-lg bg-[rgb(var(--bg-panel))] px-1.5 py-1 text-xs ring-1 ring-[rgb(var(--border))]">
            <option value="sent">✓ Sent</option>
            <option value="delivered">✓✓ Delivered</option>
            <option value="read">✓✓ Read (blue)</option>
          </select>
        )}
        <span className="ml-auto flex items-center">
          {!att && <button type="button" onClick={() => setEmoji((o) => !o)} aria-label="Add emoji" aria-expanded={emoji} className={iconBtn}><Smile size={15} /></button>}
          <button type="button" onClick={() => setConfirm(true)} aria-label="Delete message" className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={15} /></button>
        </span>
      </div>
      {att ? (
        <p className="rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-1.5 text-sm text-[rgb(var(--text-secondary))]">{previewText(m.text)} <span className="text-[11px]">(sent in decoy mode; can be deleted, not edited)</span></p>
      ) : (
        <textarea
          ref={ta}
          value={m.text}
          rows={Math.min(6, Math.max(1, Math.ceil(m.text.length / 38), m.text.split('\n').length))}
          maxLength={LIMITS.text}
          onChange={(e) => updateMessage(contactId, m.id, { text: e.target.value })}
          placeholder="Write the message…"
          aria-label="Message text"
          className={`${fld} resize-none`}
        />
      )}
      {emoji && (
        <EmojiPicker scope="decoy" className="absolute right-2 top-12" onClose={() => setEmoji(false)} onPick={(e) => insertAtCaret(ta.current, m.text, e, (v) => updateMessage(contactId, m.id, { text: v }))} />
      )}
      {confirm && (
        <div role="alertdialog" aria-label="Delete this message?" className="mt-2 flex items-center gap-2 text-xs">
          <span className="flex-1">Delete this message?</span>
          <button type="button" onClick={() => setConfirm(false)} className="flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold"><Undo2 size={12} /> Keep</button>
          <button type="button" onClick={() => removeMessage(contactId, m.id)} className="rounded-full bg-rose-500 px-2.5 py-1 font-semibold text-white">Delete</button>
        </div>
      )}
    </div>
  )
}

/** Looks like the chat will in decoy mode: header, date dividers, bubbles, times and ticks. */
function Preview({ contact: c, msgs }: { contact: DecoyContact; msgs: DecoyMsg[] }) {
  const visible = msgs.filter((m) => m.text.trim())
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-[rgb(var(--border))]" aria-label="Preview" data-testid="decoy-preview">
      <div className="flex items-center gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-3 py-2.5">
        <img src={c.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{c.name}</p>
          <p className={`truncate text-[11px] ${c.lastSeen.trim().toLowerCase() === 'online' ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))]'}`}>{c.lastSeen}</p>
        </div>
      </div>
      <div className="flex max-h-[26rem] flex-col gap-1 overflow-y-auto bg-[rgb(var(--bg-chat))] px-3 py-3">
        {visible.length === 0 && <p className="py-6 text-center text-xs text-[rgb(var(--text-secondary))]">Nothing to show yet.</p>}
        {visible.map((m, i) => {
          const prev = visible[i - 1]
          const label = dateLabel(m.at)
          const newDay = !prev || dateLabel(prev.at) !== label
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-2 flex justify-center">
                  <span className="rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-secondary))] shadow-sm">{label}</span>
                </div>
              )}
              <div className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'} ${prev && prev.fromMe === m.fromMe && !newDay ? 'mt-0.5' : 'mt-1.5'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[13.5px] leading-relaxed shadow-sm ${m.fromMe ? 'rounded-br-sm bg-[rgb(var(--bubble-out))]' : 'rounded-bl-sm bg-[rgb(var(--bubble-in))]'}`}
                  style={{ color: m.fromMe ? 'rgb(var(--bubble-out-fg, var(--text-primary)))' : 'rgb(var(--bubble-in-fg, var(--text-primary)))' }}
                >
                  <span className="whitespace-pre-wrap break-words">{previewText(m.text)}</span>
                  <span className="float-right ml-2 mt-1 flex translate-y-0.5 items-center gap-0.5 text-[10px] text-[rgb(var(--text-secondary))]">
                    {timeLabel(m.at)}
                    {m.fromMe && ((m.status ?? 'read') === 'sent' ? <Check size={12} /> : <CheckCheck size={12} className={(m.status ?? 'read') === 'read' ? 'text-sky-400' : ''} />)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
