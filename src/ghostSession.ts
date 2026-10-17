/** Waiting / connection rules for a live Ghost Canvas. Pure functions, no React or network, so the
 *  rules can be tested on their own.
 *
 *  Two different clocks matter and are kept apart:
 *  - the CONNECTION timeout (CONNECT_TIMEOUT): the live channel never came up. This shows a failure
 *    with Retry. It never closes the canvas.
 *  - the WAIT notice (NOTICE_AFTER): the other person hasn't joined yet. This shows the waiting card.
 *    It never closes the canvas either; only the user (Exit), Escape, or leaving the screen with
 *    content on it (the "Close when I leave" privacy setting) does. */

export type Link = 'connecting' | 'online' | 'failed'
/** waiting = not seen yet this session · present = here now · away = was here, then disconnected */
export type Peer = 'waiting' | 'present' | 'away'

export type Session = {
  link: Link
  peer: Peer
  /** when the current wait started (canvas opened, or the other person dropped) */
  since: number
  invitedAt: number | null
  /** user chose "Keep Waiting": the card folds into a small status pill */
  collapsed: boolean
}

export type Event =
  | { type: 'linkUp' }
  | { type: 'linkDown' }
  | { type: 'retry' }
  | { type: 'peerJoined' }
  | { type: 'peerLeft'; at: number }
  | { type: 'invited'; at: number }
  | { type: 'keepWaiting' }
  | { type: 'reopen' }

export const NOTICE_AFTER = 10 // seconds of waiting before the card with choices appears
export const CONNECT_TIMEOUT = 15 // seconds for the live channel to come up before we say so
export const INVITE_COOLDOWN = 30 // seconds between invitations, so it can't be spammed
export const PEER_LEFT_DELAY = 2500 // ms the other person must stay gone before we say they left

export const initialSession = (now: number): Session => ({ link: 'connecting', peer: 'waiting', since: now, invitedAt: null, collapsed: false })

export function reduce(s: Session, e: Event): Session {
  switch (e.type) {
    case 'linkUp':
      return s.link === 'online' ? s : { ...s, link: 'online' }
    case 'linkDown':
      return s.link === 'failed' ? s : { ...s, link: 'failed' }
    case 'retry':
      return s.link === 'connecting' ? s : { ...s, link: 'connecting' }
    case 'peerJoined':
      return s.peer === 'present' ? s : { ...s, peer: 'present', collapsed: false }
    case 'peerLeft':
      // only someone who had joined can "leave"; a wait that never ended stays a plain wait
      return s.peer === 'present' ? { ...s, peer: 'away', since: e.at, collapsed: false } : s
    case 'invited':
      return { ...s, invitedAt: e.at }
    case 'keepWaiting':
      return s.collapsed ? s : { ...s, collapsed: true }
    case 'reopen':
      return s.collapsed ? { ...s, collapsed: false } : s
  }
}

export const elapsedSecs = (s: Session, now: number) => Math.max(0, Math.floor((now - s.since) / 1000))

export type View = 'none' | 'pill' | 'card' | 'failed'
/** What the waiting UI should show right now. */
export function viewOf(s: Session, now: number): View {
  if (s.link === 'failed') return 'failed'
  if (s.peer === 'present') return 'none'
  return elapsedSecs(s, now) >= NOTICE_AFTER && !s.collapsed ? 'card' : 'pill'
}

/** Seconds until another invitation may be sent (0 = allowed now). */
export function inviteWait(s: Session, now: number) {
  if (s.invitedAt === null) return 0
  return Math.max(0, INVITE_COOLDOWN - Math.floor((now - s.invitedAt) / 1000))
}

/** "Close when I leave" only wipes when there is something to protect: the other person is here,
 *  or there is drawing/notes/stickers/game moves on the canvas. An empty canvas you're waiting on
 *  can be left and come back to. */
export const wipeOnLeave = (exitOnLeave: boolean, s: Session, hasContent: boolean) => exitOnLeave && (s.peer === 'present' || hasContent)

export function fmtElapsed(secs: number) {
  const m = Math.floor(secs / 60)
  return `${m}:${String(secs % 60).padStart(2, '0')}`
}

export const INVITE_TEXT = '👻 I’m on Ghost Canvas waiting for you. Tap the ghost icon at the top of our chat to join me.'
