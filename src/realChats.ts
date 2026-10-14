import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { avatarFor } from './auth'
import type { Chat, Message } from './data'

type Row = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }
type Peer = { id: string; name: string; avatar: string | null; about: string }

export const REAL_PREFIX = 'u:'

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
    const { data } = await supabase.from('profiles').select('id, name, avatar, about').in('id', missing)
    if (data?.length) setPeers((p) => ({ ...p, ...Object.fromEntries(data.map((x) => [x.id, x as Peer])) }))
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
        const list = (data ?? []) as Row[]
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
    supabase.from('messages').update({ read_at: at }).in('id', unread.map((u) => u.id)).then(() => {})
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
        return { id: REAL_PREFIX + id, name: p.name, avatar: avatarFor(id, p.avatar), online: false, lastSeen: 'Chatter user', unread, messages, _t: mine.length ? mine[mine.length - 1].created_at : '' } as Chat & { _t: string }
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
