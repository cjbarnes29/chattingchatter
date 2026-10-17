import { Star, Search, Pin, BellOff, Plus, MessageSquarePlus, Crown, Users, Archive, ArrowLeft, Sun, Moon, Home, Lock } from 'lucide-react'
import { usePro } from '../pro'
import { requestLock } from '../appLock'
import type { Chat } from '../data'
import { useAuth } from '../auth'
import { useRef, useState } from 'react'
import { useEdits } from '../edits'
import { readGesturePrefs } from '../prefs'
import { useAppearance } from '../appearance'
import { useInterface } from '../interface'
import type { Density, TabId } from '../interfacePrefs'

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
  /** optional home dashboard, shown as a "Home" tab on small screens */
  dashboard?: React.ReactNode
}

const DENSITY: Record<Density, { row: string; avatar: string; name: string }> = {
  compact: { row: 'gap-2.5 py-1.5', avatar: 'h-9 w-9', name: 'text-sm' },
  comfortable: { row: 'gap-3 py-3', avatar: 'h-12 w-12', name: '' },
  spacious: { row: 'gap-4 py-4', avatar: 'h-14 w-14', name: 'text-[1.05rem]' },
}
const TAB_LABEL: Record<TabId, string> = { all: 'All', fav: 'Favorites', groups: 'Groups', unread: 'Unread' }

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

