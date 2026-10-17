import { useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import ChatList from './ChatList'
import ChatWindow from './ChatWindow'
import Settings from './Settings'
import Upgrade from './Upgrade'
import ContactsPanel from './ContactsPanel'
import { usePro } from '../pro'
import { limit } from '../entitlements'
import { useAuth } from '../auth'
import { addDecoy, sendDecoyMessage, useDecoyItems, useDecoyThreads, DECOY_SELF } from '../decoyStore'
import { useChatStyle, setLocalPin, DEFAULT_PIN } from '../chatStyle'
import { useBackHandler } from '../backNav'
import { useIsDark, toggleDark } from '../interface'
import { type Chat } from '../data'

/** The decoy profile: the same Chatter screens as the real app, filled with the harmless chats the user set up.
 *  Nothing from the real account is loaded here. */
export default function DecoyApp() {
  const { user } = useAuth()
  const { isPro } = usePro()
  const decoyMax = limit('decoyChats', isPro)
  const items = useDecoyItems()
  const threads = useDecoyThreads()
  const cs = useChatStyle()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const dark = useIsDark()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)


  const chats: Chat[] = useMemo(
    () =>
      items
        .filter((i) => !i.hidden)
        .slice(0, Number.isFinite(decoyMax) ? decoyMax : undefined) // free plan: one decoy chat
        .map((i) => ({
          id: i.id,
          name: i.name,
          avatar: i.avatar,
          online: false,
          lastSeen: 'last seen recently',
          unread: 0,
          pinned: !!cs.pins[i.id],
          favorite: !!cs.favs[i.id],
          pinColor: cs.pinColors[i.id] ?? DEFAULT_PIN,
          messages: [{ id: `${i.id}-seed`, fromMe: false, text: i.text, time: i.time }, ...(threads[i.id] ?? [])],
        })),
    [items, threads, cs.pins, cs.favs, cs.pinColors, decoyMax],
  )
  const activeChat = chats.find((c) => c.id === activeId) ?? null

  useBackHandler(() => {
    if (upgradeOpen) { setUpgradeOpen(false); return true }
    if (contactsOpen) { setContactsOpen(false); return true }
    if (settingsOpen) { setSettingsOpen(false); return true }
    if (activeId) { setActiveId(null); return true }
    return false
  })

  if (!user) return null

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[rgb(var(--bg-app))] md:p-4">
      <div className="mx-auto flex h-full w-full flex-row-reverse overflow-hidden bg-[rgb(var(--bg-panel))] md:max-w-[1400px] md:rounded-2xl md:shadow-xl md:ring-1 md:ring-[rgb(var(--border))]">
        <div className={`${activeChat ? 'hidden md:flex' : 'flex'} h-full w-full md:w-auto`}>
          <ChatList
            chats={chats}
            activeId={activeId}
            query={query}
            onQuery={setQuery}
            onSelect={setActiveId}
            dark={dark}
            onToggleDark={toggleDark}
            onOpenSettings={() => setSettingsOpen(true)}
            onUpgrade={() => setUpgradeOpen(true)}
            onNewChat={() => (items.filter((i) => !i.hidden).length < decoyMax ? addDecoy() : setUpgradeOpen(true))}
            onOpenContacts={() => setContactsOpen(true)}
            showArchived={false}
            archivedCount={0}
            onToggleArchived={() => {}}
            isPro={isPro}
            onPinChat={(id, v) => setLocalPin(id, v)}
            selfAvatar={DECOY_SELF.avatar}
          />
        </div>
        <Settings decoy open={settingsOpen} onClose={() => setSettingsOpen(false)} dark={dark} onToggleDark={toggleDark} onUpgrade={() => { setSettingsOpen(false); setUpgradeOpen(true) }} />
        {upgradeOpen && <Upgrade onClose={() => setUpgradeOpen(false)} />}
        {contactsOpen && (
          <ContactsPanel
            contacts={[]}
            onClose={() => setContactsOpen(false)}
            onOpenChat={() => setContactsOpen(false)}
            onFavorite={() => {}}
            onBlock={() => {}}
            onRemove={() => {}}
            onImportPhone={async () => ({ ok: false as const, error: 'Nothing to import yet.' })}
            onAddByEmail={async () => ({ ok: false as const, error: 'No Chatter account found with that email.' })}
          />
        )}
        <div className={`${activeChat ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1`}>
          {activeChat ? (
            <ChatWindow
              key={activeChat.id}
              chat={activeChat}
              typing={false}
              onBack={() => setActiveId(null)}
              onSend={(id, text) => sendDecoyMessage(id, text)}
              onUpgrade={() => setUpgradeOpen(true)}
              onPinChat={(v) => setLocalPin(activeChat.id, v)}
              decoy
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[rgb(var(--bg-chat))] p-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow-lg">
                <MessageCircle size={36} />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Welcome to Chatter</h2>
              <p className="max-w-sm text-sm leading-relaxed text-[rgb(var(--text-secondary))]">Pick a conversation from the left to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
