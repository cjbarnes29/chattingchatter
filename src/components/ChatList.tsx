import { Star, Search, Pin, BellOff, Plus, MessageSquarePlus, Crown, Users, Archive, ArrowLeft } from 'lucide-react'
import type { Chat } from '../data'
import { useAuth } from '../auth'
import { useRef, useState } from 'react'
import { useEdits } from '../edits'
import { readGesturePrefs } from '../prefs'
import { useAppearance } from '../appearance'

type Props = {
  chats: Chat[]
  activeId: string | null
  query: string
  onQuery: (q: string) => void
  onSelect: (id: string) => void
  dark: boolean
  onToggleDark: () => void
  onOpenSettings: () => void
  onUpgrade: () => void
  onNewChat: () => void
  onOpenContacts: () => void
  showArchived: boolean
  archivedCount: number
  onToggleArchived: () => void
  isPro: boolean
  stories?: React.ReactNode
  onNewGroup?: () => void
  onPinChat?: (id: string, v: boolean) => void
  onArchiveChat?: (id: string, v: boolean) => void
}

function lastMessage(chat: Chat) {
  const m = chat.messages[chat.messages.length - 1]
  if (!m) return ''
  return (m.fromMe ? 'You: ' : '') + m.text
}

function SwipeRow({ chat, enabled, archived, onPin, onArchive, children }: { chat: Chat; enabled: boolean; archived: boolean; onPin?: (id: string, v: boolean) => void; onArchive?: (id: string, v: boolean) => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0)
  const [open, setOpen] = useState(false)
  const s = useRef({ x: 0, y: 0, on: false })
  const can = enabled && !!onPin && !!onArchive
  return (
    <div className="relative overflow-hidden rounded-xl">
      {can && (
        <div className="absolute inset-y-0 right-0 flex w-40 items-stretch">
          <button onClick={() => { onPin!(chat.id, !chat.pinned); setOpen(false); setDx(0) }} className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-amber-500 text-[11px] font-bold text-white"><Pin size={16} />{chat.pinned ? 'Unpin' : 'Pin'}</button>
          <button onClick={() => { onArchive!(chat.id, !archived); setOpen(false); setDx(0) }} className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-[rgb(var(--accent))] text-[11px] font-bold text-[rgb(var(--accent-foreground))]"><Archive size={16} />{archived ? 'Unarchive' : 'Archive'}</button>
        </div>
      )}
      <div
        className="relative bg-[rgb(var(--bg-panel))]"
        style={{ transform: `translateX(${dx || (open ? -160 : 0)}px)`, transition: s.current.on ? 'none' : 'transform .2s', touchAction: 'pan-y' }}
        onTouchStart={(e) => { s.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false } }}
        onTouchMove={(e) => {
          if (!can) return
          const mx = e.touches[0].clientX - s.current.x
          const my = e.touches[0].clientY - s.current.y
          if (s.current.on || (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5)) {
            s.current.on = true
            setDx(Math.max(-160, Math.min(0, mx + (open ? -160 : 0))) || -0.01)
          }
        }}
        onTouchEnd={() => {
          if (s.current.on) setOpen(dx < -70)
          s.current.on = false
          setDx(0)
        }}
        onClickCapture={(e) => { if (open) { e.stopPropagation(); setOpen(false) } }}
      >
        {children}
      </div>
    </div>
  )
}

