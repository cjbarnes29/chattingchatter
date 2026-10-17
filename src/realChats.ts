import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { avatarFor } from './auth'
import { isPublicId, normalizePublicId } from './publicId'
import type { Chat, Message } from './data'
import { readPrivacyPrefs } from './prefs'

type Row = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }
type OutItem = { id: string; peerId: string; body: string }
type Peer = {
  id: string
  name: string
  avatar: string | null
  about: string
  nickname?: string | null
  age?: number | null
  status?: string | null
  presence_mode?: string | null
  last_seen?: string | null
  /** 'private' hides age, nickname, status and about from other people */
  profile_visibility?: 'public' | 'private'
}
/** Profiles come through get_profiles(), which leaves out a private profile's nickname, age, status and about. */
async function fetchPeers(ids: string[]): Promise<Record<string, Peer>> {
  const { data } = await supabase.rpc('get_profiles', { p_ids: ids })
  const rows = (data as Peer[] | null) ?? []
  return Object.fromEntries(rows.map((x) => [x.id, { ...x, profile_visibility: x.profile_visibility === 'private' ? 'private' : 'public' }]))
}

const LOCAL_READ = 'chatter.localread'
const localRead = () => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(LOCAL_READ) || '[]')) } catch { return new Set<string>() }
}

export const REAL_PREFIX = 'u:'

/** What contacts see: online right now, a last-seen time, or nothing — following the person's own choice. */
function presenceOf(p: Peer): { online: boolean; label: string } {
  if (p.presence_mode === 'online') return { online: true, label: 'online' }
  if (p.presence_mode === 'offline') return { online: false, label: 'offline' }
  const t = p.last_seen ? new Date(p.last_seen).getTime() : 0
  if (!t) return { online: false, label: 'offline' }
  if (Date.now() - t < 100000) return { online: true, label: 'online' }
  return { online: false, label: `last seen ${fmt(p.last_seen!)}` }
}

