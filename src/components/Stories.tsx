import { useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2, Pencil, Check, Clock, Lock, Globe, ImagePlus, Film, Send, Users, LayoutGrid, Music, Play, Pause, BookImage } from 'lucide-react'
import { STORY_EMOJIS, timeAgo, timeLeft, type ReplyInput, type Story, type StoryReply } from '../social'
import { AUDIENCES } from '../storyDrafts'
import VoiceRecorder from './VoiceRecorder'
import VoiceMessage from './VoiceMessage'

const DAY_OPTIONS = [
  { days: 1, label: '1 day' },
  { days: 2, label: '2 days' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
]

export function StoriesRow({ stories, myAvatar, onOpen, onCreate, onOpenAll }: { stories: Story[]; myAvatar: string; onOpen: (s: Story) => void; onCreate: () => void; onOpenAll?: () => void }) {
  // one bubble per author, showing their newest story
  const byAuthor = new Map<string, Story>()
  stories.forEach((s) => {
    if (!byAuthor.has(s.authorId)) byAuthor.set(s.authorId, s)
  })
  const list = [...byAuthor.values()]
  return (
    <div className="flex gap-4 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none]">
      <button onClick={onCreate} className="flex shrink-0 flex-col items-center gap-1.5">
        <span className="relative">
          <img src={myAvatar} alt="" className="h-14 w-14 rounded-full object-cover opacity-80" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-2 ring-[rgb(var(--bg-panel))]"><Plus size={12} /></span>
        </span>
        <span className="text-[11px] font-medium text-[rgb(var(--text-secondary))]">Your story</span>
      </button>
      {list.map((s) => (
        <button key={s.authorId} onClick={() => onOpen(s)} className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="rounded-full bg-gradient-to-br from-[rgb(var(--accent))] to-amber-400 p-[2px]">
            <img src={s.authorAvatar} alt="" className="h-[52px] w-[52px] rounded-full object-cover ring-2 ring-[rgb(var(--bg-panel))]" />
          </span>
          <span className="max-w-[64px] truncate text-[11px] font-medium">{s.authorName.split(' ')[0]}</span>
        </button>
      ))}
      {onOpenAll && (
        <button onClick={onOpenAll} className="flex shrink-0 flex-col items-center gap-1.5" aria-label="All stories">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--accent))] ring-1 ring-[rgb(var(--border))]"><LayoutGrid size={20} /></span>
          <span className="text-[11px] font-medium text-[rgb(var(--text-secondary))]">All stories</span>
        </button>
      )}
    </div>
  )
}

export function StoryComposer({ onClose, onPost }: { onClose: () => void; onPost: (body: string, days: number) => Promise<{ ok: boolean; error?: string }> }) {
  const [body, setBody] = useState('')
  const [days, setDays] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!body.trim()) return setError('Write something for your story first.')
    setBusy(true)
    const res = await onPost(body.trim(), days)
    setBusy(false)
    if (res.ok) onClose()
    else setError(res.error ?? 'Could not post.')
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[rgb(var(--bg-panel))] p-6 shadow-2xl ring-1 ring-[rgb(var(--border))]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">New story</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]"><X size={18} /></button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={280}
          rows={4}
          placeholder="Share a moment, a thought or a plan…"
          className="w-full rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-4 text-[15px] outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))] placeholder:text-[rgb(var(--text-tertiary))]"
        />
        <p className="mt-1 text-right text-[11px] text-[rgb(var(--text-tertiary))]">{body.length}/280</p>
        <p className="mb-2 mt-3 flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--text-secondary))]"><Clock size={13} /> Visible for</p>
        <div className="grid grid-cols-4 gap-2">
          {DAY_OPTIONS.map((o) => (
            <button
              key={o.days}
              onClick={() => setDays(o.days)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${days === o.days ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]' : 'bg-[rgb(var(--bg-panel-soft))] text-[rgb(var(--text-secondary))]'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
        <button onClick={submit} disabled={busy} className="mt-5 w-full rounded-xl bg-[rgb(var(--accent))] py-3 font-semibold text-[rgb(var(--accent-foreground))] disabled:opacity-60">Share story</button>
      </div>
    </div>
  )
}

type MediaUrl = (key: string) => Promise<string | null>

function useMedia(key: string | null | undefined, mediaUrl?: MediaUrl) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let off = false
    setUrl(null)
    setFailed(false)
    if (!key || !mediaUrl) return
    void mediaUrl(key).then((u) => { if (!off) { if (u) setUrl(u); else setFailed(true) } })
    return () => { off = true }
  }, [key, mediaUrl])
  return { url, failed }
}

