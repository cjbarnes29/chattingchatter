/** Small shared state for the app lock: a "lock now" request any screen can send, and which
 *  confidential chats have been opened since the last lock. Locking forgets all of them. */

const LOCK_EVENT = 'chatter:lock'
const opened = new Set<string>()
const subs = new Set<() => void>()

export function requestLock() {
  opened.clear()
  subs.forEach((f) => f())
  window.dispatchEvent(new Event(LOCK_EVENT))
}
export function onLockRequest(fn: () => void) {
  window.addEventListener(LOCK_EVENT, fn)
  return () => window.removeEventListener(LOCK_EVENT, fn)
}

export const isChatOpened = (chatId: string) => opened.has(chatId)
export function markChatOpened(chatId: string) {
  opened.add(chatId)
  subs.forEach((f) => f())
}
/** Forget opened confidential chats (called whenever the app locks or goes to the background). */
export function forgetOpenedChats() {
  if (!opened.size) return
  opened.clear()
  subs.forEach((f) => f())
}
export function onOpenedChange(fn: () => void) {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}
