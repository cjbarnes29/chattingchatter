import { useEffect, useRef } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react'
import type { CallMedia, CallState } from '../social'

type Props = {
  state: CallState
  media: CallMedia
  peerName: string
  peerAvatar: string
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  muted: boolean
  camOff: boolean
  error: string | null
  incoming: boolean
  onAccept: () => void
  onDecline: () => void
  onEnd: () => void
  onToggleMute: () => void
  onToggleCam: () => void
  onDismissError: () => void
}

function VideoEl({ stream, mirror = false, muted = false, className = '' }: { stream: MediaStream | null; mirror?: boolean; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} ${mirror ? '-scale-x-100' : ''} bg-black object-cover`} />
}

function AudioEl({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}

const STATUS: Record<CallState, string> = {
  idle: '',
  calling: 'Calling…',
  ringing: 'Incoming call',
  connecting: 'Connecting…',
  connected: 'Connected',
  ended: 'Call ended',
}

export default function CallOverlay(p: Props) {
  if (p.state === 'idle') return null
  const isVideo = p.media === 'video'
  const showCall = p.state !== 'ringing'

  // Incoming ring screen
  if (p.incoming || p.state === 'ringing') {
    return (
      <div className="fixed inset-0 z-[60] safe-overlay flex flex-col items-center justify-center gap-6 bg-[rgb(var(--bg-app))]/95 p-6 text-center backdrop-blur-sm">
        <img src={p.peerAvatar} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-[rgb(var(--accent))]/40" />
        <div>
          <p className="text-xl font-bold">{p.peerName}</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">{isVideo ? 'Incoming video call' : 'Incoming voice call'}</p>
        </div>
        <div className="flex items-center gap-10">
          <button onClick={p.onDecline} aria-label="Decline call" className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:scale-105">
            <PhoneOff size={26} />
          </button>
          <button onClick={p.onAccept} aria-label="Accept call" className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:scale-105">
            {isVideo ? <Video size={26} /> : <Phone size={26} />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] safe-overlay flex flex-col bg-[#0E0C10] text-white">
      <AudioEl stream={p.remoteStream} />
      <div className="relative flex-1 overflow-hidden">
        {isVideo && p.remoteStream ? (
          <VideoEl stream={p.remoteStream} className="absolute inset-0 h-full w-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <img src={p.peerAvatar} alt="" className="h-32 w-32 rounded-full object-cover" />
          </div>
        )}
        {isVideo && p.localStream && !p.camOff && (
          <VideoEl stream={p.localStream} muted mirror className="absolute bottom-4 right-4 h-36 w-24 rounded-xl ring-2 ring-white/30 md:h-44 md:w-32" />
        )}
        <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-5 text-center">
          <p className="font-semibold">{p.peerName}</p>
          <p className="text-sm text-white/70">{p.error ?? STATUS[p.state]}</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-5 bg-[#0E0C10] p-6">
        <button onClick={p.onToggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'} className={`flex h-14 w-14 items-center justify-center rounded-full ${p.muted ? 'bg-white text-black' : 'bg-white/15'}`}>
          {p.muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        {isVideo && (
          <button onClick={p.onToggleCam} aria-label={p.camOff ? 'Turn camera on' : 'Turn camera off'} className={`flex h-14 w-14 items-center justify-center rounded-full ${p.camOff ? 'bg-white text-black' : 'bg-white/15'}`}>
            {p.camOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}
        <button onClick={p.onEnd} aria-label="End call" className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 shadow-lg transition hover:scale-105">
          <PhoneOff size={24} />
        </button>
      </div>
      {p.error && p.state === 'ended' && (
        <button onClick={p.onDismissError} className="absolute bottom-28 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-sm">Close</button>
      )}
    </div>
  )
}
