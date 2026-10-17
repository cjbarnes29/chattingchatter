import type { Poll } from './social'

export type Message = {
  id: string
  fromMe: boolean
  text: string
  time: string
  status?: 'sent' | 'delivered' | 'read'
  private?: boolean
  tags?: ('work' | 'plans' | 'ideas' | 'memories')[]
  viewing?: boolean
  day?: number
  poll?: Poll
  /** "Today", "Yesterday", a weekday or a date; when set, the chat shows a date divider where it changes */
  dateLabel?: string
  /** sender's rules for this message (Message Control Center), read from the message body */
  meta?: import('./messageMeta').MsgMeta | null
}

export type Chat = {
  id: string
  name: string
  avatar: string
  online: boolean
  lastSeen?: string
  pinned?: boolean
  pinColor?: string
  favorite?: boolean
  isGroup?: boolean
  muted?: boolean
  unread: number
  mood?: 'playful' | 'calm' | 'excited'
  profile?: { nickname?: string; age?: number | null; status?: string; about?: string }
  messages: Message[]
}

export const ME = {
  name: 'You',
  avatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=200&q=80',
}

export const initialChats: Chat[] = []

export const nowTime = () => {
  const d = new Date()
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
