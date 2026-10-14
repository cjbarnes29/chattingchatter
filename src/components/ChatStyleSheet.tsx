import { useRef } from 'react'
import { X, Pin, Star, Image as ImageIcon, Music, Play, Trash2, Check } from 'lucide-react'
import { useChatStyle, setPinColor, setFav, setWallpaper, fileToWallpaper, saveSound, clearSound, playSound, PIN_COLORS, DEFAULT_PIN, WALL_COLORS, WALL_PRESETS } from '../chatStyle'

export function SoundControls({ chatId }: { chatId: string }) {
  const st = useChatStyle()
  const ref = useRef<HTMLInputElement>(null)
  const name = st.soundNames[chatId]
  return (
    <div className="space-y-2">
      <p className="truncate text-xs text-[rgb(var(--text-secondary))]">{name ? `Sound: ${name}` : chatId === 'global' ? 'Using the default chime' : 'Using your main sound'}</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => ref.current?.click()} className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))]"><Music size={13} /> Choose from files</button>
        <button onClick={() => playSound(chatId, true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-[rgb(var(--border))]"><Play size={12} /> Preview</button>
        {name && <button onClick={() => clearSound(chatId)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-500 ring-1 ring-[rgb(var(--border))]"><Trash2 size={12} /> Reset</button>}
      </div>
      <input ref={ref} type="file" accept="audio/*" className="sr-only" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (f) { await saveSound(chatId, f); playSound(chatId, true) }
      }} />
    </div>
  )
}

type Props = { chatId: string; name: string; pinned: boolean; onPin: (v: boolean) => void; onClose: () => void }

export default function ChatStyleSheet({ chatId, name, pinned, onPin, onClose }: Props) {
  const st = useChatStyle()
  const fileRef = useRef<HTMLInputElement>(null)
  const wp = st.wallpapers[chatId]
  const fav = !!st.favs[chatId]
  const pinColor = st.pinColors[chatId] ?? DEFAULT_PIN
  const h = 'mb-2 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-tertiary))]'
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Chat style" onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl md:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="truncate text-lg font-extrabold">{name}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
        </div>

        <button onClick={() => setFav(chatId, !fav)} className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] px-4 py-3 text-left text-sm font-semibold">
          <Star size={17} className={fav ? 'fill-amber-400 text-amber-400' : ''} />
          <span className="flex-1">{fav ? 'In Favorites' : 'Add to Favorites'}</span>
        </button>

        <p className={h}>Pin</p>
        <button onClick={() => onPin(!pinned)} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] px-4 py-3 text-left text-sm font-semibold">
          <Pin size={17} style={pinned ? { color: pinColor } : undefined} />
          <span className="flex-1">{pinned ? 'Pinned to top' : 'Pin to top'}</span>
        </button>
        <div className="mb-5 flex flex-wrap gap-2.5" aria-label="Pin color">
          {PIN_COLORS.map((c) => (
            <button key={c} onClick={() => { setPinColor(chatId, c); if (!pinned) onPin(true) }} aria-label={`Pin color ${c}`} className="flex h-8 w-8 items-center justify-center rounded-full text-white ring-2 ring-offset-2 ring-offset-[rgb(var(--bg-panel))]" style={{ background: c, ['--tw-ring-color' as string]: pinColor === c ? 'rgb(var(--text-primary))' : 'transparent' }}>
              {pinColor === c && <Check size={14} />}
            </button>
          ))}
        </div>

        <p className={h}>Wallpaper</p>
        <div className="mb-2 grid grid-cols-4 gap-2">
          <button onClick={() => setWallpaper(chatId, null)} className={`flex h-16 items-center justify-center rounded-xl bg-[rgb(var(--bg-chat))] text-[11px] font-semibold ring-2 ${!wp ? 'ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))]'}`}>Default</button>
          {WALL_PRESETS.map((p) => (
            <button key={p.id} onClick={() => setWallpaper(chatId, { kind: 'preset', value: p.id })} aria-label={p.label} style={p.css} className={`h-16 rounded-xl ring-2 ${wp?.value === p.id ? 'ring-[rgb(var(--accent))]' : 'ring-transparent'}`} />
          ))}
          <button onClick={() => fileRef.current?.click()} className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-[rgb(var(--bg-panel-soft))] text-[11px] font-semibold ring-2 ${wp?.kind === 'image' ? 'ring-[rgb(var(--accent))]' : 'ring-transparent'}`}
            style={wp?.kind === 'image' ? { backgroundImage: `url(${wp.value})`, backgroundSize: 'cover' } : undefined}>
            <ImageIcon size={16} />{wp?.kind === 'image' ? '' : 'Photo'}
          </button>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {WALL_COLORS.map((c) => (
            <button key={c} onClick={() => setWallpaper(chatId, { kind: 'color', value: c })} aria-label={`Wallpaper ${c}`} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--bg-panel))] ${wp?.value === c ? 'ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))]'}`} style={{ background: c }} />
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) { try { setWallpaper(chatId, { kind: 'image', value: await fileToWallpaper(f) }) } catch { /* ignore */ } }
        }} />

        <p className={h}>Message sound for this chat</p>
        <SoundControls chatId={chatId} />
      </div>
    </div>
  )
}
