import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePro } from '../pro'
import { isChatOpened, markChatOpened, onOpenedChange } from '../appLock'
import { ArrowLeft, Phone, Video, Search, MoreVertical, Smile, Paperclip, Send, Check, CheckCheck, Lock, Unlock, Tag } from 'lucide-react'
import type { Chat, Message } from '../data'
import GhostCanvas from './GhostCanvas'
import { Ghost as GhostIcon } from 'lucide-react'
import CalendarPanel from './CalendarPanel'
import type { CalEvent } from '../calendar'
import { CalendarDays, Reply, MoreHorizontal, X as XIcon } from 'lucide-react'
import { useEdits, editMessage } from '../edits'
import { readGesturePrefs } from '../prefs'
import { MessageSheet, PersonEditor } from './EditSheets'
import { Palette, BarChart3 } from 'lucide-react'
import { CreatePollModal, PollCard } from './Polls'
import type { GroupMember } from '../social'
import ChatStyleSheet from './ChatStyleSheet'
import { ProfileSheet, PhotoZoom } from './ProfileView'
import { useAppearance } from '../appearance'
import { useChatStyle, wallpaperStyle } from '../chatStyle'
import EmojiPicker from './EmojiPicker'
import { insertAtCaret } from '../caret'
import VoiceRecorder, { type Recording } from './VoiceRecorder'
import VoiceMessage from './VoiceMessage'
import FileMessage from './FileMessage'
import { checkFile, encodeAttachment, parseAttachment, previewText } from '../attachmentFormat'
import type { AttachmentApi } from '../attachmentStore'
import { currentExpiry, isExpired, parseMeta, ruleMessage, timeLeftShort, withMeta } from '../messageMeta'
import { readRule } from '../chatRules'
import MessageControls from './MessageControls'
import { Timer } from 'lucide-react'
import {
  PrivateLock,
  SmartReplies,
  MoodIndicator,
  EmojiStory,
  isEmojiStory,
  ViewingEye,
  TagChip,
  TAG_DEFS,
  TimelineJump,
  type TagId,
} from './Innovations'

function Gestural({ onReply, onReact, onMenu, children }: { onReply: () => void; onReact: () => void; onMenu: () => void; children: React.ReactNode }) {
  const g = readGesturePrefs()
  const [dx, setDx] = useState(0)
  const st = useRef({ x: 0, y: 0, moved: false, last: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined, swiping: false })
  const clear = () => clearTimeout(st.current.timer)
  return (
    <div
      className="relative"
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .2s', touchAction: 'pan-y' }}
      onTouchStart={(e) => {
        const t = e.touches[0]
        st.current.x = t.clientX
        st.current.y = t.clientY
        st.current.moved = false
        st.current.swiping = false
        clear()
        if (g.longPress) st.current.timer = setTimeout(() => { st.current.moved = true; navigator.vibrate?.(15); onMenu() }, 450)
      }}
      onTouchMove={(e) => {
        const t = e.touches[0]
        const mx = t.clientX - st.current.x
        const my = t.clientY - st.current.y
        if (Math.abs(mx) > 8 || Math.abs(my) > 8) { st.current.moved = true; clear() }
        if (g.swipeReply && (st.current.swiping || (mx > 10 && Math.abs(mx) > Math.abs(my) * 1.5))) {
          st.current.swiping = true
          setDx(Math.max(0, Math.min(mx, 72)))
        }
      }}
      onTouchEnd={() => {
        clear()
        if (st.current.swiping && dx > 55) { navigator.vibrate?.(10); onReply() }
        setDx(0)
        if (!st.current.moved && g.doubleTap) {
          const now = Date.now()
          if (now - st.current.last < 320) { st.current.last = 0; onReact() } else st.current.last = now
        }
      }}
      onTouchCancel={() => { clear(); setDx(0) }}
      onDoubleClick={() => g.doubleTap && onReact()}
      onContextMenu={(e) => { if (g.longPress) { e.preventDefault(); onMenu() } }}
    >
      {dx > 10 && <Reply size={18} className="absolute -left-8 top-1/2 -translate-y-1/2 text-[rgb(var(--accent))]" style={{ opacity: Math.min(1, dx / 55) }} />}
      {children}
    </div>
  )
}

