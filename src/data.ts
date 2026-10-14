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
  messages: Message[]
}

export const ME = {
  name: 'You',
  avatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=200&q=80',
}

export const initialChats: Chat[] = [
  {
    id: 'c1',
    name: 'Amara Okafor',
    avatar: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&w=200&q=80',
    online: true,
    pinned: true,
    unread: 2,
    messages: [
      { id: 'm1', fromMe: false, text: 'Are we still on for the design review at 3?', time: '10:12' },
      { id: 'm2', fromMe: true, text: 'Yes! I just finished the new onboarding flow.', time: '10:14', status: 'read' },
      { id: 'm3', fromMe: false, text: 'Amazing. Can you share the Figma link?', time: '10:15' },
      { id: 'm4', fromMe: false, text: 'Also loved the color direction 🙌', time: '10:15', tags: ['work'], day: 0 },
      { id: 'm5', fromMe: true, text: 'Board pitch 🌅+☕+📖', time: '10:20', status: 'read', day: 2, tags: ['ideas'] },
      { id: 'm6', fromMe: false, text: 'Dinner plans for Friday?', time: '10:25', private: true, day: 4, tags: ['plans'] },
    ],
    mood: 'excited',
  },
  {
    id: 'c2',
    name: 'Team Launchpad',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=200&q=80',
    online: false,
    lastSeen: 'group',
    unread: 5,
    messages: [
      { id: 'm1', fromMe: false, text: 'Priya: Release notes are drafted ✅', time: '09:40' },
      { id: 'm2', fromMe: false, text: 'Marco: Can someone check the staging build?', time: '09:52' },
      { id: 'm3', fromMe: true, text: 'On it, give me 10 minutes.', time: '09:53', status: 'delivered' },
    ],
    mood: 'playful',
  },
  {
    id: 'c3',
    name: 'Jonas Lindqvist',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    online: true,
    unread: 0,
    messages: [
      { id: 'm1', fromMe: true, text: 'Coffee tomorrow morning?', time: 'Yesterday', status: 'read' },
      { id: 'm2', fromMe: false, text: 'Perfect, the place near the station?', time: 'Yesterday' },
      { id: 'm3', fromMe: true, text: 'Sounds good 👍', time: 'Yesterday', status: 'read' },
    ],
  },
  {
    id: 'c4',
    name: 'Mom',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    online: false,
    lastSeen: 'last seen today at 08:30',
    unread: 1,
    muted: true,
    messages: [
      { id: 'm1', fromMe: false, text: 'Dinner on Sunday? Dad is making his famous stew.', time: '08:30', private: true, tags: ['memories'], day: 1 },
    ],
    mood: 'calm',
  },
  {
    id: 'c5',
    name: 'Sofia Ricci',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    online: false,
    lastSeen: 'last seen yesterday at 22:14',
    unread: 0,
    messages: [
      { id: 'm1', fromMe: false, text: 'Sent you the photos from Lisbon 📷', time: 'Mon' },
      { id: 'm2', fromMe: true, text: 'These are gorgeous! Thank you ❤️', time: 'Mon', status: 'read' },
    ],
  },
  {
    id: 'c6',
    name: 'Kenji Watanabe',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    online: true,
    unread: 0,
    messages: [
      { id: 'm1', fromMe: false, text: 'Did you see the new build on TestFlight?', time: 'Sun' },
    ],
  },
]

export const nowTime = () => {
  const d = new Date()
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
