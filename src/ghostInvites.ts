import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { Device, isNative } from './native'

export type GhostNotify = 'notification' | 'call'
export type GhostStatus = 'invited' | 'accepted' | 'declined' | 'cancelled' | 'ended'
export type GhostSess = { id: string; host_id: string; guest_id: string; notify: GhostNotify; status: GhostStatus; created_at: string }

/** An invitation older than this is ignored, so a missed one never pops up later */
const FRESH_MS = 90_000
/** The host stops waiting after this long */
const OUTGOING_TIMEOUT_MS = 60_000

/** Ghost Canvas invitations. Nothing is shared until the invited person accepts; the live drawing room is only
 *  opened for an accepted session (see supabase/migrations/ghost_sessions.sql). One session at a time. */
export function useGhostInvites(myId: string, allowFrom: (peerId: string) => boolean, nameOf: (peerId: string) => string) {
  const [sess, setSess] = useState<GhostSess | null>(null)
  const sessRef = useRef<GhostSess | null>(null)
  const allowRef = useRef(allowFrom)
  allowRef.current = allowFrom
  const nameRef = useRef(nameOf)
  nameRef.current = nameOf

  const put = useCallback((s: GhostSess | null) => {
    sessRef.current = s
    setSess(s)
  }, [])

  const setStatus = useCallback(async (id: string, status: GhostStatus) => {
    const { error } = await supabase.from('ghost_sessions').update({ status }).eq('id', id)
    return !error
  }, [])

  useEffect(() => {
    const onRow = (row: GhostSess) => {
      const cur = sessRef.current
      if (row.status === 'invited') {
        if (row.guest_id !== myId) return
        if (Date.now() - new Date(row.created_at).getTime() > FRESH_MS) return
        // busy, or the person isn't allowed to invite me: say no without bothering anyone
        if (cur || !allowRef.current(row.host_id)) {
          void setStatus(row.id, 'declined')
          return
        }
        put(row)
        if (isNative() && document.visibilityState === 'hidden') {
          void Device.showNotification({ id: `ghost-${row.id}`, title: 'Ghost Canvas', body: `${nameRef.current(row.host_id)} invited you to a Ghost Canvas` }).catch(() => {})
        }
        return
      }
      if (!cur || cur.id !== row.id) return
      // accepted keeps the session open; every other outcome closes it
      put(row.status === 'accepted' ? row : null)
    }
    const ch = supabase
      .channel(`ghost-invites-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ghost_sessions', filter: `guest_id=eq.${myId}` }, (p) => onRow(p.new as GhostSess))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ghost_sessions', filter: `guest_id=eq.${myId}` }, (p) => onRow(p.new as GhostSess))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ghost_sessions', filter: `host_id=eq.${myId}` }, (p) => onRow(p.new as GhostSess))
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [myId, put, setStatus])

  /** Host: ask someone to join. Resolves once the invitation is stored; the answer arrives through `session`. */
  const invite = useCallback(
    async (peerId: string, notify: GhostNotify): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (sessRef.current) return { ok: false, error: 'Finish or cancel your current Ghost Canvas first.' }
      const { data, error } = await supabase.from('ghost_sessions').insert({ host_id: myId, guest_id: peerId, notify }).select().single()
      if (error || !data) {
        return { ok: false, error: /relation|does not exist|schema cache/i.test(error?.message ?? '') ? 'Ghost Canvas invitations need a backend update. Try again later.' : 'Could not send the invitation. Try again.' }
      }
      put(data as GhostSess)
      return { ok: true }
    },
    [myId, put],
  )

  const accept = useCallback(async () => {
    const s = sessRef.current
    if (!s || s.status !== 'invited' || s.guest_id !== myId) return
    if (await setStatus(s.id, 'accepted')) put({ ...s, status: 'accepted' })
    else put(null)
  }, [myId, put, setStatus])

  const decline = useCallback(async () => {
    const s = sessRef.current
    if (!s || s.status !== 'invited' || s.guest_id !== myId) return
    put(null)
    await setStatus(s.id, 'declined')
  }, [myId, put, setStatus])

  /** Host: withdraw an invitation that hasn't been answered */
  const cancel = useCallback(async () => {
    const s = sessRef.current
    if (!s || s.status !== 'invited' || s.host_id !== myId) return
    put(null)
    await setStatus(s.id, 'cancelled')
  }, [myId, put, setStatus])

  /** Either person: close an accepted session for both */
  const end = useCallback(async () => {
    const s = sessRef.current
    if (!s || s.status !== 'accepted') return
    put(null)
    await setStatus(s.id, 'ended')
  }, [put, setStatus])

  // an unanswered invitation (sent or received) expires by itself
  useEffect(() => {
    if (!sess || sess.status !== 'invited') return
    const left = (sess.host_id === myId ? OUTGOING_TIMEOUT_MS : FRESH_MS) - (Date.now() - new Date(sess.created_at).getTime())
    const t = setTimeout(() => {
      if (sessRef.current?.id !== sess.id || sessRef.current.status !== 'invited') return
      if (sess.host_id === myId) void cancel()
      else put(null)
    }, Math.max(1000, left))
    return () => clearTimeout(t)
  }, [sess, myId, cancel, put])

  const peerId = sess ? (sess.host_id === myId ? sess.guest_id : sess.host_id) : null
  return {
    session: sess,
    peerId,
    /** I sent it and am waiting for an answer */
    outgoing: !!sess && sess.status === 'invited' && sess.host_id === myId,
    /** someone invited me */
    incoming: !!sess && sess.status === 'invited' && sess.guest_id === myId,
    active: !!sess && sess.status === 'accepted',
    invite,
    accept,
    decline,
    cancel,
    end,
  }
}