function fmt(iso: string) {
  const d = new Date(iso)
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function useRealChats(myId: string) {
  const [rows, setRows] = useState<Row[]>([])
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const [loaded, setLoaded] = useState(false)
  const [openPeer, setOpenPeer] = useState<string | null>(null)
  const peersRef = useRef(peers)
  peersRef.current = peers

  const ensurePeers = useCallback(async (ids: string[]) => {
    const missing = ids.filter((i) => !peersRef.current[i])
    if (!missing.length) return
    const found = await fetchPeers(missing)
    if (Object.keys(found).length) setPeers((p) => ({ ...p, ...found }))
  }, [])

  // keep online / last-seen / status fresh while the app is open
  useEffect(() => {
    const t = window.setInterval(async () => {
      const ids = Object.keys(peersRef.current)
      if (!ids.length || document.visibilityState !== 'visible') return
      const found = await fetchPeers(ids)
      if (Object.keys(found).length) setPeers((p) => ({ ...p, ...found }))
    }, 30000)
    return () => window.clearInterval(t)
  }, [])

  const addRow = useCallback(
    (r: Row) => {
      setRows((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r]))
      ensurePeers([r.sender_id === myId ? r.recipient_id : r.sender_id])
    },
    [ensurePeers, myId],
  )

  useEffect(() => {
    let cancelled = false
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1000)
      .then(async ({ data }) => {
        if (cancelled) return
        const lr = localRead()
        const at = new Date().toISOString()
        const list = ((data ?? []) as Row[]).map((r) => (lr.has(r.id) && !r.read_at ? { ...r, read_at: at } : r))
        setRows(list)
        await ensurePeers([...new Set(list.map((r) => (r.sender_id === myId ? r.recipient_id : r.sender_id)))])
        if (!cancelled) setLoaded(true)
      })
    const ch = supabase
      .channel(`messages-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${myId}` }, (p) => addRow(p.new as Row))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${myId}` }, (p) => addRow(p.new as Row))
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [myId, addRow, ensurePeers])

  // mark messages as read while that conversation is open
  useEffect(() => {
    if (!openPeer) return
    const unread = rows.filter((r) => r.sender_id === openPeer && r.recipient_id === myId && !r.read_at)
    if (!unread.length) return
    const at = new Date().toISOString()
    setRows((prev) => prev.map((r) => (unread.some((u) => u.id === r.id) ? { ...r, read_at: at } : r)))
    if (readPrivacyPrefs().readReceipts) {
      supabase.from('messages').update({ read_at: at }).in('id', unread.map((u) => u.id)).then(() => {})
    } else {
      // read receipts are off: remember on this device only, the sender never sees a "read" tick
      const s = localRead()
      unread.forEach((u) => s.add(u.id))
      try { localStorage.setItem(LOCAL_READ, JSON.stringify([...s].slice(-800))) } catch { /* full */ }
    }
  }, [openPeer, rows, myId])

  /** pull-to-refresh: reload the conversation list from the server */
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(1000)
    if (error || !data) return
    const lr = localRead()
    const at = new Date().toISOString()
    const list = (data as Row[]).map((r) => (lr.has(r.id) && !r.read_at ? { ...r, read_at: at } : r))
    setRows(list)
    await ensurePeers([...new Set(list.map((r) => (r.sender_id === myId ? r.recipient_id : r.sender_id)))])
  }, [myId, ensurePeers])

  const chats: Chat[] = useMemo(() => {
    const ids = new Set<string>(Object.keys(peers))
    rows.forEach((r) => ids.add(r.sender_id === myId ? r.recipient_id : r.sender_id))
    return [...ids]
      .filter((id) => peers[id])
      .map((id) => {
        const p = peers[id]
        const mine = rows.filter((r) => (r.sender_id === myId ? r.recipient_id : r.sender_id) === id)
        const messages: Message[] = mine.map((r) => ({
          id: r.id,
          fromMe: r.sender_id === myId,
          text: r.body,
          time: fmt(r.created_at),
          status: r.sender_id === myId ? (r.read_at ? 'read' : 'delivered') : undefined,
        }))
        const unread = openPeer === id ? 0 : mine.filter((r) => r.sender_id === id && !r.read_at).length
        const pr = presenceOf(p)
        return {
          id: REAL_PREFIX + id,
          name: p.name,
          avatar: avatarFor(id, p.avatar),
          online: pr.online,
          lastSeen: pr.label,
          profile: { nickname: p.nickname ?? '', age: p.age ?? null, status: p.status ?? '', about: p.about, visibility: p.profile_visibility === 'private' ? 'private' : 'public' },
          unread,
          messages,
          _t: mine.length ? mine[mine.length - 1].created_at : '',
        } as Chat & { _t: string }
      })
      .sort((a, b) => (b as { _t: string })._t.localeCompare((a as { _t: string })._t))
  }, [rows, peers, myId, openPeer])

  // Messages typed while offline wait in a small outbox on this device and are sent when the connection returns.
  // Sending twice is harmless: the message id is the primary key, so a repeat comes back as "already exists".
  const outboxKey = `chatter.outbox.${myId}`
  const readOutbox = useCallback((): OutItem[] => {
    try { return JSON.parse(localStorage.getItem(outboxKey) ?? '[]') as OutItem[] } catch { return [] }
  }, [outboxKey])
  const writeOutbox = useCallback((items: OutItem[]) => {
    try { localStorage.setItem(outboxKey, JSON.stringify(items.slice(-100))) } catch { /* storage full: keep going without it */ }
  }, [outboxKey])

  const deliver = useCallback(async (it: OutItem): Promise<'ok' | 'retry' | 'fail'> => {
    const { error } = await supabase.from('messages').insert({ id: it.id, recipient_id: it.peerId, body: it.body })
    if (!error || error.code === '23505') return 'ok'
    // no HTTP status code = the request never reached the server (offline, dropped connection)
    return !navigator.onLine || !error.code ? 'retry' : 'fail'
  }, [])

  const flushOutbox = useCallback(async () => {
    const queue = readOutbox()
    if (!queue.length) return
    const left: OutItem[] = []
    for (const it of queue) {
      const r = left.length ? 'retry' : await deliver(it) // keep the order: stop at the first one that can't go
      if (r === 'retry') left.push(it)
      else if (r === 'fail') setRows((prev) => prev.filter((x) => x.id !== it.id))
    }
    writeOutbox(left)
  }, [readOutbox, writeOutbox, deliver])

  useEffect(() => {
    void flushOutbox()
    const t = window.setInterval(() => void flushOutbox(), 20000)
    window.addEventListener('online', flushOutbox)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('online', flushOutbox)
    }
  }, [flushOutbox])

  const send = useCallback(
    async (chatId: string, text: string) => {
      const peerId = chatId.slice(REAL_PREFIX.length)
      const item: OutItem = { id: crypto.randomUUID(), peerId, body: text }
      addRow({ id: item.id, sender_id: myId, recipient_id: peerId, body: text, created_at: new Date().toISOString(), read_at: null })
      // behind anything already waiting, so messages arrive in the order they were written
      if (readOutbox().length) {
        writeOutbox([...readOutbox(), item])
        return void flushOutbox()
      }
      const r = await deliver(item)
      if (r === 'retry') writeOutbox([item])
      else if (r === 'fail') setRows((prev) => prev.filter((x) => x.id !== item.id))
    },
    [addRow, myId, readOutbox, writeOutbox, flushOutbox, deliver],
  )

  /** Starts a chat with a friend, found by their email or their ID# */
  const startChat = useCallback(async (who: string): Promise<{ ok: true; chatId: string } | { ok: false; error: string }> => {
    const byId = !who.includes('@')
    if (byId && !isPublicId(who)) return { ok: false, error: 'Enter a valid email or an ID# like K7QM-4XZ2.' }
    const { data, error } = byId
      ? await supabase.rpc('find_profile_by_public_id', { p_id: normalizePublicId(who) })
      : await supabase.rpc('find_profile_by_email', { p_email: who })
    if (error) return { ok: false, error: 'Could not search right now. Try again.' }
    const found = (data as Peer[] | null)?.[0]
    if (!found) return { ok: false, error: byId ? 'No Chatter user with that ID#.' : 'No Chatter user with that email yet. Invite them to join!' }
    setPeers((p) => ({ ...p, [found.id]: found }))
    return { ok: true, chatId: REAL_PREFIX + found.id }
  }, [])

  return { chats, loaded, send, startChat, setOpenPeer, refresh }
}
