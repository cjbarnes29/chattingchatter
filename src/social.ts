import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { avatarFor } from './auth'

export const GROUP_PREFIX = 'g:'
export const GROUP_COLORS = ['#E0573B', '#2F7A6B', '#3A5BA0', '#8A4FB8', '#C98A1B', '#B83D6E']
export const STORY_EMOJIS = ['❤️', '😂', '🔥', '👏', '😮', '😢']

export type GroupMember = { id: string; name: string; avatar: string; role: 'admin' | 'member' }
export type Group = { id: string; name: string; color: string; createdBy: string; members: GroupMember[] }
export type GroupMessage = { id: string; groupId: string; senderId: string; body: string; createdAt: string }
export type Poll = { id: string; groupId: string; createdBy: string; question: string; options: string[]; multi: boolean; closed: boolean; votes: Record<string, number[]> }

type PollRow = { id: string; group_id: string; created_by: string; question: string; options: string[]; multi: boolean; closed: boolean }
const toPoll = (r: PollRow, votes: Record<string, number[]> = {}): Poll => ({ id: r.id, groupId: r.group_id, createdBy: r.created_by, question: r.question, options: r.options, multi: r.multi, closed: r.closed, votes })
function votesByUser(rows: { user_id: string; option_idx: number }[]) {
  const by: Record<string, number[]> = {}
  rows.forEach((v) => (by[v.user_id] ??= []).push(v.option_idx))
  return by
}