function StoryMediaView({ story, mediaUrl, className = '', compact = false }: { story: Story; mediaUrl?: MediaUrl; className?: string; compact?: boolean }) {
  const { url, failed } = useMedia(story.media?.key, mediaUrl)
  if (!story.media) return null
  if (failed) return <div className={`flex aspect-[9/16] items-center justify-center rounded-2xl bg-black/30 text-xs text-white/70 ${className}`}>This story’s media isn’t available.</div>
  if (!url) return <div className={`aspect-[9/16] w-full animate-pulse rounded-2xl bg-white/10 ${className}`} />
  const t = story.media.type
  if (t.startsWith('video/') && compact) return <video src={url} muted playsInline preload="metadata" className={`aspect-[9/16] w-full bg-black object-cover ${className}`} aria-hidden />
  if (t.startsWith('audio/') && compact) return <div className={`flex aspect-[9/16] w-full items-center justify-center bg-black/30 ${className}`}><Music size={36} className="text-white/70" /></div>
  if (t.startsWith('video/')) return <video src={url} controls playsInline loop className={`aspect-[9/16] w-full rounded-2xl bg-black object-contain ${className}`} aria-label={story.caption || 'Video story'} />
  if (t.startsWith('audio/')) return <div className={`flex aspect-[9/16] w-full flex-col items-center justify-center gap-4 rounded-2xl bg-black/30 p-4 ${className}`}><Music size={48} className="text-white/70" /><audio src={url} controls className="w-full" aria-label="Story music" /></div>
  return <img src={url} alt={story.caption || 'Story'} className={`aspect-[9/16] w-full rounded-2xl bg-black object-cover ${className}`} />
}

/** Plays the song attached to a photo/GIF/video story. Starts only when the viewer taps play. */
function StoryMusic({ story, mediaUrl }: { story: Story; mediaUrl?: MediaUrl }) {
  const key = story.media?.music?.key
  const { url } = useMedia(key, mediaUrl)
  const a = useRef<HTMLAudioElement | null>(null)
  const [on, setOn] = useState(false)
  useEffect(() => () => { a.current?.pause() }, [])
  if (!story.media?.music) return null
  const toggle = () => {
    if (!url) return
    if (!a.current) { a.current = new Audio(url); a.current.loop = true; a.current.onpause = () => setOn(false); a.current.onplay = () => setOn(true) }
    if (a.current.paused) void a.current.play().catch(() => {}); else a.current.pause()
  }
  return (
    <button onClick={toggle} disabled={!url} aria-label={on ? 'Pause story music' : 'Play story music'} className="mt-2 flex w-full items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-left text-xs hover:bg-white/20 disabled:opacity-50">
      {on ? <Pause size={14} /> : <Play size={14} />} <Music size={13} /> <span className="min-w-0 flex-1 truncate">{story.media.music.name}</span>
    </button>
  )
}

/** A reply that links one of the replier's own stories. */
function StoryLink({ id, stories, onOpen }: { id: string; stories: Story[]; onOpen?: (s: Story) => void }) {
  const s = stories.find((x) => x.id === id)
  if (!s) return <p className="mt-1 flex items-center gap-1 text-xs italic text-white/60"><BookImage size={12} /> A story that’s no longer available</p>
  return (
    <button onClick={() => onOpen?.(s)} className="mt-1 flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-1.5 text-left text-xs hover:bg-white/20" aria-label={`Open ${s.authorName}’s story`}>
      <BookImage size={14} /> <span className="min-w-0 truncate"><b>{s.authorName.split(' ')[0]}’s story</b> · {s.media ? (s.media.type.startsWith('video/') ? 'video' : s.media.type === 'image/gif' ? 'GIF' : 'photo') : s.body.slice(0, 30)}</span>
    </button>
  )
}

