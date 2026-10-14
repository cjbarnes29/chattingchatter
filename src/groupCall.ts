import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { CallMedia, Group } from './social'

const RTC: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
}

type Sig = { to: string; from: string; kind: 'hello' | 'offer' | 'answer' | 'ice' | 'bye'; data?: unknown }
type Chan = ReturnType<typeof supabase.channel>
export type GroupInvite = { groupId: string; groupName: string; fromName: string; media: CallMedia }

/** Group voice/video calls: every participant connects directly to every other one (mesh, fine for small groups).
 *  Signalling travels over realtime broadcast channels, one per group. */
export function useGroupCall(myId: string, myName: string, groups: Group[]) {
  const [active, setActive] = useState<{ groupId: string; media: CallMedia } | null>(null)
  const [invite, setInvite] = useState<GroupInvite | null>(null)
  const [streams, setStreams] = useState<Record<string, MediaStream>>({})
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRef = useRef<typeof active>(null)
  const pcs = useRef(new Map<string, RTCPeerConnection>())
  const pending = useRef(new Map<string, RTCIceCandidateInit[]>())
  const room = useRef<Chan | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const rings = useRef(new Map<string, Chan>())
  const inviteTimer = useRef<number>()
  const groupsRef = useRef(groups)
  groupsRef.current = groups

  const sig = useCallback(
    (to: string, kind: Sig['kind'], data?: unknown) => {
      room.current?.send({ type: 'broadcast', event: 'sig', payload: { to, from: myId, kind, data } satisfies Sig })
    },
    [myId],
  )

  const closePeer = useCallback((peer: string) => {
    pcs.current.get(peer)?.close()
    pcs.current.delete(peer)
    pending.current.delete(peer)
    setStreams((s) => {
      const { [peer]: _gone, ...rest } = s
      void _gone
      return rest
    })
  }, [])

  const makePc = useCallback(
    (peer: string) => {
      closePeer(peer)
      const pc = new RTCPeerConnection(RTC)
      localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!))
      pc.onicecandidate = (e) => {
        if (e.candidate) sig(peer, 'ice', e.candidate.toJSON())
      }
      pc.ontrack = (e) => {
        const s = e.streams[0] ?? new MediaStream([e.track])
        setStreams((prev) => ({ ...prev, [peer]: s }))
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(peer)
      }
      pcs.current.set(peer, pc)
      return pc
    },
    [closePeer, sig],
  )

  const flush = async (peer: string, pc: RTCPeerConnection) => {
    for (const c of pending.current.get(peer) ?? []) await pc.addIceCandidate(c).catch(() => {})
    pending.current.delete(peer)
  }

  const handle = useCallback(
    async (s: Sig) => {
      if (s.from === myId || (s.to !== '*' && s.to !== myId)) return
      const peer = s.from
      try {
        if (s.kind === 'hello') {
          const pc = makePc(peer)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          sig(peer, 'offer', offer)
        } else if (s.kind === 'offer') {
          const ex = pcs.current.get(peer)
          if (ex && ex.signalingState === 'have-local-offer' && myId < peer) return
          const pc = makePc(peer)
          await pc.setRemoteDescription(s.data as RTCSessionDescriptionInit)
          await flush(peer, pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sig(peer, 'answer', answer)
        } else if (s.kind === 'answer') {
          const pc = pcs.current.get(peer)
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(s.data as RTCSessionDescriptionInit)
            await flush(peer, pc)
          }
        } else if (s.kind === 'ice') {
          const pc = pcs.current.get(peer)
          if (pc?.remoteDescription) await pc.addIceCandidate(s.data as RTCIceCandidateInit).catch(() => {})
          else pending.current.set(peer, [...(pending.current.get(peer) ?? []), s.data as RTCIceCandidateInit])
        } else if (s.kind === 'bye') {
          closePeer(peer)
        }
      } catch {
        /* a failed handshake with one person must not end the whole call */
      }
    },
    [myId, makePc, sig, closePeer],
  )

  const leave = useCallback(() => {
    if (room.current) {
      sig('*', 'bye')
      supabase.removeChannel(room.current)
      room.current = null
    }
    Array.from(pcs.current.keys()).forEach(closePeer)
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    setLocal(null)
    setStreams({})
    setMuted(false)
    setCamOff(false)
    activeRef.current = null
    setActive(null)
  }, [sig, closePeer])

  const join = useCallback(
    async (groupId: string, media: CallMedia, announce: boolean) => {
      if (activeRef.current) return
      setError(null)
      setInvite(null)
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: media === 'video' ? { facingMode: 'user' } : false })
      } catch {
        setError('Allow microphone and camera access to join the call.')
        window.setTimeout(() => setError(null), 4000)
        return
      }
      localRef.current = stream
      setLocal(stream)
      activeRef.current = { groupId, media }
      setActive({ groupId, media })
      const ch = supabase.channel(`gcall:${groupId}`, { config: { broadcast: { self: false } } })
      room.current = ch
      ch.on('broadcast', { event: 'sig' }, ({ payload }) => void handle(payload as Sig)).subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        sig('*', 'hello')
        if (announce) {
          const g = groupsRef.current.find((x) => x.id === groupId)
          rings.current.get(groupId)?.send({
            type: 'broadcast',
            event: 'start',
            payload: { from: myId, fromName: myName, groupId, groupName: g?.name ?? 'Group', media },
          })
        }
      })
    },
    [handle, sig, myId, myName],
  )

  // listen on every group for "a call has started"
  const ids = groups.map((g) => g.id).join(',')
  useEffect(() => {
    const wanted = new Set(ids ? ids.split(',') : [])
    rings.current.forEach((ch, id) => {
      if (!wanted.has(id)) {
        supabase.removeChannel(ch)
        rings.current.delete(id)
      }
    })
    wanted.forEach((id) => {
      if (rings.current.has(id)) return
      const ch = supabase.channel(`gring:${id}`, { config: { broadcast: { self: false } } })
      ch.on('broadcast', { event: 'start' }, ({ payload }) => {
        const p = payload as { from: string; fromName: string; groupId: string; groupName: string; media: CallMedia }
        if (p.from === myId || activeRef.current) return
        setInvite({ groupId: p.groupId, groupName: p.groupName, fromName: p.fromName, media: p.media })
        window.clearTimeout(inviteTimer.current)
        inviteTimer.current = window.setTimeout(() => setInvite(null), 60_000)
      }).subscribe()
      rings.current.set(id, ch)
    })
  }, [ids, myId])

  useEffect(
    () => () => {
      rings.current.forEach((ch) => supabase.removeChannel(ch))
      rings.current.clear()
      window.clearTimeout(inviteTimer.current)
      leave()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const toggleMute = useCallback(() => {
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled))
    setMuted((m) => !m)
  }, [])
  const toggleCam = useCallback(() => {
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled))
    setCamOff((c) => !c)
  }, [])

  return {
    active,
    invite,
    streams,
    local,
    muted,
    camOff,
    error,
    start: (groupId: string, media: CallMedia) => join(groupId, media, true),
    acceptInvite: () => invite && join(invite.groupId, invite.media, false),
    decline: () => setInvite(null),
    leave,
    toggleMute,
    toggleCam,
  }
}
