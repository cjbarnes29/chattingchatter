/** The one place that says what's free, what's Pro, and what actually works today.
 *  The upgrade screen, settings and feature checks all read from here, so nothing is shown as
 *  working before it is.
 *
 *  Note: billing isn't connected and Pro status is held on the device, so this decides what the
 *  app shows and unlocks. It is not a server-side paywall. Every Pro feature here runs on the
 *  device and grants no extra access to anyone else's data. */

export type FeatureId =
  | 'decoyChats' | 'appLock' | 'bioUnlock' | 'confidentialChats' | 'autoLock' | 'intruderLog'
  | 'networkPrivacy' | 'screenshotShield'
  | 'infiniteCanvas' | 'richBrushes' | 'eraserRedo' | 'masterpieces' | 'sharedCalendar' | 'sharedMedia' | 'connectFour'
  | 'voiceTranslation' | 'focus' | 'largeFiles' | 'workCalendar'

export type Status = 'live' | 'mobile' | 'soon'
export type Feature = {
  id: FeatureId
  group: 'privacy' | 'canvas' | 'utility'
  name: string
  desc: string
  /** what free accounts get: true = everything, false = nothing, number = that many */
  free: boolean | number
  /** what Pro gets: true = everything, number = that many */
  pro: boolean | number
  status: Status
}

export const FEATURES: Feature[] = [
  // privacy & security
  { id: 'appLock', group: 'privacy', name: 'PIN app lock', desc: 'Ask for a PIN when Chatter opens, with wrong-guess limits.', free: true, pro: true, status: 'live' },
  { id: 'decoyChats', group: 'privacy', name: 'Decoy chats', desc: 'Any PIN other than yours opens harmless fake chats instead of your real ones.', free: 1, pro: true, status: 'live' },
  { id: 'confidentialChats', group: 'privacy', name: 'Confidential chats', desc: 'Lock chosen chats behind your PIN or fingerprint. Their previews are hidden.', free: 1, pro: true, status: 'live' },
  { id: 'autoLock', group: 'privacy', name: 'Auto-lock timer', desc: 'Lock straight away, after 30 seconds to 15 minutes in the background, or only when Chatter is closed.', free: true, pro: true, status: 'live' },
  { id: 'intruderLog', group: 'privacy', name: 'Wrong-PIN alerts', desc: 'See how many wrong PINs were tried since you last unlocked.', free: true, pro: true, status: 'live' },
  { id: 'bioUnlock', group: 'privacy', name: 'Fingerprint & face unlock', desc: 'Unlock with your phone’s fingerprint or face check. A failed check never opens anything.', free: false, pro: true, status: 'live' },
  { id: 'screenshotShield', group: 'privacy', name: 'Screenshot shield', desc: 'Ask the phone to block screenshots in confidential chats. Can’t stop another camera.', free: false, pro: true, status: 'mobile' },
  { id: 'networkPrivacy', group: 'privacy', name: 'Onion routing (research)', desc: 'Being evaluated for the mobile app. It would hide your IP from Chatter’s servers, not guarantee anonymity.', free: false, pro: true, status: 'soon' },
  // canvas
  { id: 'eraserRedo', group: 'canvas', name: 'Eraser, undo & redo', desc: 'Fix mistakes on the Ghost Canvas.', free: true, pro: true, status: 'live' },
  { id: 'infiniteCanvas', group: 'canvas', name: 'Infinite canvas', desc: 'Zoom in and out with pinch, wheel or buttons. Everyone can pan.', free: false, pro: true, status: 'live' },
  { id: 'richBrushes', group: 'canvas', name: 'Rich brushes & opacity', desc: 'Neon, metallic and watercolour brushes, with an opacity control.', free: false, pro: true, status: 'live' },
  { id: 'masterpieces', group: 'canvas', name: 'Encrypted masterpieces', desc: 'Save canvases encrypted with your password, open them later, or export the encrypted file.', free: false, pro: true, status: 'live' },
  { id: 'connectFour', group: 'canvas', name: 'Connect Four', desc: 'Play Connect Four on the canvas. Tic-tac-toe is free.', free: false, pro: true, status: 'live' },
  { id: 'sharedCalendar', group: 'canvas', name: 'Shared calendar', desc: 'Plan dates with reminders right on the canvas.', free: true, pro: true, status: 'live' },
  { id: 'sharedMedia', group: 'canvas', name: 'Watch together', desc: 'Watch videos in sync on the canvas.', free: false, pro: true, status: 'soon' },
  // utility
  { id: 'focus', group: 'utility', name: 'Focus scheduling', desc: 'Bundle notifications during set hours, including overnight. Favourites can still get through.', free: false, pro: true, status: 'live' },
  { id: 'voiceTranslation', group: 'utility', name: 'Voice note translation', desc: 'Translate voice notes into your language (asks before sending audio anywhere).', free: false, pro: true, status: 'mobile' },
  { id: 'largeFiles', group: 'utility', name: 'Large file sharing', desc: 'Send big files with expiring links for chosen people only.', free: false, pro: true, status: 'soon' },
  { id: 'workCalendar', group: 'utility', name: 'Work calendar sync', desc: 'Turn on focus during meetings from your calendar, with your permission.', free: false, pro: true, status: 'mobile' },
]

const byId = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<FeatureId, Feature>
export const feature = (id: FeatureId) => byId[id]

/** Can this account use the feature right now? Never true for features that aren't built yet. */
export function canUse(id: FeatureId, isPro: boolean) {
  const f = byId[id]
  if (f.status !== 'live') return false
  const v = isPro ? f.pro : f.free
  return v === true || (typeof v === 'number' && v > 0)
}

/** How many of something this account may have (Infinity when unlimited, 0 when not allowed). */
export function limit(id: FeatureId, isPro: boolean) {
  const f = byId[id]
  if (f.status !== 'live') return 0
  const v = isPro ? f.pro : f.free
  return v === true ? Infinity : typeof v === 'number' ? v : 0
}

export const STATUS_LABEL: Record<Status, string> = { live: 'Available', mobile: 'Coming with the mobile release', soon: 'Coming soon' }