function ReplyMedia({ r, mediaUrl }: { r: StoryReply; mediaUrl?: MediaUrl }) {
  const { url } = useMedia(r.mediaKey, mediaUrl)
  if (!r.mediaKey) return null
  if (r.kind === 'voice') {
    return <VoiceMessage att={{ kind: 'voice', key: r.mediaKey, size: 0, type: r.mediaType ?? 'audio/webm', duration: Number(r.body) || 0, wave: [] }} api={mediaUrl ? { url: mediaUrl, upload: async () => ({ ok: false, error: '' }) } : undefined} fromMe={false} />
  }
  return url ? <img src={url} alt={r.kind === 'gif' ? 'GIF reply' : 'Picture reply'} className="mt-1 max-h-40 rounded-lg" /> : <span className="mt-1 block h-24 w-24 animate-pulse rounded-lg bg-white/10" />
}

export function StoryViewer({
  story,
  myId,
  onClose,
  onReact,
  onEdit,
  onDelete,
  mediaUrl,
  onReply,
  onDeleteReply,
  onPrivateDM,
  allStories = [],
  onOpenStory,
}: {
  story: Story
  myId: string
  onClose: () => void
  onReact: (emoji: string | null) => void
  onEdit: (body: string) => void
  onDelete: () => void
  mediaUrl?: MediaUrl
  onReply?: (r: ReplyInput) => Promise<{ ok: true } | { ok: false; error: string; needsUpdate?: boolean }>
  onDeleteReply?: (id: string) => void
  /** fallback for private text/emoji replies before the stories update: send as a direct message */
  onPrivateDM?: (authorId: string, text: string) => void
  /** every story this person can see, to show "reply with my story" and open linked stories */
  allStories?: Story[]
  onOpenStory?: (s: Story) => void
}) {
  const mine = story.authorId === myId
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(story.body)
  const [reply, setReply] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickMine, setPickMine] = useState(false)
  const picRef = useRef<HTMLInputElement>(null)
  const gifRef = useRef<HTMLInputElement>(null)
  const total = Object.values(story.reactions).reduce((a, b) => a + b, 0)
  // what this person may see: public replies, their own, and (for the author) every reply
  const replies = story.replies.filter((r) => r.isPublic || r.authorId === myId || mine)
  const first = story.authorName.split(' ')[0]

  const send = async (r: ReplyInput) => {
    if (!onReply) return
    setMsg(null)
    setBusy(true)
    const res = await onReply(r)
    setBusy(false)
    if (res.ok) {
      setReply('')
      return setMsg({ ok: true, text: r.isPublic ? 'Reply posted.' : `Sent privately to ${first}.` })
    }
    if (res.needsUpdate && !r.isPublic && (r.kind === 'text' || r.kind === 'emoji') && onPrivateDM && !mine) {
      onPrivateDM(story.authorId, `↪ Replied to your story: ${r.text}`)
      setReply('')
      return setMsg({ ok: true, text: `Sent privately to ${first} as a message.` })
    }
    setMsg({ ok: false, text: res.error })
  }
  const pickMedia = (kind: 'gif' | 'picture') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (kind === 'gif' && f.type !== 'image/gif') return setMsg({ ok: false, text: 'Pick a GIF file.' })
    if (f.size > 2 * 1024 * 1024) return setMsg({ ok: false, text: 'Files can be up to 2 MB.' })
    void send({ kind, media: f, mediaType: f.type, text: reply.trim(), isPublic })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onClick={onClose}>
      <div role="dialog" aria-label={`${mine ? 'Your' : `${first}’s`} story`} onClick={(e) => e.stopPropagation()} className="relative flex max-h-[94vh] w-full max-w-sm flex-col overflow-y-auto rounded-3xl bg-gradient-to-br from-[#2B1D26] via-[#1C1926] to-[#7A2C1C] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <img src={story.authorAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{mine ? 'You' : story.authorName}</p>
            <p className="flex items-center gap-1 text-[11px] text-white/70"><Clock size={11} /> {timeAgo(story.createdAt)} · {timeLeft(story.visibleUntil)}{mine && <> · <Users size={11} /> {AUDIENCES.find((a) => a.id === story.audience)?.label}</>}</p>
          </div>
          {mine && !editing && !story.media && (
            <button onClick={() => setEditing(true)} aria-label="Edit story" className="rounded-full p-2 hover:bg-white/10"><Pencil size={16} /></button>
          )}
          {mine && <button onClick={onDelete} aria-label="Delete story" className="rounded-full p-2 hover:bg-white/10"><Trash2 size={16} /></button>}
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10"><X size={16} /></button>
        </div>

        <StoryMediaView story={story} mediaUrl={mediaUrl} />
        {editing ? (
          <div className="space-y-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={4} className="w-full rounded-2xl bg-white/10 p-4 text-[15px] outline-none" />
            <button onClick={() => { onEdit(text.trim() || story.body); setEditing(false) }} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"><Check size={15} /> Save</button>
          </div>
        ) : story.media ? (
          <>
            {story.caption && <p className="mt-3 whitespace-pre-wrap break-words text-[15px]">{story.caption}</p>}
            <StoryMusic story={story} mediaUrl={mediaUrl} />
          </>
        ) : (
          <p className="min-h-[120px] whitespace-pre-wrap break-words text-lg leading-relaxed">{story.body}</p>
        )}

        <div className="mt-5 border-t border-white/15 pt-4">
          <p className="mb-2 text-xs text-white/70">{total ? `${total} reaction${total > 1 ? 's' : ''}` : 'React to this story'}</p>
          <div className="flex flex-wrap gap-2">
            {STORY_EMOJIS.map((e) => {
              const count = story.reactions[e] ?? 0
              const active = story.myReaction === e
              return (
                <button key={e} onClick={() => onReact(active ? null : e)} aria-pressed={active} aria-label={`React ${e}`} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-base transition hover:scale-110 ${active ? 'bg-white text-black' : 'bg-white/10'}`}>
                  <span>{e}</span>
                  {count > 0 && <span className="text-xs font-semibold">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {(replies.length > 0 || onReply) && (
          <div className="mt-4 border-t border-white/15 pt-4">
            <p className="mb-2 text-xs text-white/70">{replies.length ? `Replies (${replies.length})` : 'Replies'}</p>
            <ul className="space-y-2" aria-label="Replies">
              {replies.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <img src={r.authorAvatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1 rounded-2xl bg-white/10 px-3 py-2">
                    <p className="flex items-center gap-1 text-[11px] text-white/60">
                      {r.authorId === myId ? 'You' : r.authorName} · {timeAgo(r.createdAt)} · {r.isPublic ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
                    </p>
                    {r.kind === 'emoji' ? <p className="text-2xl">{r.body}</p> : r.kind === 'story' ? <StoryLink id={r.body} stories={allStories} onOpen={onOpenStory} /> : r.kind !== 'voice' && r.body && <p className="whitespace-pre-wrap break-words text-sm">{r.body}</p>}
                    <ReplyMedia r={r} mediaUrl={mediaUrl} />
                  </div>
                  {(r.authorId === myId || mine) && onDeleteReply && <button onClick={() => onDeleteReply(r.id)} aria-label="Delete reply" className="rounded-full p-1.5 text-white/60 hover:bg-white/10"><Trash2 size={13} /></button>}
                </li>
              ))}
            </ul>
            {onReply && (
              <div className="mt-3 space-y-2">
                <div role="radiogroup" aria-label="Who sees your reply" className="flex gap-1.5 text-xs">
                  <button role="radio" aria-checked={!isPublic} onClick={() => setIsPublic(false)} className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${!isPublic ? 'bg-white text-black' : 'bg-white/10'}`}><Lock size={11} /> Private{mine ? '' : ` (only ${first})`}</button>
                  <button role="radio" aria-checked={isPublic} onClick={() => setIsPublic(true)} className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${isPublic ? 'bg-white text-black' : 'bg-white/10'}`}><Globe size={11} /> Public (everyone who sees this)</button>
                </div>
                <div className="flex gap-1">
                  {['😍', '😂', '🔥', '👏', '😮', '🥺'].map((e) => <button key={e} disabled={busy} onClick={() => void send({ kind: 'emoji', text: e, isPublic })} aria-label={`Reply ${e}`} className="rounded-full bg-white/10 px-2 py-1 text-lg hover:bg-white/20">{e}</button>)}
                </div>
                {!mine && allStories.some((x) => x.authorId === myId) && (
                  <div>
                    <button onClick={() => setPickMine((o) => !o)} aria-expanded={pickMine} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20"><BookImage size={12} /> Reply with my story</button>
                    {pickMine && (
                      <ul className="mt-1.5 space-y-1" aria-label="My stories">
                        {allStories.filter((x) => x.authorId === myId).map((x) => (
                          <li key={x.id}>
                            <button disabled={busy} onClick={() => { setPickMine(false); void send({ kind: 'story', text: x.id, isPublic }) }} className="flex w-full items-center gap-2 rounded-xl bg-white/10 px-2.5 py-1.5 text-left text-xs hover:bg-white/20">
                              <BookImage size={13} /> <span className="min-w-0 flex-1 truncate">{x.caption || x.body.split('\n')[0].slice(0, 40)}</span> <span className="text-white/50">{timeAgo(x.createdAt)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) void send({ kind: 'text', text: reply.trim(), isPublic }) }} className="relative flex items-center gap-1.5">
                  <input value={reply} onChange={(e) => setReply(e.target.value.slice(0, 500))} placeholder={isPublic ? 'Write a public reply…' : `Reply to ${mine ? 'your story' : first} privately…`} aria-label="Reply" className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/50" />
                  <button type="button" onClick={() => picRef.current?.click()} aria-label="Reply with a picture" className="rounded-full p-2 hover:bg-white/10"><ImagePlus size={17} /></button>
                  <button type="button" onClick={() => gifRef.current?.click()} aria-label="Reply with a GIF" className="rounded-full p-2 hover:bg-white/10"><Film size={17} /></button>
                  {reply.trim() ? (
                    <button type="submit" disabled={busy} aria-label="Send reply" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"><Send size={16} /></button>
                  ) : (
                    <VoiceRecorder onSend={(rec) => void send({ kind: 'voice', media: rec.blob, mediaType: rec.type, text: String(Math.round(rec.duration)), isPublic })} onError={(m) => setMsg({ ok: false, text: m })} />
                  )}
                  <input ref={picRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Pick a picture" onChange={pickMedia('picture')} />
                  <input ref={gifRef} type="file" accept="image/gif" className="sr-only" aria-label="Pick a GIF" onChange={pickMedia('gif')} />
                </form>
                {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Every current story, grouped by person, with the photo/GIF or text as a card. */
export function StoriesPanel({ stories, myId, mediaUrl, onOpen, onCreate, onClose }: { stories: Story[]; myId: string; mediaUrl?: MediaUrl; onOpen: (s: Story) => void; onCreate: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 md:items-center md:p-6">
      <div role="dialog" aria-label="Stories" className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[rgb(var(--bg-panel))] shadow-2xl md:h-auto md:max-h-[92vh] md:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-4 py-3">
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
          <h2 className="flex-1 text-base font-extrabold tracking-tight">Stories</h2>
          <button onClick={onCreate} className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--accent))] px-3.5 py-1.5 text-xs font-bold text-[rgb(var(--accent-foreground))]"><Plus size={14} /> Create story</button>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {stories.length === 0 && <p className="col-span-full py-12 text-center text-sm text-[rgb(var(--text-secondary))]">No stories right now. Share a photo, a GIF or a thought.</p>}
          {stories.map((s) => (
            <button key={s.id} onClick={() => onOpen(s)} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2B1D26] to-[#7A2C1C] text-left text-white" aria-label={`${s.authorId === myId ? 'Your' : `${s.authorName}’s`} story`}>
              {s.media ? <StoryMediaView story={s} mediaUrl={mediaUrl} className="rounded-none" compact /> : <p className="flex aspect-[9/16] items-center justify-center p-4 text-center text-sm font-semibold leading-snug">{s.body.slice(0, 140)}</p>}
              <span className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent p-2">
                <img src={s.authorAvatar} alt="" className="h-6 w-6 rounded-full object-cover ring-2 ring-white/70" />
                <span className="truncate text-[11px] font-semibold">{s.authorId === myId ? 'You' : s.authorName.split(' ')[0]}</span>
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-[10px] text-white/80">
                {timeAgo(s.createdAt)}{s.replies.length ? ` · ${s.replies.length} repl${s.replies.length === 1 ? 'y' : 'ies'}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