type ChatActions = {
  pinned: boolean
  archived: boolean
  blocked: boolean
  onPin: (v: boolean) => void
  onArchive: (v: boolean) => void
  onDelete: () => void
  onBlock: (v: boolean) => void
}

type Props = {
  chat: Chat
  typing: boolean
  onBack: () => void
  onSend: (chatId: string, text: string) => void
  onUpgrade: () => void
  onTyping?: () => void
  onCall?: (media: 'voice' | 'video') => void
  onOpenGroup?: () => void
  onPinChat?: (v: boolean) => void
  chatActions?: ChatActions
  /** real chats can be made confidential; decoy chats can't */
  allowLock?: boolean
  /** where this chat's files and voice messages are kept; without it, attach and voice are off */
  attachments?: AttachmentApi
  /** keeps recently used emojis apart, so decoy mode never shows what was used in real chats */
  emojiScope?: string
  polls?: {
    myId: string
    members: GroupMember[]
    isAdmin: boolean
    onCreate: (question: string, options: string[], multi: boolean) => Promise<{ ok: boolean; error?: string }>
    onVote: (pollId: string, options: number[]) => void
    onClose: (pollId: string) => void
  }
  calendar?: {
    myId: string
    events: CalEvent[]
    onAdd: (title: string, note: string, startsAt: Date, remind: number) => Promise<{ ok: boolean; error?: string }>
    onDelete: (id: string) => void
  }
}

function StatusIcon({ status }: { status?: Message['status'] }) {
  if (!status) return null
  if (status === 'sent') return <Check size={14} className="text-[rgb(var(--text-tertiary))]" />
  if (status === 'delivered') return <CheckCheck size={14} className="text-[rgb(var(--text-tertiary))]" />
  return <CheckCheck size={14} className="text-sky-400" />
}

const story0 = (_t: string) => false
const DAY_LABELS = ['Today', 'Yesterday', 'Monday', 'Sunday', 'Friday']