export type Story = {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string
  body: string
  createdAt: string
  visibleUntil: string
  reactions: Record<string, number>
  myReaction: string | null
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function timeLeft(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  if (s <= 0) return 'expired'
  if (s < 3600) return `${Math.ceil(s / 60)}m left`
  if (s < 86400) return `${Math.ceil(s / 3600)}h left`
  return `${Math.ceil(s / 86400)}d left`
}

// ---------- GROUPS ----------
export function useGroups(myId: string) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupMessages, setGroupMessages] = useState<Record<string, GroupMessage[]>>({})
  const [polls, setPolls] = useState<Record<string, Poll>>({})
  const [loaded, setLoaded] = useState(false)

  const loadGroups = useCallback(async () => {
    const { data: mem } = await supabase.from('group_members').select('group_id').eq('user_id', myId)
    const ids = (mem ?? []).map((m) => m.group_id as string)
    if (!ids.length) {
      setGroups([])
      return
    }
    const [{ data: gs }, { data: ms }] = await Promise.all([
      supabase.from('groups').select('id, name, color, created_by').in('id', ids),
      supabase.from('group_members').select('group_id, user_id, role').in('group_id', ids),
    ])
    const uids = [...new Set((ms ?? []).map((m) => m.user_id as string))]
    const { data: profs } = uids.length ? await supabase.from('profiles').select('id, name, avatar').in('id', uids) : { data: [] }
    const pmap = Object.fromEntries((profs ?? []).map((p) => [p.id as string, p]))
    setGroups(
      (gs ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        createdBy: g.created_by,
        members: (ms ?? [])
          .filter((m) => m.group_id === g.id)
          .map((m) => ({
            id: m.user_id,
            name: pmap[m.user_id]?.name ?? 'Member',
            avatar: avatarFor(m.user_id, pmap[m.user_id]?.avatar),
            role: m.role as 'admin' | 'member',
          })),
      })),
    )
  }, [myId])

  const loadPollVotes = useCallback(async (pollId: string) => {
    const { data } = await supabase.from('group_poll_votes').select('user_id, option_idx').eq('poll_id', pollId)
    setPolls((prev) => (prev[pollId] ? { ...prev, [pollId]: { ...prev[pollId], votes: votesByUser(data ?? []) } } : prev))
  }, [])

  useEffect(() => {
    let cancelled = false
    loadGroups().then(() => !cancelled && setLoaded(true))
    const ch = supabase
      .channel(`groups-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => loadGroups())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => loadGroups())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (p) => {
        const r = p.new as { id: string; group_id: string; sender_id: string; body: string; created_at: string }
        setGroupMessages((prev) => {
          const list = prev[r.group_id] ?? []
          if (list.some((x) => x.id === r.id)) return prev
          return { ...prev, [r.group_id]: [...list, { id: r.id, groupId: r.group_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at }] }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_polls' }, (p) => {
        const r = p.new as PollRow
        if (!r?.id) return
        setPolls((prev) => ({ ...prev, [r.id]: toPoll(r, prev[r.id]?.votes) }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_poll_votes' }, (p) => {
        const pollId = ((p.new as { poll_id?: string })?.poll_id ?? (p.old as { poll_id?: string })?.poll_id) as string | undefined
        if (pollId) loadPollVotes(pollId)
      })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [myId, loadGroups, loadPollVotes])

  // load history for each group once we know the group list
  useEffect(() => {
    const ids = groups.map((g) => g.id)
    if (!ids.length) return
    supabase
      .from('group_messages')
      .select('id, group_id, sender_id, body, created_at')
      .in('group_id', ids)
      .order('created_at', { ascending: true })
      .limit(2000)
      .then(({ data }) => {
        const by: Record<string, GroupMessage[]> = {}
        ;(data ?? []).forEach((r) => {
          ;(by[r.group_id] ??= []).push({ id: r.id, groupId: r.group_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at })
        })
        setGroupMessages((prev) => ({ ...prev, ...by }))
      })
    supabase
      .from('group_polls')
      .select('id, group_id, created_by, question, options, multi, closed')
      .in('group_id', ids)
      .then(async ({ data }) => {
        const rows = (data ?? []) as PollRow[]
        if (!rows.length) return
        const { data: vs } = await supabase.from('group_poll_votes').select('poll_id, user_id, option_idx').in('poll_id', rows.map((r) => r.id))
        const next: Record<string, Poll> = {}
        rows.forEach((r) => (next[r.id] = toPoll(r, votesByUser((vs ?? []).filter((v) => v.poll_id === r.id)))))
        setPolls((prev) => ({ ...prev, ...next }))
      })
  }, [groups])

  const createGroup = useCallback(
    async (name: string, color: string, memberEmails: string[]) => {
      const { data: found, error: fe } = await supabase.rpc('find_profiles_by_emails', { p_emails: memberEmails })
      if (fe) return { ok: false as const, error: 'Could not look up those friends. Try again.' }
      const ids = ((found as { id: string }[] | null) ?? []).map((p) => p.id)
      if (!ids.length) return { ok: false as const, error: 'None of those emails belong to a Chatter user yet.' }
      const { data, error } = await supabase.rpc('create_group', { p_name: name, p_color: color, p_members: ids })
      if (error) return { ok: false as const, error: error.message }
      await loadGroups()
      return { ok: true as const, groupId: data as string }
    },
    [loadGroups],
  )

  const sendGroupMessage = useCallback(
    async (groupId: string, body: string) => {
      const id = crypto.randomUUID()
      const row: GroupMessage = { id, groupId, senderId: myId, body, createdAt: new Date().toISOString() }
      setGroupMessages((prev) => ({ ...prev, [groupId]: [...(prev[groupId] ?? []), row] }))
      const { error } = await supabase.from('group_messages').insert({ id, group_id: groupId, sender_id: myId, body })
      if (error) setGroupMessages((prev) => ({ ...prev, [groupId]: (prev[groupId] ?? []).filter((m) => m.id !== id) }))
    },
    [myId],
  )

  const createPoll = useCallback(async (groupId: string, question: string, options: string[], multi: boolean) => {
    const { error } = await supabase.rpc('create_group_poll', { p_group: groupId, p_question: question, p_options: options, p_multi: multi })
    return error ? { ok: false as const, error: error.message } : { ok: true as const }
  }, [])

  const votePoll = useCallback(
    async (pollId: string, options: number[]) => {
      // optimistic: show my vote immediately, then resync from the server
      setPolls((prev) => (prev[pollId] ? { ...prev, [pollId]: { ...prev[pollId], votes: { ...prev[pollId].votes, [myId]: options } } } : prev))
      await supabase.rpc('vote_group_poll', { p_poll: pollId, p_options: options })
      await loadPollVotes(pollId)
    },
    [myId, loadPollVotes],
  )

  const closePoll = useCallback(async (pollId: string) => {
    const { error } = await supabase.rpc('close_group_poll', { p_poll: pollId })
    if (!error) setPolls((prev) => (prev[pollId] ? { ...prev, [pollId]: { ...prev[pollId], closed: true } } : prev))
  }, [])

  const renameGroup = useCallback(async (groupId: string, name: string, color: string) => {
    await supabase.from('groups').update({ name, color }).eq('id', groupId)
    await loadGroups()
  }, [loadGroups])

  const deleteGroup = useCallback(async (groupId: string) => {
    await supabase.from('groups').delete().eq('id', groupId)
    await loadGroups()
  }, [loadGroups])

  const leaveGroup = useCallback(async (groupId: string) => {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', myId)
    await loadGroups()
  }, [myId, loadGroups])

  const addMembers = useCallback(
    async (groupId: string, emails: string[]) => {
      const { data: found } = await supabase.rpc('find_profiles_by_emails', { p_emails: emails })
      const ids = ((found as { id: string }[] | null) ?? []).map((p) => p.id)
      if (!ids.length) return { ok: false as const, error: 'No Chatter users found with those emails.' }
      const { error } = await supabase.from('group_members').insert(ids.map((u) => ({ group_id: groupId, user_id: u, role: 'member' })))
      if (error) return { ok: false as const, error: error.message }
      await loadGroups()
      return { ok: true as const }
    },
    [loadGroups],
  )

  const removeMember = useCallback(
    async (groupId: string, userId: string) => {
      await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
      await loadGroups()
    },
    [loadGroups],
  )

  const setRole = useCallback(
    async (groupId: string, userId: string, role: 'admin' | 'member') => {
      await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId)
      await loadGroups()
    },
    [loadGroups],
  )

  return {
    groups,
    groupMessages,
    polls,
    loaded,
    createGroup,
    sendGroupMessage,
    createPoll,
    votePoll,
    closePoll,
    renameGroup,
    deleteGroup,
    leaveGroup,
    addMembers,
    removeMember,
    setRole,
    reload: loadGroups,
  }
}

// ---------- STORIES ----------
export function useStories(myId: string) {
  const [stories, setStories] = useState<Story[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString()
    const { data: rows } = await supabase
      .from('stories')
      .select('id, author_id, body, created_at, visible_until')
      .gt('visible_until', nowIso)
      .order('created_at', { ascending: false })
      .limit(200)
    const list = rows ?? []
    const ids = list.map((s) => s.id)
    const authorIds = [...new Set(list.map((s) => s.author_id as string))]
    const [{ data: profs }, { data: reacts }] = await Promise.all([
      authorIds.length ? supabase.from('profiles').select('id, name, avatar').in('id', authorIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar: string | null }[] }),
      ids.length ? supabase.from('story_reactions').select('story_id, user_id, emoji').in('story_id', ids) : Promise.resolve({ data: [] as { story_id: string; user_id: string; emoji: string }[] }),
    ])
    const pmap = Object.fromEntries((profs ?? []).map((p) => [p.id, p]))
    setStories(
      list.map((s) => {
        const rs = (reacts ?? []).filter((r) => r.story_id === s.id)
        const counts: Record<string, number> = {}
        rs.forEach((r) => (counts[r.emoji] = (counts[r.emoji] ?? 0) + 1))
        return {
          id: s.id,
          authorId: s.author_id,
          authorName: pmap[s.author_id]?.name ?? 'Someone',
          authorAvatar: avatarFor(s.author_id, pmap[s.author_id]?.avatar),
          body: s.body,
          createdAt: s.created_at,
          visibleUntil: s.visible_until,
          reactions: counts,
          myReaction: rs.find((r) => r.user_id === myId)?.emoji ?? null,
        }
      }),
    )
  }, [myId])

  useEffect(() => {
    let cancelled = false
    load().then(() => !cancelled && setLoaded(true))
    const ch = supabase
      .channel(`stories-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_reactions' }, () => load())
      .subscribe()
    // refresh every minute so expired stories disappear on their own
    const t = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
      supabase.removeChannel(ch)
    }
  }, [myId, load])

  const postStory = useCallback(
    async (body: string, visibleDays: number) => {
      const until = new Date(Date.now() + visibleDays * 86400_000).toISOString()
      const { error } = await supabase.from('stories').insert({ author_id: myId, body, visible_days: visibleDays, visible_until: until })
      if (error) return { ok: false as const, error: error.message }
      await load()
      return { ok: true as const }
    },
    [myId, load],
  )

  const deleteStory = useCallback(
    async (id: string) => {
      await supabase.from('stories').delete().eq('id', id)
      await load()
    },
    [load],
  )

  const editStory = useCallback(
    async (id: string, body: string) => {
      await supabase.from('stories').update({ body }).eq('id', id)
      await load()
    },
    [load],
  )

  const react = useCallback(
    async (storyId: string, emoji: string | null, current: string | null) => {
      if (!emoji || emoji === current) {
        await supabase.from('story_reactions').delete().eq('story_id', storyId).eq('user_id', myId)
      } else {
        await supabase.from('story_reactions').upsert({ story_id: storyId, user_id: myId, emoji })
      }
      await load()
    },
    [myId, load],
  )

  return { stories, loaded, postStory, deleteStory, editStory, react, reload: load }
}

