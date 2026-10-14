import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { readCalPrefs } from './prefs'

export type CalEvent = {
  id: string
  creator_id: string
  peer_id: string
  title: string
  note: string
  starts_at: string
  remind_minutes: number
  reminder_sent: boolean
}

export type Alarm = { id: string; title: string; body: string; peerId: string }

export const REMIND_OPTIONS = [
  { v: 0, label: 'At start time' },
  { v: 5, label: '5 minutes before' },
  { v: 15, label: '15 minutes before' },
  { v: 30, label: '30 minutes before' },
  { v: 60, label: '1 hour before' },
  { v: 1440, label: '1 day before' },
]

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export const remindLabel = (m: number) => REMIND_OPTIONS.find((o) => o.v === m)?.label.toLowerCase() ?? `${m} min before`

export function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.28, 0.56].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.25)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    /* sound is optional */
  }
}

export async function ensureNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

async function systemNotify(title: string, body: string, tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: '/logo.png', badge: '/favicon.png', tag, requireInteraction: true })
    else new Notification(title, { body, icon: '/logo.png', tag })
  } catch {
    /* ignore */
  }
}

const firedKey = (me: string) => `chatter.cal.fired.${me}`
const getFired = (me: string): string[] => {
  try { return JSON.parse(localStorage.getItem(firedKey(me)) ?? '[]') } catch { return [] }
}

/**
 * Loads the events this user created or was invited to, keeps them live, and runs the reminder clock.
 * When a reminder is due: a system notification + an in-app alarm banner on this device, and the creator's
 * app also posts a reminder message into the chat (once, guarded by the reminder_sent flag).
 */
export function useEvents(myId: string, onReminderMessage: (peerId: string, text: string) => void) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const eventsRef = useRef(events)
  eventsRef.current = events
  const cb = useRef(onReminderMessage)
  cb.current = onReminderMessage

  useEffect(() => {
    let off = false
    supabase.from('events').select('*').order('starts_at', { ascending: true }).then(({ data }) => {
      if (!off && data) setEvents(data as CalEvent[])
    })
    const ch = supabase
      .channel(`events-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (p) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as { id?: string }).id
          if (id) setEvents((e) => e.filter((x) => x.id !== id))
          return
        }
        const row = p.new as CalEvent
        if (row.creator_id !== myId && row.peer_id !== myId) return
        setEvents((e) => (e.some((x) => x.id === row.id) ? e.map((x) => (x.id === row.id ? row : x)) : [...e, row]).sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
      })
      .subscribe()
    return () => {
      off = true
      supabase.removeChannel(ch)
    }
  }, [myId])

  useEffect(() => {
    const tick = async () => {
      const now = Date.now()
      const fired = getFired(myId)
      for (const ev of eventsRef.current) {
        const start = new Date(ev.starts_at).getTime()
        const due = start - ev.remind_minutes * 60000
        if (now < due || fired.includes(ev.id)) continue
        fired.push(ev.id)
        localStorage.setItem(firedKey(myId), JSON.stringify(fired.slice(-300)))
        const other = ev.creator_id === myId ? ev.peer_id : ev.creator_id
        if (now > start + 30 * 60000) continue // too old: don't alarm about the past
        const mins = Math.max(0, Math.round((start - now) / 60000))
        const when = mins <= 0 ? 'is starting now' : mins >= 60 ? `starts ${fmtWhen(ev.starts_at)}` : `starts in ${mins} min`
        const title = `Event: ${ev.title}`
        const body = `${ev.title} ${when}${ev.note ? ` — ${ev.note}` : ''}`
        setAlarms((a) => [...a, { id: ev.id, title, body, peerId: other }])
        systemNotify(title, body, ev.id)
        if (readCalPrefs().sound) beep()
        if (ev.creator_id === myId && !ev.reminder_sent) {
          const { data } = await supabase.from('events').update({ reminder_sent: true }).eq('id', ev.id).eq('reminder_sent', false).select('id')
          if (data?.length) cb.current(ev.peer_id, `⏰ Reminder: ${ev.title} ${when} (${fmtWhen(ev.starts_at)})`)
        }
      }
    }
    tick()
    const t = setInterval(tick, 15000)
    return () => clearInterval(t)
  }, [myId])

  const add = useCallback(
    async (peerId: string, title: string, note: string, startsAt: Date, remind: number): Promise<{ ok: true; event: CalEvent } | { ok: false; error: string }> => {
      const { data, error } = await supabase
        .from('events')
        .insert({ peer_id: peerId, title: title.trim(), note: note.trim(), starts_at: startsAt.toISOString(), remind_minutes: remind })
        .select('*')
        .single()
      if (error || !data) return { ok: false, error: 'Could not save the event. Try again.' }
      const ev = data as CalEvent
      setEvents((e) => (e.some((x) => x.id === ev.id) ? e : [...e, ev].sort((a, b) => a.starts_at.localeCompare(b.starts_at))))
      return { ok: true, event: ev }
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    setEvents((e) => e.filter((x) => x.id !== id))
    await supabase.from('events').delete().eq('id', id)
  }, [])

  const dismissAlarm = useCallback((id: string) => setAlarms((a) => a.filter((x) => x.id !== id)), [])

  return { events, alarms, add, remove, dismissAlarm }
}
