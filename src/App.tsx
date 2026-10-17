import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Bell } from 'lucide-react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import { NotificationPanel } from './components/Innovations'
import AuthScreen from './components/AuthScreen'
import ResetPassword from './components/ResetPassword'
import Settings from './components/Settings'
import { AuthProvider, useAuth } from './auth'
import { ProProvider, usePro } from './pro'
import { inFocusWindow } from './focusWindow'
import { PinGate } from './components/PinGate'
import DecoyApp from './components/DecoyApp'
import ExitDialog from './components/ExitDialog'
import GroupCallOverlay from './components/GroupCallOverlay'
import { useBackTrap, useBackHandler, exitApp } from './backNav'
import { bioUnlockEnabled, biometricEnrolled } from './biometric'
import { useGroupCall } from './groupCall'
import { useTyping } from './typing'
import { readGesturePrefs, readNotifPrefs } from './prefs'
import Upgrade from './components/Upgrade'
import Terms from './components/Terms'
import { type Chat } from './data'
import { useRealChats, REAL_PREFIX } from './realChats'
import NewChat from './components/NewChat'
import { useGroups, useStories, useCall, GROUP_PREFIX, type Story, type Group } from './social'
import { CreateGroupModal, GroupSettingsModal } from './components/GroupPanels'
import { StoriesRow, StoryComposer, StoryViewer } from './components/Stories'
import CallOverlay from './components/CallOverlay'
import { useContacts, findRegisteredByEmails, pickPhoneContacts } from './contacts'
import ContactsPanel from './components/ContactsPanel'
import { Archive, BellRing, X, ShieldAlert } from 'lucide-react'
import { useEvents, fmtWhen, remindLabel } from './calendar'
import { useChatStyle, setLocalPin, playSound, DEFAULT_PIN } from './chatStyle'
import { useIsDark, toggleDark, startInterfaceSync, useInterface } from './interface'
import Dashboard from './components/Dashboard'
import { onLockRequest, onDecoyRequest, onUnlockedMark, forgetOpenedChats } from './appLock'
import { setDecoyOwner } from './decoyStore'

export default function Root() {
  return (
    <AuthProvider>
      <ProProvider>
        <Gate />
      </ProProvider>
    </AuthProvider>
  )
}