export default function ChatList({ chats: rawChats, activeId, query, onQuery, onSelect, dark, onToggleDark, onOpenSettings, onUpgrade, onNewChat, onOpenContacts, showArchived, archivedCount, onToggleArchived, isPro, stories, onNewGroup, onPinChat, onArchiveChat, dashboard }: Props) {
  const { user } = useAuth()
  const ap = useAppearance()
  const ui = useInterface()
  const { lockedChatIds, hasPins } = usePro()
  const isLocked = (id: string) => lockedChatIds.includes(id)
  const [tab, setTab] = useState<TabId | 'home'>(() => (ui.tabs.includes(ui.defaultTab) ? ui.defaultTab : 'all'))
  const edits = useEdits()
  const chats = rawChats.map((c) => {
    const p = edits.people[c.id]
    return p ? { ...c, name: p.name ?? c.name, avatar: p.avatar ?? c.avatar } : c
  })
  const swipeOn = readGesturePrefs().swipeChat
  // a tab that was hidden in settings falls back to All
  const activeTab: TabId | 'home' = tab === 'home' ? (dashboard ? 'home' : 'all') : ui.tabs.includes(tab) ? tab : 'all'
  const tabbed = chats.filter((c) => activeTab === 'all' || activeTab === 'home' || (activeTab === 'fav' && c.favorite) || (activeTab === 'groups' && c.isGroup) || (activeTab === 'unread' && c.unread > 0))
  const filtered = tabbed.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
  const count = (id: TabId) => (id === 'all' ? chats.length : id === 'fav' ? chats.filter((c) => c.favorite).length : id === 'groups' ? chats.filter((c) => c.isGroup).length : chats.filter((c) => c.unread > 0).length)
  const order = new Map(filtered.map((c, i) => [c.id, i]))
  const sorted = [...filtered].sort(
    (a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      (ui.sort === 'unread' ? b.unread - a.unread : ui.sort === 'name' ? a.name.localeCompare(b.name) : 0) ||
      order.get(a.id)! - order.get(b.id)!,
  )
  const pinnedChats = chats.filter((c) => c.pinned)
  const d = DENSITY[ui.density]
  const iconBtn = 'rounded-full p-2 text-[rgb(var(--text-secondary))] transition hover:bg-[rgb(var(--accent-soft))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--accent))]'
  const shortcut = (id: (typeof ui.shortcuts)[number]) => {
    switch (id) {
      case 'theme':
        return (
          <button key={id} onClick={onToggleDark} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'} className={iconBtn}>
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        )
      case 'contacts':
        return (
          <button key={id} aria-label="People I added" title="People I added" onClick={onOpenContacts} className={iconBtn}>
            <Users size={20} />
          </button>
        )
      case 'newChat':
        return (
          <button key={id} aria-label="New chat" title="New chat" onClick={onNewChat} className={iconBtn}>
            <MessageSquarePlus size={20} />
          </button>
        )
      case 'newGroup':
        return onNewGroup ? (
          <button key={id} aria-label="New group" title="New group" onClick={onNewGroup} className={iconBtn}>
            <Plus size={20} />
          </button>
        ) : null
      case 'archived':
        return (
          <button key={id} aria-label={showArchived ? 'Back to inbox' : 'Archived chats'} title={showArchived ? 'Back to inbox' : 'Archived chats'} aria-pressed={showArchived} onClick={onToggleArchived} className={`${iconBtn} ${showArchived ? 'text-[rgb(var(--accent))]' : ''}`}>
            <Archive size={20} />
          </button>
        )
      case 'lock':
        return hasPins ? (
          <button key={id} aria-label="Lock Chatter now" title="Lock now" onClick={requestLock} className={iconBtn}>
            <Lock size={20} />
          </button>
        ) : null
    }
  }

  return (
    <aside className="flex h-full w-full flex-col bg-[rgb(var(--bg-panel))] md:w-[380px] md:min-w-[320px] md:border-l md:border-[rgb(var(--border))]">
      <header className={`flex items-center justify-between gap-2 px-5 pt-5 pb-3 ${ap.navColor ? 'nav-custom' : ''}`}>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{showArchived ? 'Archived' : 'Inbox'}</h1>
          <p className="text-xs text-[rgb(var(--text-secondary))]">{chats.length} conversations</p>
        </div>
        <nav aria-label="Inbox shortcuts" className="flex shrink-0 items-center gap-0.5">
          {ui.shortcuts.map(shortcut)}
          <button onClick={onOpenSettings} aria-label="Open settings" title="Settings" className="rounded-full transition hover:opacity-80">
            <img src={user?.avatar} alt="Your profile" className="ml-1 h-10 w-10 rounded-full object-cover ring-2 ring-[rgb(var(--accent-soft))]" />
          </button>
        </nav>
      </header>

      <div className="px-4 pb-3">
        {!isPro && ui.sections.proBanner && (
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
        {ui.sections.search && (
          <label className="flex items-center gap-2 rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3 py-2.5 ring-1 ring-transparent transition focus-within:ring-[rgb(var(--accent))]">
            <Search size={16} className="text-[rgb(var(--text-tertiary))]" />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search your chats"
              aria-label="Search your chats"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-tertiary))]"
            />
            {query && (
              <button onClick={() => onQuery('')} aria-label="Clear" className="text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))]">
                <Plus size={16} className="rotate-45" />
              </button>
            )}
          </label>
        )}
      </div>

      {ui.sections.stories && stories}
      {ui.sections.pinned && pinnedChats.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-4 pb-3" aria-label="Pinned chats">
          {pinnedChats.map((c) => (
            <button key={c.id} onClick={() => onSelect(c.id)} className="flex w-14 shrink-0 flex-col items-center gap-1" title={c.name}>
              <span className="relative">
                <img src={c.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as string]: c.pinColor ?? 'rgb(var(--accent))' }} />
                {c.unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10px] font-bold text-[rgb(var(--accent-foreground))]">{c.unread}</span>}
              </span>
              <span className="w-full truncate text-center text-[11px] text-[rgb(var(--text-secondary))]">{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2" role="tablist">
        {dashboard && (
          <button role="tab" aria-selected={activeTab === 'home'} onClick={() => setTab('home')} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition md:hidden ${activeTab === 'home' ? 'bg-[rgb(var(--tab-active))] text-[rgb(var(--tab-active-fg))]' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}>
            <Home size={12} /> Home
          </button>
        )}
        {ui.tabs.map((id) => {
          const n = count(id)
          return (
            <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeTab === id ? 'bg-[rgb(var(--tab-active))] text-[rgb(var(--tab-active-fg))]' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}>
              {TAB_LABEL[id]}{id !== 'all' && n > 0 ? ` ${n}` : ''}
            </button>
          )
        })}
        {onNewGroup && !ui.shortcuts.includes('newGroup') && <button onClick={onNewGroup} className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]"><Users size={12} /> New group</button>}
      </div>
      {activeTab === 'home' && dashboard ? (
        <div className="flex-1 overflow-y-auto px-4 pb-4 md:hidden">{dashboard}</div>
      ) : (
        <>
          {(showArchived || (archivedCount > 0 && ui.sections.archived)) && (
            <button
              onClick={onToggleArchived}
              className="mx-4 mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-[rgb(var(--bg-panel-soft))]"
            >
              {showArchived ? <ArrowLeft size={17} className="text-[rgb(var(--accent))]" /> : <Archive size={17} className="text-[rgb(var(--accent))]" />}
              {showArchived ? 'Back to inbox' : `Archived (${archivedCount})`}
            </button>
          )}
          <ul className={`flex-1 overflow-y-auto px-2 pb-4 ${ui.inboxLayout === 'grid' ? 'grid auto-rows-min grid-cols-3 content-start gap-1 sm:grid-cols-4 md:grid-cols-3' : ''}`}>
            {sorted.length === 0 && (
              <li className="col-span-full px-4 py-10 text-center text-sm text-[rgb(var(--text-secondary))]">
                {query ? `No chats match “${query}”.` : activeTab === 'fav' ? 'No favorites yet. Open a chat, tap the palette icon and choose Add to Favorites.' : activeTab === 'groups' ? 'No groups yet. Tap New group to make one.' : activeTab === 'unread' ? 'You’re all caught up.' : 'No chats yet.'}
              </li>
            )}
            {ui.inboxLayout === 'grid'
              ? sorted.map((chat) => {
                  const active = chat.id === activeId
                  return (
                    <li key={chat.id}>
                      <button
                        onClick={() => onSelect(chat.id)}
                        title={chat.name}
                        className={`relative flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-center transition ${active ? 'bg-[rgb(var(--accent-soft))]' : 'hover:bg-[rgb(var(--bg-panel-soft))]'}`}
                      >
                        <span className="relative">
                          <img src={chat.avatar} alt="" className={`${ui.density === 'compact' ? 'h-11 w-11' : ui.density === 'spacious' ? 'h-16 w-16' : 'h-14 w-14'} rounded-full object-cover`} />
                          {chat.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[rgb(var(--bg-panel))]" />}
                          {chat.unread > 0 && <span className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-[rgb(var(--accent-foreground))] ${chat.muted ? 'bg-[rgb(var(--text-tertiary))]' : 'bg-[rgb(var(--accent))]'}`}>{chat.unread}</span>}
                        </span>
                        <span className="flex w-full items-center justify-center gap-1 text-xs font-semibold">
                          {chat.pinned && <Pin size={10} className="shrink-0 fill-current" style={{ color: chat.pinColor }} />}
                          <span className="truncate">{chat.name}</span>
                        </span>
                      </button>
                    </li>
                  )
                })
              : sorted.map((chat) => {
                  const active = chat.id === activeId
                  return (
                    <li key={chat.id}>
                      <SwipeRow chat={chat} enabled={swipeOn} archived={showArchived} onPin={onPinChat} onArchive={onArchiveChat}>
                      <button
                        onClick={() => onSelect(chat.id)}
                        style={chat.pinned && !active ? { backgroundColor: `${chat.pinColor}22` } : undefined}
                        className={`group flex w-full items-center rounded-xl px-3 text-left transition ${d.row} ${
                          active ? 'bg-[rgb(var(--accent-soft))]' : 'hover:bg-[rgb(var(--bg-panel-soft))]'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <img src={chat.avatar} alt="" className={`${d.avatar} rounded-full object-cover`} />
                          {chat.isGroup && <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--bg-panel))] text-[rgb(var(--accent))] ring-2 ring-[rgb(var(--bg-panel))]"><Users size={11} /></span>}
                          {chat.online && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[rgb(var(--bg-panel))]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`truncate font-semibold ${d.name}`}>{chat.name}</p>
                            <span className={`shrink-0 text-xs ${chat.unread > 0 ? 'text-[rgb(var(--accent))] font-semibold' : 'text-[rgb(var(--text-tertiary))]'}`}>
                              {chat.messages[chat.messages.length - 1]?.time}
                            </span>
                          </div>
                          <div className={`flex items-center gap-2 ${ui.preview === 0 ? '' : 'mt-0.5'}`}>
                            {ui.preview > 0 && (
                              isLocked(chat.id) ? (
                                <p className="flex items-center gap-1 truncate text-sm italic text-[rgb(var(--text-secondary))]"><Lock size={12} className="shrink-0" /> Locked chat</p>
                              ) : (
                                <p className={`text-sm text-[rgb(var(--text-secondary))] ${ui.preview === 2 ? 'line-clamp-2 break-words' : 'truncate'}`}>{lastMessage(chat)}</p>
                              )
                            )}
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
        </>
      )}
    </aside>
  )
}