export default function ChatList({ chats: rawChats, activeId, query, onQuery, onSelect, dark, onToggleDark, onOpenSettings, onUpgrade, onNewChat, onOpenContacts, showArchived, archivedCount, onToggleArchived, isPro, stories, onNewGroup, onPinChat, onArchiveChat }: Props) {
  const { user } = useAuth()
  const ap = useAppearance()
  const [tab, setTab] = useState<'all' | 'fav' | 'groups' | 'unread'>('all')
  const edits = useEdits()
  const chats = rawChats.map((c) => {
    const p = edits.people[c.id]
    return p ? { ...c, name: p.name ?? c.name, avatar: p.avatar ?? c.avatar } : c
  })
  const swipeOn = readGesturePrefs().swipeChat
  const tabbed = chats.filter((c) => tab === 'all' || (tab === 'fav' && c.favorite) || (tab === 'groups' && c.isGroup) || (tab === 'unread' && c.unread > 0))
  const filtered = tabbed.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
  const TABS = [
    { id: 'all', label: 'All', n: chats.length },
    { id: 'fav', label: 'Favorites', n: chats.filter((c) => c.favorite).length },
    { id: 'groups', label: 'Groups', n: chats.filter((c) => c.isGroup).length },
    { id: 'unread', label: 'Unread', n: chats.filter((c) => c.unread > 0).length },
  ] as const
  const sorted = [...filtered].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))

  return (
    <aside className="flex h-full w-full flex-col bg-[rgb(var(--bg-panel))] md:w-[380px] md:min-w-[320px] md:border-l md:border-[rgb(var(--border))]">
      <header className={`flex items-center justify-between px-5 pt-5 pb-3 ${ap.navColor ? 'nav-custom' : ''}`}>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{showArchived ? 'Archived' : 'Inbox'}</h1>
          <p className="text-xs text-[rgb(var(--text-secondary))]">{chats.length} conversations</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleDark}
            aria-label="Toggle theme"
            className="rounded-full p-2 text-[rgb(var(--text-secondary))] transition hover:bg-[rgb(var(--accent-soft))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--accent))]"
          >
            <span className="text-sm font-semibold">{dark ? 'Light' : 'Dark'}</span>
          </button>
          <button aria-label="People I added" title="People I added" onClick={onOpenContacts} className="rounded-full p-2 text-[rgb(var(--text-secondary))] transition hover:bg-[rgb(var(--accent-soft))]">
            <Users size={20} />
          </button>
          <button
            aria-label="New chat"
            onClick={onNewChat}
            className="rounded-full p-2 text-[rgb(var(--text-secondary))] transition hover:bg-[rgb(var(--accent-soft))]"
          >
            <MessageSquarePlus size={20} />
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="rounded-full transition hover:opacity-80"
          >
            <img
              src={user?.avatar}
              alt="Your profile"
              className="ml-1 h-10 w-10 rounded-full object-cover ring-2 ring-[rgb(var(--accent-soft))]"
            />
          </button>
        </div>
      </header>

      <div className="px-4 pb-3">
        {!isPro && (
          <button
            onClick={onUpgrade}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-[#1C1926] via-[#2B1D26] to-[#7A2C1C] px-4 py-3 text-left text-white shadow-md transition hover:opacity-95"
          >
            <Crown size={18} className="shrink-0 text-[#FFB48F]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Upgrade to Chatter Pro</p>
              <p className="truncate text-xs text-white/65">Decoy profiles, infinite canvas & more</p>
            </div>
            <span className="rounded-full bg-[#FFB48F] px-2.5 py-1 text-[10px] font-bold uppercase text-black">Pro</span>
          </button>
        )}
        <label className="flex items-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3 py-2.5 ring-1 ring-transparent transition focus-within:ring-[rgb(var(--accent))]">
          <Search size={16} className="text-[rgb(var(--text-tertiary))]" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search or start a new chat"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-tertiary))]"
          />
          {query && (
            <button onClick={() => onQuery('')} aria-label="Clear" className="text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))]">
              <Plus size={16} className="rotate-45" />
            </button>
          )}
        </label>
      </div>

      {stories}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === t.id ? 'bg-[rgb(var(--tab-active))] text-[rgb(var(--tab-active-fg))]' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}>
            {t.label}{t.id !== 'all' && t.n > 0 ? ` ${t.n}` : ''}
          </button>
        ))}
        {onNewGroup && <button onClick={onNewGroup} className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]"><Users size={12} /> New group</button>}
      </div>
      {(showArchived || archivedCount > 0) && (
        <button
          onClick={onToggleArchived}
          className="mx-4 mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-[rgb(var(--bg-panel-soft))]"
        >
          {showArchived ? <ArrowLeft size={17} className="text-[rgb(var(--accent))]" /> : <Archive size={17} className="text-[rgb(var(--accent))]" />}
          {showArchived ? 'Back to inbox' : `Archived (${archivedCount})`}
        </button>
      )}
      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {sorted.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-[rgb(var(--text-secondary))]">
            {query ? `No chats match “${query}”.` : tab === 'fav' ? 'No favorites yet. Open a chat, tap the palette icon and choose Add to Favorites.' : tab === 'groups' ? 'No groups yet. Tap New group to make one.' : tab === 'unread' ? 'You’re all caught up.' : 'No chats yet.'}
          </li>
        )}
        {sorted.map((chat) => {
          const active = chat.id === activeId
          return (
            <li key={chat.id}>
              <SwipeRow chat={chat} enabled={swipeOn} archived={showArchived} onPin={onPinChat} onArchive={onArchiveChat}>
              <button
                onClick={() => onSelect(chat.id)}
                style={chat.pinned && !active ? { backgroundColor: `${chat.pinColor}22` } : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                  active ? 'bg-[rgb(var(--accent-soft))]' : 'hover:bg-[rgb(var(--bg-panel-soft))]'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={chat.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                  {chat.isGroup && <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--bg-panel))] text-[rgb(var(--accent))] ring-2 ring-[rgb(var(--bg-panel))]"><Users size={11} /></span>}
                  {chat.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[rgb(var(--bg-panel))]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{chat.name}</p>
                    <span className={`shrink-0 text-xs ${chat.unread > 0 ? 'text-[rgb(var(--accent))] font-semibold' : 'text-[rgb(var(--text-tertiary))]'}`}>
                      {chat.messages[chat.messages.length - 1]?.time}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="truncate text-sm text-[rgb(var(--text-secondary))]">{lastMessage(chat)}</p>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      {chat.favorite && <Star size={13} className="fill-amber-400 text-amber-400" />}
                      {chat.pinned && <Pin size={13} className="fill-current" style={{ color: chat.pinColor }} />}
                      {chat.muted && <BellOff size={13} className="text-[rgb(var(--text-tertiary))]" />}
                      {chat.unread > 0 && (
                        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${chat.muted ? 'bg-[rgb(var(--text-tertiary))]' : 'bg-[rgb(var(--accent))]'} text-[rgb(var(--accent-foreground))]`}>
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
              </SwipeRow>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
