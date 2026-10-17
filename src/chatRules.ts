import { useSyncExternalStore } from 'react'
import { readPrivacyPrefs } from './prefs'

/** Per-conversation controls kept on this device: protecting what you send (no copying, no saving
 *  attachments) and overriding read receipts / typing indicator for one chat. Disappearing messages are
 *  not here: they travel with the messages so both people share them (see messageMeta.ts). */
export type Tri = 'default' | 'on' | 'off'
export type ChatRule = { noCopy: boolean; noDownload: boolean; receipts: Tri; typing: Tri }
export const RULE_DEFAULT: ChatRule = { noCopy: false, noDownload: false, receipts: 'default', typing: 'default' }

const KEY = 'chatter.chatRules.v1'
const tri = (v: unknown): Tri => (v === 'on' || v === 'off' ? v : 'default')
function readAll(): Record<string, ChatRule> {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Partial<ChatRule>>
    const out: Record<string, ChatRule> = {}
    for (const [id, r] of Object.entries(o)) out[id] = { noCopy: r.noCopy === true, noDownload: r.noDownload === true, receipts: tri(r.receipts), typing: tri(r.typing) }
    return out
  } catch {
    return {}
  }
}
let all = readAll()
const subs = new Set<() => void>()

export const readRule = (chatId: string): ChatRule => all[chatId] ?? RULE_DEFAULT
export function setRule(chatId: string, patch: Partial<ChatRule>) {
  all = { ...all, [chatId]: { ...readRule(chatId), ...patch } }
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
  subs.forEach((f) => f())
}
export const useChatRule = (chatId: string) =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => readRule(chatId))

const resolve = (t: Tri, global: boolean) => (t === 'default' ? global : t === 'on')
/** Whether this chat sends "read" ticks. */
export const receiptsOn = (chatId: string) => resolve(readRule(chatId).receipts, readPrivacyPrefs().readReceipts)
/** Whether this chat sends "typing…". */
export const typingOn = (chatId: string) => resolve(readRule(chatId).typing, readPrivacyPrefs().typingIndicator)
