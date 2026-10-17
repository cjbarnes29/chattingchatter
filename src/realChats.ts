import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { avatarFor } from './auth'
import type { Chat, Message } from './data'
import { readPrivacyPrefs } from './prefs'

type Row = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }
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
}
const PEER_COLS = 'id, name, avatar, about, nickname, age, status, presence_mode, last_seen'
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
    const { data } = await supabase.from('profiles').select(PEER_COLS).in('id', missing)
    if (data?.length) setPeers((p) => ({ ...p, ...Object.fromEntries(data.map((x) => [x.id, x as Peer])) }))
  }, [])

  // keep online / last-seen / status fresh while the app is open
  useEffect(() => {
    const t = window.setInterval(async () => {
      const ids = Object.keys(peersRef.current)
      if (!ids.length || document.visibilityState !== 'visible') return
      const { data } = await supabase.from('profiles').select(PEER_COLS).in('id', ids)
      if (data?.length) setPeers((p) => ({ ...p, ...Object.fromEntries(data.map((x) => [x.id, x as Peer])) }))
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
    // newest 1000, shown oldest first (ascending + limit would keep the oldest and drop new messages)
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(async ({ data }) => {
        if (cancelled) return
        const lr = localRead()
        const at = new Date().toISOString()
        const list = ((data ?? []) as Row[]).reverse().map((r) => (lr.has(r.id) && !r.read_at ? { ...r, read_at: at } : r))
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
          profile: { nickname: p.nickname ?? '', age: p.age ?? null, status: p.status ?? '', about: p.about },
          unread,
          messages,
          _t: mine.length ? mine[mine.length - 1].created_at : '',
        } as Chat & { _t: string }
      })
      .sort((a, b) => (b as { _t: string })._t.localeCompare((a as { _t: string })._t))
  }, [rows, peers, myId, openPeer])

  const send = useCallback(
    async (chatId: string, text: string) => {
      const peerId = chatId.slice(REAL_PREFIX.length)
      const id = crypto.randomUUID()
      addRow({ id, sender_id: myId, recipient_id: peerId, body: text, created_at: new Date().toISOString(), read_at: null })
      const { error } = await supabase.from('messages').insert({ id, recipient_id: peerId, body: text })
      if (error) setRows((prev) => prev.filter((r) => r.id !== id))
    },
    [addRow, myId],
  )

  const startChat = useCallback(async (email: string): Promise<{ ok: true; chatId: string } | { ok: false; error: string }> => {
    const { data, error } = await supabase.rpc('find_profile_by_email', { p_email: email })
    if (error) return { ok: false, error: 'Could not search right now. Try again.' }
    const found = (data as Peer[] | null)?.[0]
    if (!found) return { ok: false, error: 'No Chatter user with that email yet. Invite them to join!' }
    setPeers((p) => ({ ...p, [found.id]: found }))
    return { ok: true, chatId: REAL_PREFIX + found.id }
  }, [])

  return { chats, loaded, send, startChat, setOpenPeer }
}