function Gate() {
  const { user, recovering } = useAuth()
  const { hasPins, isPro, autoLock, takeIntrusions } = usePro()
  const bioUnlock = isPro && bioUnlockEnabled() && biometricEnrolled()
  const [unlocked, setUnlockedState] = useState<'none' | 'real' | 'decoy'>('none')
  const [intrusions, setIntrusions] = useState<number[]>([])
  const [exitOpen, setExitOpen] = useState(false)
  useBackTrap(() => setExitOpen(true))
  const setUnlocked = useCallback((v: 'none' | 'real' | 'decoy') => {
    if (v === 'none') forgetOpenedChats()
    setUnlockedState(v)
  }, [])
  // decoy chats are kept per account
  useEffect(() => setDecoyOwner(user?.id ?? null), [user?.id])
  const unlockReal = () => {
    setIntrusions(takeIntrusions())
    setUnlocked('real')
  }

  // Lock when the app goes to the background: straight away, or after the chosen auto-lock time
  useEffect(() => {
    let hiddenAt = 0
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        if (autoLock === 0) setUnlocked('none')
        forgetOpenedChats()
      } else if (hiddenAt && Date.now() - hiddenAt >= autoLock * 1000) {
        setUnlocked('none')
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [autoLock, setUnlocked])

  // "Lock now" from the inbox shortcut or anywhere else
  useEffect(() => onLockRequest(() => setUnlocked('none')), [setUnlocked])
  // a decoy PIN typed outside the lock screen (e.g. to confirm a log out) goes to the decoy profile
  useEffect(() => onDecoyRequest(() => setUnlocked('decoy')), [setUnlocked])
  useEffect(() => onUnlockedMark(() => setUnlocked('real')), [setUnlocked])

  // Signing out always ends the unlocked state, so the next sign-in (maybe someone else) starts locked or fresh.
  // A fresh sign-in with the password counts as unlocked; only app restarts and locks ask for the PIN.
  const wasSignedOut = useRef(!user)
  useEffect(() => {
    if (!user) {
      wasSignedOut.current = true
      setUnlocked('none')
    } else if (wasSignedOut.current) {
      wasSignedOut.current = false
      setUnlocked('real')
    }
  }, [user, setUnlocked])

  // Shake the phone to lock (needs a PIN and the "Shake to lock" gesture turned on)
  useEffect(() => {
    if (!hasPins) return
    let last = 0
    let hits = 0
    const onMotion = (e: DeviceMotionEvent) => {
      if (!readGesturePrefs().shakeLock) return
      const a = e.accelerationIncludingGravity
      if (!a) return
      const g = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2)
      const now = Date.now()
      if (Math.abs(g - 9.8) > 14) {
        hits = now - last < 700 ? hits + 1 : 1
        last = now
        if (hits >= 3) { hits = 0; setUnlocked('none') }
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [hasPins, setUnlocked])

  let body: React.ReactNode
  const onTermsPage = window.location.pathname.replace(/\/+$/, '') === '/terms'
  if (onTermsPage) body = <Terms onBack={() => { window.location.href = '/' }} />
  else if (recovering) body = <ResetPassword />
  else if (!user) body = <AuthScreen />
  // The lock is enforced whenever a PIN exists, even if the Pro plan has lapsed
  else if (hasPins && unlocked === 'none') body = <PinGate onUnlock={unlockReal} onDecoy={() => setUnlocked('decoy')} bioUnlock={bioUnlock} />
  else if (unlocked === 'decoy' && hasPins) body = <DecoyApp />
  else body = <App />

  return (
    <>
      {body}
      {unlocked === 'real' && intrusions.length > 0 && (
        <div role="alert" className="fixed inset-x-3 top-3 z-[80] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-[rgb(var(--bg-panel))] p-4 shadow-2xl ring-2 ring-rose-500">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">{intrusions.length} wrong PIN{intrusions.length === 1 ? ' was' : 's were'} tried</p>
            <p className="text-xs text-[rgb(var(--text-secondary))]">Since you last unlocked. Most recent: {new Date(intrusions[intrusions.length - 1]).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.</p>
          </div>
          <button onClick={() => setIntrusions([])} aria-label="Dismiss" className="rounded-full p-1 hover:bg-[rgb(var(--accent-soft))]"><X size={14} /></button>
        </div>
      )}
      {exitOpen && <ExitDialog onStay={() => setExitOpen(false)} onExit={() => void exitApp()} />}
    </>
  )
}

function App() {
  const { user } = useAuth()
  // bring this account's interface choices to this device (and save local ones if they're newer)
  useEffect(() => {
    void startInterfaceSync(user?.id ?? null)
  }, [user?.id])
  const real = useRealChats(user!.id)
  const cs = useChatStyle()
  const groupApi = useGroups(user!.id)
  const storyApi = useStories(user!.id)
  const call = useCall(user!.id)
  const gcall = useGroupCall(user!.id, user!.name, groupApi.groups)
  const evApi = useEvents(user!.id, (peerId, text) => real.send(REAL_PREFIX + peerId, text))
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [groupSettingsId, setGroupSettingsId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewStory, setViewStory] = useState<Story | null>(null)

  // Group chats appear alongside direct chats, shaped as Chat objects for the list
  const groupChats: Chat[] = groupApi.groups.map((g: Group) => {
    const msgs = (groupApi.groupMessages[g.id] ?? []).map((m) => {
      const sender = g.members.find((x) => x.id === m.senderId)
      return {
        id: m.id,
        fromMe: m.senderId === user!.id,
        text: m.senderId === user!.id ? m.body : `${sender?.name?.split(' ')[0] ?? 'Member'}: ${m.body}`,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        status: undefined,
        poll: groupApi.polls[m.id],
      }
    })
    return {
      id: GROUP_PREFIX + g.id,
      name: g.name,
      avatar: `https://ui-avatars.com/api/?background=${g.color.slice(1)}&color=fff&bold=true&name=${encodeURIComponent(g.name)}`,
      online: false,
      lastSeen: `${g.members.length} members`,
      unread: 0,
      isGroup: true,
      pinned: !!cs.pins[GROUP_PREFIX + g.id],
      messages: msgs,
    } as Chat
  })
  const contactApi = useContacts(user!.id)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Direct chats: hide blocked people, apply archive/pin/delete-history prefs from the contacts store
  const directChats: Chat[] = real.chats
    .filter((c) => !contactApi.blockedIds.has(c.id.slice(REAL_PREFIX.length)))
    .map((c) => {
      const pref = contactApi.prefs[c.id.slice(REAL_PREFIX.length)]
      return { ...c, pinned: !!pref?.pinned, archived: !!pref?.archived } as Chat & { archived: boolean }
    })

  const isArchived = (c: Chat) => !!(c as Chat & { archived?: boolean }).archived
  const archivedCount = directChats.filter(isArchived).length
  const visibleDirect = showArchived ? directChats.filter(isArchived) : directChats.filter((c) => !isArchived(c))

  const chats: Chat[] = [...visibleDirect, ...(showArchived ? [] : groupChats)].map((c) => {
    const peer = c.id.startsWith(REAL_PREFIX) ? c.id.slice(REAL_PREFIX.length) : null
    const favContact = peer ? contactApi.contacts.some((x) => x.id === peer && x.favorite) : false
    return { ...c, favorite: favContact || !!cs.favs[c.id], pinColor: cs.pinColors[c.id] ?? DEFAULT_PIN }
  })

  // Play the chosen sound when a new incoming message arrives
  const seen = useRef<Record<string, string>>({})
  useEffect(() => {
    const first = Object.keys(seen.current).length === 0
    for (const c of [...directChats, ...groupChats]) {
      const last = c.messages[c.messages.length - 1]
      if (!last) continue
      if (!first && seen.current[c.id] !== undefined && seen.current[c.id] !== last.id && !last.fromMe && !c.muted) {
        playSound(c.id)
        // confidential chats never show their text outside the chat
        if (c.id !== activeId && readNotifPrefs().quickReply) setNotice({ chatId: c.id, text: readNotifPrefs().previews && !lockedChatIds.includes(c.id) ? last.text : 'New message' })
      }
      seen.current[c.id] = last.id
    }
  })
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const dark = useIsDark()
  const ui = useInterface()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { isPro, focus, lockedChatIds } = usePro()
  const inFocus = isPro && inFocusWindow(focus)
  const [notice, setNotice] = useState<{ chatId: string; text: string } | null>(null)
  // favourites can still get through during focus, if the user allows it
  const noticeBypassesFocus = !!notice && focus.allowFavorites && !!chats.find((c) => c.id === notice.chatId)?.favorite

  // Focus scheduling: while active, the notification is bundled instead of interrupting
  const [bundled, setBundled] = useState(0)
  useEffect(() => {
    if (inFocus && notice && !noticeBypassesFocus) {
      setBundled((b) => b + 1)
      setNotice(null)
    }
  }, [inFocus, notice, noticeBypassesFocus])


  const typingPeer = activeId && activeId.startsWith(REAL_PREFIX) ? activeId.slice(REAL_PREFIX.length) : null
  const typingApi = useTyping(user!.id, typingPeer)

  const activeChat = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId])

  const openChat = (id: string) => {
    setActiveId(id)
    real.setOpenPeer(id.startsWith(REAL_PREFIX) ? id.slice(REAL_PREFIX.length) : null)
  }

  const closeChat = () => {
    setActiveId(null)
    real.setOpenPeer(null)
  }

  const pinAny = (id: string, v: boolean) => {
    if (id.startsWith(REAL_PREFIX)) contactApi.updatePref(id.slice(REAL_PREFIX.length), { pinned: v })
    else setLocalPin(id, v)
  }

  const sendMessage = (chatId: string, text: string) => {
    if (chatId.startsWith(REAL_PREFIX)) real.send(chatId, text)
    if (chatId.startsWith(GROUP_PREFIX)) groupApi.sendGroupMessage(chatId.slice(GROUP_PREFIX.length), text)
  }

  // call buttons: only direct chats can call a single person
  const peerOf = (id: string | null) => (id && id.startsWith(REAL_PREFIX) ? id.slice(REAL_PREFIX.length) : null)
  const placeCall = (media: 'voice' | 'video') => {
    const peer = peerOf(activeId)
    if (!peer) return
    call.startCall(peer, media)
  }
  const placeGroupCall = (media: 'voice' | 'video') => {
    if (!activeId?.startsWith(GROUP_PREFIX)) return
    const gid = activeId.slice(GROUP_PREFIX.length)
    void gcall.start(gid, media)
    groupApi.sendGroupMessage(gid, media === 'video' ? 'Started a group video call. Open this chat to join.' : 'Started a group voice call. Open this chat to join.')
  }
  const activePeerId = peerOf(activeId)
  const activeChatActions =
    activePeerId && activeChat
      ? {
          pinned: !!activeChat.pinned,
          archived: isArchived(activeChat),
          blocked: contactApi.blockedIds.has(activePeerId),
          onPin: (v: boolean) => contactApi.updatePref(activePeerId, { pinned: v }),
          onArchive: async (v: boolean) => {
            await contactApi.updatePref(activePeerId, { archived: v })
            closeChat()
          },
          onDelete: () => contactApi.updatePref(activePeerId, { deleted_before: new Date().toISOString() }),
          onBlock: async (v: boolean) => {
            await contactApi.setBlocked(activePeerId, v)
            if (v) closeChat()
          },
        }
      : undefined

  // Optional home dashboard (Settings → Interface). Built only from data already on screen elsewhere.
  const dashboard = ui.dashboard.enabled ? (
    <Dashboard
      widgets={ui.dashboard.widgets}
      chats={chats}
      groups={groupApi.groups}
      events={evApi.events}
      stories={storyApi.stories}
      myId={user!.id}
      peerName={(peerId) => chats.find((c) => c.id === REAL_PREFIX + peerId)?.name.split(' ')[0] ?? 'a friend'}
      onOpenChat={openChat}
      onOpenStory={(s) => setViewStory(s)}
      onOpenEvent={(e) => openChat(REAL_PREFIX + (e.creator_id === user!.id ? e.peer_id : e.creator_id))}
      groupChatId={(gid) => GROUP_PREFIX + gid}
    />
  ) : null

  const calendarProps =
    activePeerId && activeChat
      ? {
          myId: user!.id,
          events: evApi.events.filter((e) => e.creator_id === activePeerId || e.peer_id === activePeerId),
          onDelete: evApi.remove,
          onAdd: async (title: string, note: string, when: Date, remind: number) => {
            const res = await evApi.add(activePeerId, title, note, when, remind)
            if (!res.ok) return res
            real.send(
              REAL_PREFIX + activePeerId,
              `📅 New event: ${title} — ${fmtWhen(res.event.starts_at)}${note ? ` (${note})` : ''}. Alarm ${remindLabel(remind)}.`,
            )
            return { ok: true }
          },
        }
      : undefined

  const addContactByEmail = async (email: string) => {
    const res = await real.startChat(email)
    if (!res.ok) return res
    const peerId = res.chatId.slice(REAL_PREFIX.length)
    await contactApi.addContact(peerId)
    return { ok: true as const, peerId }
  }

  const importPhoneContacts = async () => {
    const emails = await pickPhoneContacts()
    if (emails === 'unsupported') return { ok: false as const, error: 'Importing from your phone works in Chrome on Android. You can still add friends by email.' }
    if (emails === 'cancelled') return { ok: false as const, error: 'Import cancelled.' }
    const found = await findRegisteredByEmails(emails)
    for (const f of found) await contactApi.addContact(f.id)
    return { ok: true as const, added: found.length }
  }

  const callPeer = real.chats.find((c) => call.peerId !== null && c.id === REAL_PREFIX + call.peerId)
  const callPeerName = callPeer?.name ?? 'Contact'
  const callPeerAvatar = callPeer?.avatar ?? user!.avatar
  const callPeerFromIncoming = call.incoming ? real.chats.find((c) => c.id === REAL_PREFIX + call.incoming!.from) : null
  const activeGroup = activeId?.startsWith(GROUP_PREFIX) ? groupApi.groups.find((g) => g.id === activeId.slice(GROUP_PREFIX.length)) ?? null : null
  const settingsGroup = groupSettingsId ? groupApi.groups.find((g) => g.id === groupSettingsId) ?? null : null

  // Back button: close the top-most sheet first, then leave the chat, and only then offer to exit
  useBackHandler(() => {
    if (gcall.active) return true
    if (viewStory) { setViewStory(null); return true }
    if (composerOpen) { setComposerOpen(false); return true }
    if (groupSettingsId) { setGroupSettingsId(null); return true }
    if (createGroupOpen) { setCreateGroupOpen(false); return true }
    if (newChatOpen) { setNewChatOpen(false); return true }
    if (contactsOpen) { setContactsOpen(false); return true }
    if (upgradeOpen) { setUpgradeOpen(false); return true }
    if (settingsOpen) { setSettingsOpen(false); return true }
    if (activeId) { closeChat(); return true }
    if (showArchived) { setShowArchived(false); return true }
    return false
  })

  const dismissNotice = useCallback(() => setNotice(null), [])
  const noticeChat = notice ? chats.find((c) => c.id === notice.chatId) : null

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[rgb(var(--bg-app))] md:p-4">
      {inFocus && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-[rgb(var(--bg-panel))] px-4 py-2 text-xs font-semibold shadow-lg ring-1 ring-[rgb(var(--accent))]">
          Focus mode on{bundled ? ` · ${bundled} notification${bundled > 1 ? 's' : ''} bundled` : ''}
        </div>
      )}
      {evApi.alarms.length > 0 && (
        <div className="fixed right-3 top-3 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2" role="alert" aria-live="assertive">
          {evApi.alarms.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-2xl bg-[rgb(var(--bg-panel))] p-3.5 shadow-2xl ring-2 ring-[rgb(var(--accent))]">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"><BellRing size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{a.title}</p>
                <p className="text-xs text-[rgb(var(--text-secondary))]">{a.body}</p>
                <button onClick={() => { openChat(REAL_PREFIX + a.peerId); evApi.dismissAlarm(a.id) }} className="mt-1.5 text-xs font-semibold text-[rgb(var(--accent))] hover:underline">Open chat</button>
              </div>
              <button onClick={() => evApi.dismissAlarm(a.id)} aria-label="Dismiss alarm" className="rounded-full p-1 hover:bg-[rgb(var(--accent-soft))]"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {notice && noticeChat && (!inFocus || noticeBypassesFocus) && (
        <NotificationPanel
          name={noticeChat.name}
          avatar={noticeChat.avatar}
          preview={notice.text}
          onClose={dismissNotice}
          onReply={(t) => sendMessage(noticeChat.id, t)}
        />
      )}
      <div className="mx-auto flex h-full w-full flex-row-reverse overflow-hidden bg-[rgb(var(--bg-panel))] md:max-w-[1400px] md:rounded-2xl md:shadow-xl md:ring-1 md:ring-[rgb(var(--border))]">
        <div className={`${activeChat ? 'hidden md:flex' : 'flex'} h-full w-full md:w-auto`}>
          <ChatList
            chats={chats}
            activeId={activeId}
            query={query}
            onQuery={setQuery}
            onSelect={openChat}
            dark={dark}
            onToggleDark={toggleDark}
            onOpenSettings={() => setSettingsOpen(true)}
            onUpgrade={() => setUpgradeOpen(true)}
            onNewChat={() => setNewChatOpen(true)}
            onOpenContacts={() => setContactsOpen(true)}
            showArchived={showArchived}
            archivedCount={archivedCount}
            onToggleArchived={() => setShowArchived((s) => !s)}
            isPro={isPro}
            onNewGroup={() => setCreateGroupOpen(true)}
            onPinChat={(id, v) => pinAny(id, v)}
            onArchiveChat={(id, v) => { if (id.startsWith(REAL_PREFIX)) contactApi.updatePref(id.slice(REAL_PREFIX.length), { archived: v }) }}
            dashboard={dashboard ?? undefined}
            stories={
              <StoriesRow
                stories={storyApi.stories}
                myAvatar={user!.avatar}
                onOpen={(s) => setViewStory(s)}
                onCreate={() => setComposerOpen(true)}
              />
            }
          />
        </div>
        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} dark={dark} onToggleDark={toggleDark} onUpgrade={() => { setSettingsOpen(false); setUpgradeOpen(true) }} />
        {upgradeOpen && <Upgrade onClose={() => setUpgradeOpen(false)} />}
        {contactsOpen && (
          <ContactsPanel
            contacts={contactApi.contacts}
            onClose={() => setContactsOpen(false)}
            onOpenChat={(peerId) => {
              setContactsOpen(false)
              openChat(REAL_PREFIX + peerId)
            }}
            onFavorite={(id, fav) => contactApi.setFavorite(id, fav)}
            onBlock={(id, b) => contactApi.setBlocked(id, b)}
            onRemove={(id) => contactApi.removeContact(id)}
            onImportPhone={importPhoneContacts}
            onAddByEmail={addContactByEmail}
          />
        )}
        {newChatOpen && (
          <NewChat
            onClose={() => setNewChatOpen(false)}
            onStart={real.startChat}
            onOpen={openChat}
            onNewGroup={() => {
              setNewChatOpen(false)
              setCreateGroupOpen(true)
            }}
          />
        )}
        {createGroupOpen && (
          <CreateGroupModal
            onClose={() => setCreateGroupOpen(false)}
            onCreate={async (name, color, emails) => {
              const res = await groupApi.createGroup(name, color, emails)
              if (res.ok) openChat(GROUP_PREFIX + res.groupId)
              return res.ok ? { ok: true, groupId: res.groupId } : { ok: false, error: res.error }
            }}
          />
        )}
        {composerOpen && (
          <StoryComposer
            onClose={() => setComposerOpen(false)}
            onPost={(body, days) => storyApi.postStory(body, days)}
          />
        )}
        {viewStory && (
          <StoryViewer
            story={storyApi.stories.find((s) => s.id === viewStory.id) ?? viewStory}
            myId={user!.id}
            onClose={() => setViewStory(null)}
            onReact={(e) => storyApi.react(viewStory.id, e, viewStory.myReaction)}
            onEdit={(body) => storyApi.editStory(viewStory.id, body)}
            onDelete={async () => {
              await storyApi.deleteStory(viewStory.id)
              setViewStory(null)
            }}
          />
        )}
        {settingsGroup && (
          <GroupSettingsModal
            group={settingsGroup}
            myId={user!.id}
            onClose={() => setGroupSettingsId(null)}
            onRename={(name, color) => groupApi.renameGroup(settingsGroup.id, name, color)}
            onDelete={async () => {
              await groupApi.deleteGroup(settingsGroup.id)
              setGroupSettingsId(null)
              closeChat()
            }}
            onLeave={async () => {
              await groupApi.leaveGroup(settingsGroup.id)
              setGroupSettingsId(null)
              closeChat()
            }}
            onAdd={(emails) => groupApi.addMembers(settingsGroup.id, emails)}
            onRemove={(uid) => groupApi.removeMember(settingsGroup.id, uid)}
            onRole={(uid, role) => groupApi.setRole(settingsGroup.id, uid, role)}
          />
        )}
        <GroupCallOverlay
          active={gcall.active}
          invite={gcall.invite}
          group={gcall.active ? groupApi.groups.find((g) => g.id === gcall.active!.groupId) ?? null : null}
          myId={user!.id}
          streams={gcall.streams}
          local={gcall.local}
          muted={gcall.muted}
          camOff={gcall.camOff}
          error={gcall.error}
          onAccept={() => void gcall.acceptInvite()}
          onDecline={gcall.decline}
          onLeave={gcall.leave}
          onToggleMute={gcall.toggleMute}
          onToggleCam={gcall.toggleCam}
        />
        <CallOverlay
          state={call.state}
          media={call.media}
          peerName={callPeerFromIncoming?.name ?? callPeerName}
          peerAvatar={callPeerFromIncoming?.avatar ?? callPeerAvatar}
          localStream={call.localStream}
          remoteStream={call.remoteStream}
          muted={call.muted}
          camOff={call.camOff}
          error={call.error}
          incoming={!!call.incoming}
          onAccept={call.acceptCall}
          onDecline={call.declineCall}
          onEnd={call.endCall}
          onToggleMute={call.toggleMute}
          onToggleCam={call.toggleCam}
          onDismissError={call.dismissError}
        />

        <div className={`${activeChat ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1`}>
          {activeChat ? (
            <ChatWindow
              key={activeChat.id}
              chat={activeChat}
              typing={typingApi.typing}
              onTyping={typingApi.notify}
              onBack={closeChat}
              onSend={sendMessage}
              onUpgrade={() => setUpgradeOpen(true)}
              onCall={activeChat.id.startsWith(REAL_PREFIX) ? placeCall : activeChat.id.startsWith(GROUP_PREFIX) ? placeGroupCall : undefined}
              onOpenGroup={activeGroup ? () => setGroupSettingsId(activeGroup.id) : undefined}
              polls={
                activeGroup
                  ? {
                      myId: user!.id,
                      members: activeGroup.members,
                      isAdmin: activeGroup.members.some((m) => m.id === user!.id && m.role === 'admin'),
                      onCreate: (q, opts, multi) => groupApi.createPoll(activeGroup.id, q, opts, multi),
                      onVote: groupApi.votePoll,
                      onClose: groupApi.closePoll,
                    }
                  : undefined
              }
              onPinChat={(v) => pinAny(activeChat.id, v)}
              chatActions={activeChatActions}
              allowLock
              calendar={calendarProps}
            />
          ) : dashboard ? (
            <div className="flex-1 overflow-y-auto bg-[rgb(var(--bg-chat))] p-6 lg:p-8">
              <h2 className="mb-4 text-2xl font-extrabold tracking-tight">Home</h2>
              {dashboard}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[rgb(var(--bg-chat))] p-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow-lg">
                <MessageCircle size={36} />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Welcome to Chatter</h2>
              <p className="max-w-sm text-sm leading-relaxed text-[rgb(var(--text-secondary))]">
                Send and receive messages with friends, family and your team. Pick a conversation from the left to get started.
              </p>
              <p className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-tertiary))]"><Bell size={12} /> Incoming messages can be answered right from the notification.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