export default function ChatWindow({ chat: rawChat, typing, onBack, onSend, onUpgrade, onTyping, onCall, onOpenGroup, onPinChat, chatActions, allowLock = false, attachments, emojiScope = 'real', polls, calendar }: Props) {
  const cstyle = useChatStyle()
  // ticks while disappearing messages are on screen, so they vanish on time
  const [clock, setClock] = useState(() => Date.now())
  const hasTimers = rawChat.messages.some((m) => m.text.startsWith('⟦meta:') && m.text.includes('"x"'))
  useEffect(() => {
    if (!hasTimers) return
    setClock(Date.now()) // catch up straight away; the first timed message may arrive long after the chat opened
    const t = setInterval(() => setClock(Date.now()), 5000)
    return () => clearInterval(t)
  }, [hasTimers])
  const [controlsOpen, setControlsOpen] = useState(false)
  const pro = usePro()
  const opened = useSyncExternalStore(onOpenedChange, () => isChatOpened(rawChat.id))
  const confidential = allowLock && pro.lockedChatIds.includes(rawChat.id) && !opened
  const [styleOpen, setStyleOpen] = useState(false)
  const edits = useEdits()
  const personEdit = edits.people[rawChat.id]
  const chat: Chat = useMemo(
    () => ({
      ...rawChat,
      name: personEdit?.name ?? rawChat.name,
      avatar: personEdit?.avatar ?? rawChat.avatar,
      messages: rawChat.messages
        .filter((m) => !edits.msgs[m.id]?.deleted)
        .map((m) => {
          // the sender's rules ride at the top of the message; read them and hide the marker
          const { meta, body } = parseMeta(m.text)
          const base = meta ? { ...m, text: body, meta } : m
          const e = edits.msgs[m.id]
          return e ? { ...base, text: e.text ?? base.text, time: e.time ?? base.time } : base
        })
        .filter((m) => !isExpired(m.meta, clock)),
    }),
    [rawChat, personEdit, edits.msgs, clock],
  )
  const expirySecs = useMemo(() => currentExpiry(rawChat.messages.map((m) => m.text)), [rawChat.messages])
  /** Sends with this chat's rules: disappearing time (shared) and my copy / download protection. */
  const sendRuled = useCallback((chatId: string, text: string) => {
    const r = readRule(chatId)
    onSend(chatId, withMeta(text, { x: expirySecs ? Date.now() + expirySecs * 1000 : undefined, nc: r.noCopy || undefined, nd: r.noDownload || undefined }))
  }, [onSend, expirySecs])
  const [sheetMsg, setSheetMsg] = useState<string | null>(null)
  const [personOpen, setPersonOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const appearance = useAppearance()
  const [tagMenu, setTagMenu] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const edge = useRef<{ x: number; y: number } | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [showLock, setShowLock] = useState<Message | null>(null)
  const [tagFilter, setTagFilter] = useState<TagId | null>(null)
  const tagsOf = (m: Message): TagId[] => (edits.msgs[m.id]?.tags as TagId[] | undefined) ?? m.tags ?? []
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const [ghost, setGhost] = useState(false)
  const [holding, setHolding] = useState(false)
  const [wiped, setWiped] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout>>()
  const exitGhost = useCallback(() => {
    setGhost((g) => {
      if (g) {
        setWiped(true)
        setTimeout(() => setWiped(false), 2600)
      }
      return false
    })
  }, [])
  const startHold = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.bg) return
    setHolding(true)
    holdTimer.current = setTimeout(() => {
      setHolding(false)
      setGhost(true)
    }, 800)
  }
  const cancelHold = () => {
    clearTimeout(holdTimer.current)
    setHolding(false)
  }
  const bottomRef = useRef<HTMLDivElement>(null)
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages.length, typing, chat.id])

  const lastOtherRaw = [...chat.messages].reverse().find((m) => !m.fromMe)?.text
  const lastOther = lastOtherRaw && !parseAttachment(lastOtherRaw) ? lastOtherRaw : undefined
  const hasPrivate = chat.messages.some((m) => m.private)

  // Timeline anchors: media-like thumbnails from the chat's own avatars/unsplash set, one per day group
  const anchors = useMemo(() => {
    const thumbs = [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=160&q=70',
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=160&q=70',
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=160&q=70',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=160&q=70',
      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=160&q=70',
    ]
    const days = Array.from(new Set(chat.messages.map((m) => m.day ?? 0)))
    return days.map((d, i) => ({ id: `d${d}`, label: DAY_LABELS[d] ?? 'Earlier', thumb: thumbs[i % thumbs.length], day: d }))
  }, [chat.messages])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    const quoted = chat.messages.find((m) => m.id === replyTo)
    const q = quoted ? `↪ ${previewText(quoted.text).replace(/^↪ [^\n]*\n/, '').replace(/\n/g, ' ').slice(0, 80)}\n` : ''
    sendRuled(rawChat.id, q + text)
    setReplyTo(null)
    setDraft('')
    setEmojiOpen(false)
  }

  // ---------- emoji, files and voice messages ----------
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sendErr, setSendErr] = useState<string | null>(null)
  const errTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showErr = useCallback((msg: string) => {
    setSendErr(msg)
    clearTimeout(errTimer.current)
    errTimer.current = setTimeout(() => setSendErr(null), 6000)
  }, [])
  useEffect(() => () => clearTimeout(errTimer.current), [])

  const sendFiles = async (files: File[]) => {
    if (!attachments) return
    for (const f of files) {
      const bad = checkFile(f)
      if (bad) { showErr(bad); continue }
      setSending(f.name)
      const type = f.type || 'application/octet-stream'
      const up = await attachments.upload(f, f.name, type)
      if (!up.ok) { showErr(up.error); continue }
      sendRuled(rawChat.id, encodeAttachment({ kind: 'file', key: up.key, name: f.name.slice(0, 200), size: f.size, type }))
    }
    setSending(null)
  }

  const sendVoice = useCallback(async (r: Recording) => {
    if (!attachments) return
    setSending('voice message')
    const up = await attachments.upload(r.blob, 'voice-message', r.type)
    setSending(null)
    if (!up.ok) return showErr(up.error)
    sendRuled(rawChat.id, encodeAttachment({ kind: 'voice', key: up.key, size: r.blob.size, type: r.type, duration: r.duration, wave: r.wave, transcript: r.transcript, lang: r.lang }))
  }, [attachments, sendRuled, rawChat.id, showErr])

  const subtitle = typing ? 'typing…' : chat.online ? 'online' : chat.lastSeen ?? 'offline'

  const visibleMessages = chat.messages.filter((m) => {
    if (tagFilter) return tagsOf(m).includes(tagFilter)
    return true
  })

  return (
    <section
      className="relative flex h-full min-w-0 flex-1 flex-col bg-[rgb(var(--bg-chat))]"
      onTouchStart={(e) => {
        const t = e.touches[0]
        edge.current = readGesturePrefs().edgeBack && (t.clientX < 24 || t.clientX > window.innerWidth - 24) ? { x: t.clientX, y: t.clientY } : null
      }}
      onTouchEnd={(e) => {
        const s = edge.current
        edge.current = null
        if (!s) return
        const t = e.changedTouches[0]
        if (Math.abs(t.clientX - s.x) > 90 && Math.abs(t.clientY - s.y) < 60) onBack()
      }}
    >
      <header className={`flex items-center gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-3 py-3 md:px-5 ${appearance.navColor ? 'nav-custom' : ''}`}>
        <div className="flex items-center gap-1 text-[rgb(var(--text-secondary))]">
          {onCall && (
            <>
              <button onClick={() => onCall('video')} aria-label="Video call" title="Video call" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><Video size={19} /></button>
              <button onClick={() => onCall('voice')} aria-label="Voice call" title="Voice call" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><Phone size={19} /></button>
            </>
          )}
          {!chat.isGroup && (
            <button onClick={() => setGhost(true)} aria-label="Open Ghost Canvas" title="Ghost Canvas" className="rounded-full p-2 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent-soft))]"><GhostIcon size={19} /></button>
          )}
          {calendar && (
            <button onClick={() => setCalOpen(true)} aria-label="Open calendar" title="Calendar & event alarms" className="relative rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]">
              <CalendarDays size={19} />
              {calendar.events.some((e) => new Date(e.starts_at).getTime() > Date.now()) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />}
            </button>
          )}
          <button onClick={() => setControlsOpen(true)} aria-label="Message controls" title="Message controls: disappearing messages, copying, downloads, receipts" className={`relative rounded-full p-2 hover:bg-[rgb(var(--accent-soft))] ${expirySecs ? 'text-[rgb(var(--accent))]' : ''}`}><Timer size={19} /></button>
          <button onClick={() => setStyleOpen(true)} aria-label="Wallpaper, sound and pin" title="Wallpaper, sound, favorite & pin" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><Palette size={19} /></button>
          <button aria-label="Search in chat" className="hidden rounded-full p-2 hover:bg-[rgb(var(--accent-soft))] sm:block"><Search size={19} /></button>
          {onOpenGroup ? (
            <button onClick={onOpenGroup} aria-label="Group settings" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><MoreVertical size={19} /></button>
          ) : chatActions ? (
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} aria-label="Chat options" aria-expanded={menuOpen} className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><MoreVertical size={19} /></button>
              {menuOpen && (
                <div className="absolute left-0 top-11 z-30 w-52 overflow-hidden rounded-xl bg-[rgb(var(--bg-panel))] py-1 text-left text-sm shadow-xl ring-1 ring-[rgb(var(--border))]">
                  {[
                    { label: chatActions.pinned ? 'Unpin chat' : 'Pin chat', run: () => chatActions.onPin(!chatActions.pinned) },
                    { label: chatActions.archived ? 'Unarchive chat' : 'Archive chat', run: () => chatActions.onArchive(!chatActions.archived) },
                    { label: 'Delete chat history', run: () => chatActions.onDelete(), danger: true },
                    { label: chatActions.blocked ? 'Unblock' : 'Block', run: () => chatActions.onBlock(!chatActions.blocked), danger: true },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setMenuOpen(false)
                        item.run()
                      }}
                      className={`block w-full px-4 py-2.5 text-left hover:bg-[rgb(var(--bg-panel-soft))] ${item.danger ? 'text-rose-500' : ''}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button aria-label="More" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><MoreVertical size={19} /></button>
          )}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <button onClick={() => (chat.isGroup ? (onOpenGroup ? onOpenGroup() : setPersonOpen(true)) : setProfileOpen(true))} aria-label={chat.isGroup ? 'Group details' : 'View profile'} className="ml-auto block max-w-full truncate font-semibold hover:underline">{chat.name}</button>
          <div className={`flex items-center gap-2 text-xs ${typing ? 'text-[rgb(var(--accent))] font-medium' : 'text-[rgb(var(--text-secondary))]'}`}>
            {typing ? (
              <>
                <MoodIndicator mood={chat.mood ?? 'calm'} />
                <span>typing…</span>
              </>
            ) : (
              <span className="truncate">{subtitle}</span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            aria-label="Filter by tag"
            aria-expanded={tagMenu}
            onClick={() => setTagMenu((o) => !o)}
            className={`rounded-full p-2 hover:bg-[rgb(var(--accent-soft))] ${tagFilter ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))]'}`}
          >
            <Tag size={19} />
          </button>
          {tagMenu && (
            <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl bg-[rgb(var(--bg-panel))] py-1 shadow-xl ring-1 ring-[rgb(var(--border))]">
              <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]">Show tagged</p>
              {TAG_DEFS.map((t) => {
                const n = chat.messages.filter((m) => tagsOf(m).includes(t.id)).length
                return (
                  <button key={t.id} onClick={() => { setTagFilter(t.id); setTagMenu(false) }} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[rgb(var(--bg-panel-soft))]">
                    <TagChip id={t.id} />
                    <span className="text-xs text-[rgb(var(--text-secondary))]">{n}</span>
                  </button>
                )
              })}
              {tagFilter && <button onClick={() => { setTagFilter(null); setTagMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-panel-soft))]">Show all</button>}
            </div>
          )}
        </div>
        <button onClick={() => setZoomOpen(true)} aria-label={`View ${chat.name}'s photo`} className="shrink-0 rounded-full transition hover:opacity-85">
          <img src={chat.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        </button>
        <button onClick={onBack} aria-label="Back" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))] md:hidden">
          <ArrowLeft size={20} className="rotate-180" />
        </button>
      </header>

      {controlsOpen && <MessageControls chatId={rawChat.id} name={chat.name} expirySecs={expirySecs} onSetExpiry={(secs) => onSend(rawChat.id, ruleMessage(secs))} onClose={() => setControlsOpen(false)} />}
      {styleOpen && <ChatStyleSheet chatId={rawChat.id} name={chat.name} pinned={!!rawChat.pinned} onPin={(v) => onPinChat?.(v)} onClose={() => setStyleOpen(false)} lockable={allowLock} onUpgrade={onUpgrade} />}
      {confidential && (
        <PrivateLock
          title="Confidential chat"
          desc={`Verify it’s you to open your chat with ${chat.name.split(' ')[0]}.`}
          onUnlock={() => markChatOpened(rawChat.id)}
          onCancel={onBack}
        />
      )}

      {hasPrivate && (
        <div className="flex items-center justify-between gap-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-panel-soft))] px-4 py-1.5 text-xs text-[rgb(var(--text-secondary))] md:px-5">
          <span className="flex items-center gap-1.5">
            {unlocked ? <Unlock size={13} className="text-[rgb(var(--accent))]" /> : <Lock size={13} />}
            {unlocked ? 'Private messages unlocked' : 'Private messages are locked'}
          </span>
          <button
            onClick={() => (unlocked ? setUnlocked(false) : setShowLock(chat.messages.find((m) => m.private) ?? null))}
            className="font-semibold text-[rgb(var(--accent))] hover:underline"
          >
            {unlocked ? 'Lock' : 'Unlock'}
          </button>
        </div>
      )}

      <TimelineJump
        anchors={anchors}
        onJump={(id) => {
          const day = anchors.find((a) => a.id === id)?.day
          setActiveDay(day ?? null)
          const target = chat.messages.find((m) => (m.day ?? 0) === day)
          if (target) msgRefs.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
      />

      {tagFilter && (
        <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-4 py-2 md:px-5">
          <span className="text-xs text-[rgb(var(--text-secondary))]">Showing</span>
          <TagChip id={tagFilter} />
          <button onClick={() => setTagFilter(null)} className="ml-auto text-xs font-semibold text-[rgb(var(--accent))]">Clear</button>
        </div>
      )}

      <div
        className="chat-wallpaper relative flex-1 overflow-y-auto px-4 py-6 md:px-10"
        data-bg="1"
        style={wallpaperStyle(cstyle.wallpapers[rawChat.id])}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerMove={(e) => e.buttons === 0 && holding && cancelHold()}
      >
        {holding && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
            <span className="rounded-full bg-[rgb(var(--bg-panel))] px-3 py-1.5 text-xs font-medium shadow-lg ring-1 ring-[rgb(var(--accent))]">
              Keep holding to open Ghost Canvas…
            </span>
          </div>
        )}
        {wiped && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
            <span className="rounded-full bg-[rgb(var(--bg-panel))] px-3 py-1.5 text-xs font-medium shadow-lg ring-1 ring-[rgb(var(--border))]">
              Ghost Canvas closed · nothing was saved
            </span>
          </div>
        )}
        {showLock && !unlocked && (
          <PrivateLock
            onUnlock={() => {
              setUnlocked(true)
              setShowLock(null)
            }}
            onCancel={() => setShowLock(null)}
          />
        )}
        <div data-bg="1" className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {!visibleMessages.some((m) => m.dateLabel) && (
            <div className="my-2 flex justify-center">
              <span className="rounded-lg bg-[rgb(var(--bg-panel))] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[rgb(var(--text-secondary))] shadow-sm">
                {activeDay !== null ? DAY_LABELS[activeDay] ?? 'Earlier' : 'Today'}
              </span>
            </div>
          )}
          {visibleMessages.map((m, i) => {
            const prev = visibleMessages[i - 1]
            const newDay = !!m.dateLabel && m.dateLabel !== prev?.dateLabel
            const grouped = prev && prev.fromMe === m.fromMe && !newDay
            const hidden = m.private && !unlocked
            const tags = tagsOf(m)
            const reaction = edits.msgs[m.id]?.reaction
            const att = !hidden ? parseAttachment(m.text) : null
            const quoteMatch = !hidden && !att && !story0(m.text) ? /^↪ ([^\n]*)\n([\s\S]*)$/.exec(m.text) : null
            const viewed = !m.fromMe && i === visibleMessages.length - 1
            const story = !hidden && !att && isEmojiStory(m.text)
            // sender's protections apply to the other person's view
            const noCopy = !m.fromMe && !!m.meta?.nc
            const noSave = !m.fromMe && !!m.meta?.nd
            if (m.meta?.rule) {
              return (
                <div key={m.id} className="my-2 flex justify-center" role="note">
                  <span className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--bg-panel))] px-3 py-1.5 text-center text-[11px] text-[rgb(var(--text-secondary))] shadow-sm">
                    <Timer size={12} /> {m.fromMe ? 'You' : chat.name.split(' ')[0]}: {m.text.replace(/^⏱ /, '')}
                  </span>
                </div>
              )
            }
            return (
              <div key={m.id}>
              {newDay && (
                <div className="my-2 flex justify-center" role="separator">
                  <span className="rounded-lg bg-[rgb(var(--bg-panel))] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[rgb(var(--text-secondary))] shadow-sm">{m.dateLabel}</span>
                </div>
              )}
              <div
                ref={(el) => {
                  msgRefs.current[m.id] = el
                }}
                className={`msg-in flex ${m.fromMe ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-2'}`}
              >
                <div className="group relative max-w-[78%] md:max-w-[62%]">
                 <Gestural
                  onReply={() => setReplyTo(m.id)}
                  onReact={() => !hidden && editMessage(m.id, { reaction: reaction ? undefined : '❤️' })}
                  onMenu={() => !hidden && setSheetMsg(m.id)}
                 >
                  <div
                    onClick={() => {
                      if (m.private && !unlocked) setShowLock(m)
                    }}
                    onCopy={noCopy ? (e) => e.preventDefault() : undefined}
                    onCut={noCopy ? (e) => e.preventDefault() : undefined}
                    onDragStart={noCopy || noSave ? (e) => e.preventDefault() : undefined}
                    data-nocopy={noCopy || undefined}
                    style={{ fontSize: 'calc(14.5px * var(--font-scale, 1))', color: m.fromMe ? 'rgb(var(--bubble-out-fg, var(--text-primary)))' : 'rgb(var(--bubble-in-fg, var(--text-primary)))' }}
                    className={`bubble relative px-3 py-2 leading-relaxed shadow-sm transition ${noCopy ? 'select-none [-webkit-touch-callout:none]' : ''} ${
                      m.private && !unlocked ? 'cursor-pointer' : ''
                    } ${
                      m.fromMe
                        ? 'rounded-br-sm bg-[rgb(var(--bubble-out))]'
                        : `rounded-bl-sm ${viewed ? 'bg-[rgb(var(--bubble-in))] ring-1 ring-[rgb(var(--accent))]/30' : 'bg-[rgb(var(--bubble-in))]'}`
                    }`}
                  >
                    {m.poll && polls && !hidden ? (
                      <PollCard
                        poll={m.poll}
                        myId={polls.myId}
                        members={polls.members}
                        canClose={m.poll.createdBy === polls.myId || polls.isAdmin}
                        onVote={(opts) => polls.onVote(m.poll!.id, opts)}
                        onClosePoll={() => polls.onClose(m.poll!.id)}
                      />
                    ) : hidden ? (
                      <p className="flex items-center gap-2 italic text-[rgb(var(--text-secondary))]">
                        <Lock size={14} /> Locked private message · tap to unlock
                      </p>
                    ) : att?.kind === 'voice' ? (
                      <VoiceMessage att={att} api={attachments} fromMe={m.fromMe} canSave={!noSave} />
                    ) : att?.kind === 'file' ? (
                      <FileMessage att={att} api={attachments} canSave={!noSave} />
                    ) : story ? (
                      <EmojiStory text={m.text} />
                    ) : quoteMatch ? (
                      <>
                        <p className="mb-1 truncate rounded-lg border-l-2 border-[rgb(var(--accent))] bg-black/5 px-2 py-1 text-xs text-[rgb(var(--text-secondary))] dark:bg-white/5">{quoteMatch[1]}</p>
                        <p className="whitespace-pre-wrap break-words">{quoteMatch[2]}</p>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                    <div className="float-right ml-3 mt-1 flex translate-y-0.5 items-center gap-1 text-[11px] text-[rgb(var(--text-secondary))]">
                      {viewed && <ViewingEye active />}
                      {m.meta?.x && <span className="flex items-center gap-0.5" title="Disappears"><Timer size={11} />{timeLeftShort(m.meta.x, clock)}</span>}
                      <span>{m.time}</span>
                      {m.fromMe && <StatusIcon status={m.status} />}
                    </div>
                  </div>
                  </Gestural>
                  {((tags.length > 0 && !hidden) || reaction) && (
                    <div className={`mt-1 flex flex-wrap items-center gap-1 ${m.fromMe ? 'justify-end' : ''}`}>
                      {reaction && !hidden && <span className="rounded-full bg-[rgb(var(--bg-panel))] px-1.5 py-0.5 text-sm shadow ring-1 ring-[rgb(var(--border))]">{reaction}</span>}
                      {!hidden && tags.map((t) => (
                        <TagChip key={t} id={t} />
                      ))}
                    </div>
                  )}
                  {!hidden && (
                    <button
                      onClick={() => setSheetMsg(m.id)}
                      aria-label="Message options"
                      className={`absolute -top-2 ${m.fromMe ? '-left-2' : '-right-2'} rounded-full bg-[rgb(var(--bg-panel))] p-1 text-[rgb(var(--text-secondary))] opacity-60 shadow ring-1 ring-[rgb(var(--border))] transition group-hover:opacity-100 focus-visible:opacity-100`}
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  )}
                </div>
              </div>
              </div>
            )
          })}
          {typing && (
            <div className="mt-2 flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-[rgb(var(--bubble-in))] px-4 py-3 shadow-sm">
                <MoodIndicator mood={chat.mood ?? 'calm'} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <SmartReplies lastText={lastOther} onPick={(t) => sendRuled(chat.id, t)} />
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-4 py-2 text-xs md:px-5">
          <Reply size={14} className="shrink-0 text-[rgb(var(--accent))]" />
          <p className="min-w-0 flex-1 truncate text-[rgb(var(--text-secondary))]">Replying to “{previewText(chat.messages.find((m) => m.id === replyTo)?.text ?? '').replace(/^↪ [^\n]*\n/, '')}”</p>
          <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="rounded-full p-1 hover:bg-[rgb(var(--accent-soft))]"><XIcon size={14} /></button>
        </div>
      )}
      {(sending || sendErr) && (
        <div role={sendErr ? 'alert' : 'status'} className={`flex items-center gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-4 py-2 text-xs md:px-5 ${sendErr ? 'text-rose-500' : 'text-[rgb(var(--text-secondary))]'}`}>
          <span className="min-w-0 flex-1">{sendErr ?? `Sending ${sending}…`}</span>
          {sendErr && <button type="button" onClick={() => setSendErr(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-[rgb(var(--accent-soft))]"><XIcon size={14} /></button>}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="relative flex items-end gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-3 py-3 md:px-5"
      >
        {emojiOpen && (
          <EmojiPicker
            scope={emojiScope}
            className="absolute bottom-full left-2 mb-2"
            onClose={() => setEmojiOpen(false)}
            onPick={(e) => insertAtCaret(inputRef.current, draft, e, setDraft)}
          />
        )}
        <button
          type="button"
          onClick={() => setEmojiOpen((o) => !o)}
          aria-label="Emoji"
          aria-expanded={emojiOpen}
          aria-haspopup="dialog"
          className={`rounded-full p-2.5 hover:bg-[rgb(var(--accent-soft))] ${emojiOpen ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))]'}`}
        >
          <Smile size={22} />
        </button>
        {attachments && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!sending} aria-label="Attach a file (up to 1 MB)" title="Attach a file (up to 1 MB)" className="rounded-full p-2.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))] disabled:opacity-40">
              <Paperclip size={22} />
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ''
                void sendFiles(files)
              }}
            />
          </>
        )}
        {polls && (
          <button type="button" onClick={() => setPollOpen(true)} aria-label="Create poll" title="Create poll" className="rounded-full p-2.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]">
            <BarChart3 size={22} />
          </button>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (e.target.value) onTyping?.()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Type a message · try 🌅+☕+📖 for an emoji story"
          aria-label="Message"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl bg-[rgb(var(--bg-panel-soft))] px-4 py-2.5 text-[15px] outline-none ring-1 ring-transparent transition placeholder:text-[rgb(var(--text-tertiary))] focus:ring-[rgb(var(--accent))]"
        />
        {draft.trim() ? (
          <button
            type="submit"
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow-md transition hover:scale-105 active:scale-95"
          >
            <Send size={18} className="translate-x-px" />
          </button>
        ) : attachments ? (
          <VoiceRecorder onSend={sendVoice} onError={showErr} onActiveChange={setRecording} />
        ) : null}
        {recording && <span className="sr-only">Recording a voice message</span>}
      </form>
      {sheetMsg && (() => {
        const m = chat.messages.find((x) => x.id === sheetMsg)
        const raw = rawChat.messages.find((x) => x.id === sheetMsg)
        if (!m || !raw) return null
        return <MessageSheet canCopy={m.fromMe || !m.meta?.nc} id={m.id} text={previewText(m.text)} time={m.time} edit={edits.msgs[m.id]} tags={tagsOf(m)} gestures={{ longPress: true }} onClose={() => setSheetMsg(null)} onReply={() => setReplyTo(m.id)} />
      })()}
      {zoomOpen && <PhotoZoom src={chat.avatar} name={chat.name} onClose={() => setZoomOpen(false)} />}
      {profileOpen && <ProfileSheet chat={chat} onClose={() => setProfileOpen(false)} onZoom={() => setZoomOpen(true)} onEditContact={() => { setProfileOpen(false); setPersonOpen(true) }} />}
      {personOpen && <PersonEditor chatId={rawChat.id} name={chat.name} avatar={chat.avatar} edited={!!personEdit} onClose={() => setPersonOpen(false)} />}
      {pollOpen && polls && <CreatePollModal onClose={() => setPollOpen(false)} onCreate={polls.onCreate} />}
      {calOpen && calendar && <CalendarPanel friend={chat.name.split(' ')[0]} {...calendar} onClose={() => setCalOpen(false)} />}
      {ghost && <GhostCanvas friend={chat.name.split(' ')[0]} chatId={chat.id} onSend={sendRuled} onExit={exitGhost} onUpgrade={onUpgrade} calendar={calendar} />}
    </section>
  )
}
