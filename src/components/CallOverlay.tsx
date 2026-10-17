import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Minimize2, SwitchCamera, Volume2, MessageSquare } from 'lucide-react'
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
  onFlipCamera: () => void
  onOpenChat: () => void
  minimized: boolean
  onMinimize: () => void
  onRestore: () => void
  connectedAt: number | null
}

function VideoEl({ stream, mirror = false, muted = false, className = '' }: { stream: MediaStream | null; mirror?: boolean; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} ${mirror ? '-scale-x-100' : ''} bg-black object-cover`} />
}

type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }

function AudioEl({ stream, speaker }: { stream: MediaStream | null; speaker: boolean }) {
  const ref = useRef<SinkAudio>(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  // route to loudspeaker or earpiece where the browser lets us choose
  useEffect(() => {
    const el = ref.current
    if (!el?.setSinkId || !navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const outs = devs.filter((d) => d.kind === 'audiooutput')
      const target = speaker ? outs.find((d) => /speaker/i.test(d.label)) : outs.find((d) => /earpiece|phone|default/i.test(d.label))
      if (target) el.setSinkId?.(target.deviceId).catch(() => {})
    }).catch(() => {})
  }, [speaker, stream])
  return <audio ref={ref} autoPlay />
}

function fmt(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function Timer({ since }: { since: number | null }) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!since) return
    const i = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [since])
  return <>{since ? fmt(Date.now() - since) : ''}</>
}

const STATUS: Record<CallState, string> = {
  idle: '',
  calling: 'Calling…',
  ringing: 'Incoming call',
  connecting: 'Connecting…',
  connected: 'Connected',
  ended: 'Call ended',
}

function RoundBtn({ on = false, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${on ? 'bg-white text-black' : 'bg-white/15'}`}>
      {children}
    </button>
  )
}

export default function CallOverlay(p: Props) {
  const [speaker, setSpeaker] = useState(false)
  if (p.state === 'idle') return null
  const isVideo = p.media === 'video'
  const label = p.error ?? (p.state === 'connected' ? undefined : STATUS[p.state])

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

  // The audio element stays mounted while minimized so the call keeps playing
  const audio = <AudioEl stream={p.remoteStream} speaker={speaker} />

  if (p.minimized) {
    return (
      <>
        {audio}
        <div className="fixed left-1/2 top-[calc(var(--sat)+0.5rem)] z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#0E0C10] py-1.5 pl-4 pr-1.5 text-sm text-white shadow-xl ring-1 ring-white/20">
          <button onClick={p.onRestore} className="flex items-center gap-2" aria-label="Return to call">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="max-w-[10rem] truncate font-semibold">{p.peerName}</span>
            <span className="tabular-nums text-white/70">{label ?? <Timer since={p.connectedAt} />}</span>
          </button>
          <button onClick={p.onEnd} aria-label="End call" className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500"><PhoneOff size={16} /></button>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] safe-overlay flex flex-col bg-[#0E0C10] text-white">
      {audio}
      <div className="relative flex-1 overflow-hidden">
        {isVideo && p.remoteStream ? (
          <VideoEl muted stream={p.remoteStream} className="absolute inset-0 h-full w-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <img src={p.peerAvatar} alt="" className="h-32 w-32 rounded-full object-cover" />
          </div>
        )}
        {isVideo && p.localStream && !p.camOff && (
          <VideoEl stream={p.localStream} muted mirror className="absolute bottom-4 right-4 h-36 w-24 rounded-xl ring-2 ring-white/30 md:h-44 md:w-32" />
        )}
        <div className="absolute left-0 right-0 top-0 flex items-start gap-2 bg-gradient-to-b from-black/60 to-transparent p-4">
          <button onClick={p.onMinimize} aria-label="Minimize call" title="Minimize" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><Minimize2 size={18} /></button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-semibold">{p.peerName}</p>
            <p className="text-sm tabular-nums text-white/70" role="status">{label ?? <Timer since={p.connectedAt} />}</p>
          </div>
          <button onClick={p.onOpenChat} aria-label="Open chat" title="Open chat" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><MessageSquare size={18} /></button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 bg-[#0E0C10] px-4 pt-5 pb-6">
        <RoundBtn on={p.muted} label={p.muted ? 'Unmute' : 'Mute'} onClick={p.onToggleMute}>{p.muted ? <MicOff size={22} /> : <Mic size={22} />}</RoundBtn>
        <RoundBtn on={speaker} label={speaker ? 'Use earpiece' : 'Use speaker'} onClick={() => setSpeaker((v) => !v)}><Volume2 size={22} /></RoundBtn>
        {isVideo && (
          <>
            <RoundBtn on={p.camOff} label={p.camOff ? 'Turn camera on' : 'Turn camera off'} onClick={p.onToggleCam}>{p.camOff ? <VideoOff size={22} /> : <Video size={22} />}</RoundBtn>
            <RoundBtn label="Switch camera" onClick={p.onFlipCamera}><SwitchCamera size={22} /></RoundBtn>
          </>
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
