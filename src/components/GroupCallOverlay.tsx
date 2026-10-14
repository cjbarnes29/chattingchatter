import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Phone, Video, VideoOff, Users } from 'lucide-react'
import type { GroupInvite } from '../groupCall'
import type { Group } from '../social'

type Props = {
  active: { groupId: string; media: 'voice' | 'video' } | null
  invite: GroupInvite | null
  group: Group | null
  myId: string
  streams: Record<string, MediaStream>
  local: MediaStream | null
  muted: boolean
  camOff: boolean
  error: string | null
  onAccept: () => void
  onDecline: () => void
  onLeave: () => void
  onToggleMute: () => void
  onToggleCam: () => void
}

function Media({ stream, video, mute, mirror }: { stream: MediaStream | null; video: boolean; mute?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={mute} className={`${video ? 'absolute inset-0 h-full w-full object-cover' : 'hidden'} ${mirror ? '-scale-x-100' : ''}`} />
}

function Tile({ name, avatar, stream, video, mute, mirror, you }: { name: string; avatar?: string; stream: MediaStream | null; video: boolean; mute?: boolean; mirror?: boolean; you?: boolean }) {
  const hasVideo = video && !!stream && stream.getVideoTracks().some((t) => t.enabled)
  return (
    <div className="relative flex min-h-[9rem] items-center justify-center overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
      <Media stream={stream} video={hasVideo} mute={mute} mirror={mirror} />
      {!hasVideo && (avatar ? <img src={avatar} alt="" className="h-20 w-20 rounded-full object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-bold">{name.slice(0, 1)}</span>)}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold">{you ? 'You' : name}</span>
    </div>
  )
}

export default function GroupCallOverlay(p: Props) {
  if (p.invite && !p.active) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-[rgb(var(--bg-app))]/95 p-6 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))] ring-4 ring-[rgb(var(--accent))]/40"><Users size={38} /></span>
        <div>
          <p className="text-xl font-bold">{p.invite.groupName}</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">{p.invite.fromName} started a group {p.invite.media} call</p>
        </div>
        <div className="flex items-center gap-10">
          <button onClick={p.onDecline} aria-label="Decline group call" className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg"><PhoneOff size={26} /></button>
          <button onClick={p.onAccept} aria-label="Join group call" className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">{p.invite.media === 'video' ? <Video size={26} /> : <Phone size={26} />}</button>
        </div>
      </div>
    )
  }
  if (!p.active) {
    return p.error ? <div role="alert" className="fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">{p.error}</div> : null
  }
  const video = p.active.media === 'video'
  const ids = Object.keys(p.streams)
  const nameOf = (id: string) => p.group?.members.find((m) => m.id === id)
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0E0C10] text-white">
      <header className="p-4 text-center">
        <p className="font-semibold">{p.group?.name ?? 'Group call'}</p>
        <p className="text-sm text-white/70">{ids.length === 0 ? 'Waiting for others to join…' : `${ids.length + 1} in the call`}</p>
      </header>
      <div className={`grid flex-1 auto-rows-fr gap-3 overflow-y-auto p-3 ${ids.length >= 1 ? 'grid-cols-2' : 'grid-cols-1'} ${ids.length >= 4 ? 'md:grid-cols-3' : ''}`}>
        <Tile name="You" stream={p.local} video={video && !p.camOff} mute mirror you />
        {ids.map((id) => (
          <Tile key={id} name={nameOf(id)?.name ?? 'Member'} avatar={nameOf(id)?.avatar} stream={p.streams[id]} video={video} />
        ))}
      </div>
      {/* voice calls: the audio still needs an element to play through */}
      {!video && ids.map((id) => <Audio key={id} stream={p.streams[id]} />)}
      <div className="flex items-center justify-center gap-5 p-6">
        <button onClick={p.onToggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'} className={`flex h-14 w-14 items-center justify-center rounded-full ${p.muted ? 'bg-white text-black' : 'bg-white/15'}`}>{p.muted ? <MicOff size={22} /> : <Mic size={22} />}</button>
        {video && <button onClick={p.onToggleCam} aria-label={p.camOff ? 'Camera on' : 'Camera off'} className={`flex h-14 w-14 items-center justify-center rounded-full ${p.camOff ? 'bg-white text-black' : 'bg-white/15'}`}>{p.camOff ? <VideoOff size={22} /> : <Video size={22} />}</button>}
        <button onClick={p.onLeave} aria-label="Leave call" className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 shadow-lg"><PhoneOff size={24} /></button>
      </div>
    </div>
  )
}

function Audio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}
