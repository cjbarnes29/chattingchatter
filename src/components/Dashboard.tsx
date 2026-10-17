import { Clock, Pin, Users, BellRing, Sparkles, Activity, ChevronRight } from 'lucide-react'
import type { Chat } from '../data'
import type { Group, Story } from '../social'
import type { CalEvent } from '../calendar'
import { fmtWhen } from '../calendar'
import { ALL_WIDGETS, type WidgetId } from '../interfacePrefs'

/** Optional home dashboard built from data the user can already see in the app.
 *  Widgets show names, counts and times only. Message text is never shown here, so a glance at
 *  the screen (or a locked private message) doesn't give anything away. */

type Props = {
  widgets: WidgetId[]
  chats: Chat[]
  groups: Group[]
  events: CalEvent[]
  stories: Story[]
  myId: string
  peerName: (peerId: string) => string
  onOpenChat: (chatId: string) => void
  onOpenStory: (s: Story) => void
  onOpenEvent: (e: CalEvent) => void
  /** chat id prefix for groups, so a group row can open its chat */
  groupChatId: (groupId: string) => string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const ICON: Record<WidgetId, React.ReactNode> = {
  recent: <Clock size={15} />,
  pinned: <Pin size={15} />,
  groups: <Users size={15} />,
  reminders: <BellRing size={15} />,
  stories: <Sparkles size={15} />,
  activity: <Activity size={15} />,
}

function Card({ id, children, empty }: { id: WidgetId; children: React.ReactNode; empty?: string }) {
  const meta = ALL_WIDGETS.find((w) => w.id === id)!
  return (
    <section className="rounded-2xl bg-[rgb(var(--bg-panel))] p-4 ring-1 ring-[rgb(var(--border))]" aria-label={meta.label}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]">{ICON[id]}</span>
        {meta.label}
      </h3>
      {empty ? <p className="py-2 text-xs text-[rgb(var(--text-secondary))]">{empty}</p> : children}
    </section>
  )
}

function ChatRow({ chat, onOpen, right }: { chat: Chat; onOpen: () => void; right?: React.ReactNode }) {
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-[rgb(var(--bg-panel-soft))]">
        <img src={chat.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{chat.name}</span>
        {right}
        <ChevronRight size={14} className="shrink-0 text-[rgb(var(--text-tertiary))]" />
      </button>
    </li>
  )
}

export default function Dashboard({ widgets, chats, groups, events, stories, myId, peerName, onOpenChat, onOpenStory, onOpenEvent, groupChatId }: Props) {
  const now = Date.now()
  const upcoming = events
    .filter((e) => new Date(e.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 4)
  const authors = new Map<string, Story>()
  stories.forEach((s) => {
    if (s.authorId !== myId && !authors.has(s.authorId)) authors.set(s.authorId, s)
  })
  const unreadChats = chats.filter((c) => c.unread > 0)
  const unreadTotal = unreadChats.reduce((n, c) => n + c.unread, 0)

  const widget = (id: WidgetId) => {
    switch (id) {
      case 'recent': {
        const list = chats.filter((c) => c.messages.length > 0).slice(0, 5)
        return (
          <Card key={id} id={id} empty={list.length ? undefined : 'No conversations yet.'}>
            <ul>{list.map((c) => <ChatRow key={c.id} chat={c} onOpen={() => onOpenChat(c.id)} right={<span className="shrink-0 text-xs text-[rgb(var(--text-tertiary))]">{c.messages[c.messages.length - 1]?.time}</span>} />)}</ul>
          </Card>
        )
      }
      case 'pinned': {
        const list = chats.filter((c) => c.pinned)
        return (
          <Card key={id} id={id} empty={list.length ? undefined : 'Pin a chat from its palette menu to keep it here.'}>
            <ul>{list.map((c) => <ChatRow key={c.id} chat={c} onOpen={() => onOpenChat(c.id)} />)}</ul>
          </Card>
        )
      }
      case 'groups':
        return (
          <Card key={id} id={id} empty={groups.length ? undefined : 'You’re not in any groups yet.'}>
            <ul>
              {groups.slice(0, 5).map((g) => (
                <li key={g.id}>
                  <button onClick={() => onOpenChat(groupChatId(g.id))} className="flex w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-[rgb(var(--bg-panel-soft))]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: g.color }}>{g.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.name}</span>
                    <span className="shrink-0 text-xs text-[rgb(var(--text-tertiary))]">{g.members.length} members</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      case 'reminders':
        return (
          <Card key={id} id={id} empty={upcoming.length ? undefined : 'No upcoming reminders. Add one from a chat’s calendar.'}>
            <ul className="space-y-1">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <button onClick={() => onOpenEvent(e)} className="w-full rounded-xl px-1.5 py-1.5 text-left transition hover:bg-[rgb(var(--bg-panel-soft))]">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-[rgb(var(--text-secondary))]">
                      {fmtWhen(e.starts_at)} · with {peerName(e.creator_id === myId ? e.peer_id : e.creator_id)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      case 'stories':
        return (
          <Card key={id} id={id} empty={authors.size ? undefined : 'No new stories from friends.'}>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {[...authors.values()].map((s) => (
                <button key={s.authorId} onClick={() => onOpenStory(s)} className="flex w-14 shrink-0 flex-col items-center gap-1" title={s.authorName}>
                  <span className="rounded-full bg-gradient-to-br from-[rgb(var(--accent))] to-amber-400 p-[2px]">
                    <img src={s.authorAvatar} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[rgb(var(--bg-panel))]" />
                  </span>
                  <span className="w-full truncate text-center text-[11px]">{s.authorName.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </Card>
        )
      case 'activity':
        return (
          <Card key={id} id={id}>
            <p className="text-sm">
              {unreadTotal > 0 ? (
                <>
                  <span className="font-bold text-[rgb(var(--accent))]">{unreadTotal}</span> new {unreadTotal === 1 ? 'message' : 'messages'} in {unreadChats.length} {unreadChats.length === 1 ? 'chat' : 'chats'}
                </>
              ) : (
                'You’re all caught up.'
              )}
            </p>
            <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">
              {plural(chats.length, 'conversation')} · {plural(groups.length, 'group')} · {plural(upcoming.length, 'upcoming reminder')}
            </p>
          </Card>
        )
    }
  }

  if (!widgets.length) return <p className="p-6 text-center text-sm text-[rgb(var(--text-secondary))]">Your dashboard is empty. Choose widgets in Settings → Interface.</p>
  return <div className="grid gap-3 lg:grid-cols-2">{widgets.map(widget)}</div>
}
