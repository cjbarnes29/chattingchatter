import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

/** Live "typing…" indicator for a one-to-one chat, sent over a realtime broadcast channel. */
export function useTyping(myId: string, peerId: string | null) {
  const [typing, setTyping] = useState(false)
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const last = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setTyping(false)
    if (!peerId) return
    const key = [myId, peerId].sort().join('-')
    const ch = supabase.channel(`typing:${key}`, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.from !== peerId) return
      setTyping(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setTyping(false), 3000)
    }).subscribe()
    chRef.current = ch
    return () => {
      window.clearTimeout(timer.current)
      chRef.current = null
      supabase.removeChannel(ch)
    }
  }, [myId, peerId])

  const notify = useCallback(() => {
    const now = Date.now()
    if (now - last.current < 1500 || !chRef.current) return
    last.current = now
    chRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: myId } })
  }, [myId])

  return { typing, notify }
}