// ---------- CALLS (WebRTC, signaled through the call_signals table) ----------
export type CallMedia = 'voice' | 'video'
export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function useCall(myId: string) {
  const [state, setState] = useState<CallState>('idle')
  const [media, setMedia] = useState<CallMedia>('voice')
  const [peerId, setPeerId] = useState<string | null>(null)
  const [callId, setCallId] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<{ callId: string; from: string; media: CallMedia; offer: RTCSessionDescriptionInit } | null>(null)

  const pc = useRef<RTCPeerConnection | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const localRef = useRef<MediaStream | null>(null)
  const callRef = useRef<{ id: string | null; peer: string | null; media: CallMedia }>({ id: null, peer: null, media: 'voice' })

  const send = useCallback(
    async (to: string, cid: string, kind: string, mediaType: CallMedia, payload: unknown = null) => {
      await supabase.from('call_signals').insert({ call_id: cid, sender_id: myId, recipient_id: to, kind, media: mediaType, payload })
    },
    [myId],
  )

  const teardown = useCallback(() => {
    pc.current?.getSenders().forEach((s) => s.track?.stop())
    pc.current?.close()
    pc.current = null
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    pendingIce.current = []
    setLocalStream(null)
    setRemoteStream(null)
    setMuted(false)
    setCamOff(false)
  }, [])

  const createPc = useCallback(
    (peer: string, cid: string, mediaType: CallMedia) => {
      const conn = new RTCPeerConnection(RTC_CONFIG)
      conn.onicecandidate = (e) => {
        if (e.candidate) send(peer, cid, 'ice', mediaType, e.candidate.toJSON())
      }
      conn.ontrack = (e) => {
        const [s] = e.streams
        setRemoteStream(s ?? new MediaStream([e.track]))
      }
      conn.onconnectionstatechange = () => {
        if (conn.connectionState === 'connected') setState('connected')
        if (conn.connectionState === 'failed' || conn.connectionState === 'disconnected') {
          setError('The connection dropped.')
          setState('ended')
          teardown()
        }
      }
      pc.current = conn
      return conn
    },
    [send, teardown],
  )

  const getMedia = useCallback(async (mediaType: CallMedia) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mediaType === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    })
    localRef.current = stream
    setLocalStream(stream)
    return stream
  }, [])

  const endCall = useCallback(
    async (notify = true) => {
      const { id, peer, media: m } = callRef.current
      if (notify && id && peer) await send(peer, id, 'hangup', m)
      teardown()
      callRef.current = { id: null, peer: null, media: 'voice' }
      setPeerId(null)
      setCallId(null)
      setIncoming(null)
      setState('ended')
      setTimeout(() => setState('idle'), 1200)
    },
    [send, teardown],
  )

  // place a call
  const startCall = useCallback(
    async (peer: string, mediaType: CallMedia) => {
      if (state !== 'idle' && state !== 'ended') return
      setError(null)
      setMedia(mediaType)
      setPeerId(peer)
      setState('calling')
      const cid = crypto.randomUUID()
      setCallId(cid)
      callRef.current = { id: cid, peer, media: mediaType }
      try {
        const stream = await getMedia(mediaType)
        const conn = createPc(peer, cid, mediaType)
        stream.getTracks().forEach((t) => conn.addTrack(t, stream))
        const offer = await conn.createOffer()
        await conn.setLocalDescription(offer)
        await send(peer, cid, 'invite', mediaType, offer)
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Allow microphone/camera access in your browser to call.'
            : 'Could not start the call. Check your microphone and camera.',
        )
        teardown()
        setState('ended')
        setTimeout(() => setState('idle'), 2000)
      }
    },
    [state, getMedia, createPc, send, teardown],
  )

  // accept an incoming call
  const acceptCall = useCallback(async () => {
    if (!incoming) return
    setError(null)
    const { callId: cid, from, media: mediaType, offer } = incoming
    setMedia(mediaType)
    setPeerId(from)
    setCallId(cid)
    callRef.current = { id: cid, peer: from, media: mediaType }
    setIncoming(null)
    setState('connecting')
    try {
      const stream = await getMedia(mediaType)
      const conn = createPc(from, cid, mediaType)
      stream.getTracks().forEach((t) => conn.addTrack(t, stream))
      await conn.setRemoteDescription(offer)
      for (const c of pendingIce.current) await conn.addIceCandidate(c).catch(() => {})
      pendingIce.current = []
      const answer = await conn.createAnswer()
      await conn.setLocalDescription(answer)
      await send(from, cid, 'answer', mediaType, answer)
    } catch {
      setError('Allow microphone/camera access to answer the call.')
      await send(from, cid, 'decline', mediaType)
      teardown()
      setState('ended')
      setTimeout(() => setState('idle'), 2000)
    }
  }, [incoming, getMedia, createPc, send, teardown])

  const declineCall = useCallback(async () => {
    if (!incoming) return
    await send(incoming.from, incoming.callId, 'decline', incoming.media)
    setIncoming(null)
  }, [incoming, send])

  // listen for signals addressed to me
  useEffect(() => {
    const ch = supabase
      .channel(`calls-${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `recipient_id=eq.${myId}` }, async (p) => {
        const s = p.new as { call_id: string; sender_id: string; kind: string; media: CallMedia; payload: RTCSessionDescriptionInit & RTCIceCandidateInit }
        // ignore stale signals (older than 2 minutes) so old invites never ring
        if (Date.now() - new Date((p.new as { created_at: string }).created_at).getTime() > 120_000) return

        if (s.kind === 'invite') {
          if (callRef.current.id) {
            // already busy — tell them
            await send(s.sender_id, s.call_id, 'decline', s.media)
            return
          }
          setIncoming({ callId: s.call_id, from: s.sender_id, media: s.media, offer: s.payload })
          setMedia(s.media)
          setState('ringing')
          return
        }
        if (callRef.current.id !== s.call_id) return

        if (s.kind === 'answer' && pc.current) {
          await pc.current.setRemoteDescription(s.payload).catch(() => {})
          for (const c of pendingIce.current) await pc.current.addIceCandidate(c).catch(() => {})
          pendingIce.current = []
          setState('connecting')
        } else if (s.kind === 'ice') {
          if (pc.current && pc.current.remoteDescription) await pc.current.addIceCandidate(s.payload).catch(() => {})
          else pendingIce.current.push(s.payload)
        } else if (s.kind === 'hangup' || s.kind === 'decline') {
          setError(s.kind === 'decline' ? 'Call declined.' : null)
          teardown()
          callRef.current = { id: null, peer: null, media: 'voice' }
          setIncoming(null)
          setPeerId(null)
          setCallId(null)
          setState('ended')
          setTimeout(() => setState('idle'), 1500)
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [myId, send, teardown])

  // a ringing call that nobody answers ends by itself
  useEffect(() => {
    if (state !== 'calling') return
    const t = setTimeout(() => {
      setError('No answer.')
      endCall(true)
    }, 40_000)
    return () => clearTimeout(t)
  }, [state, endCall])

  const toggleMute = useCallback(() => {
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled))
    setMuted((m) => !m)
  }, [])

  const toggleCam = useCallback(() => {
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled))
    setCamOff((c) => !c)
  }, [])

  // clean up on unmount
  useEffect(() => () => teardown(), [teardown])

  return {
    state,
    media,
    peerId,
    localStream,
    remoteStream,
    muted,
    camOff,
    error,
    incoming,
    startCall,
    acceptCall,
    declineCall,
    endCall: () => endCall(true),
    toggleMute,
    toggleCam,
    dismissError: () => setError(null),
  }
}
