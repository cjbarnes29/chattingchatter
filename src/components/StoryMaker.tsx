import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, ImagePlus, Type, Smile, Save, FolderOpen, Trash2, Sparkles, Download, Send, Palette, Users, Check, Loader2, LayoutTemplate } from 'lucide-react'
import EmojiPicker from './EmojiPicker'
import { DEFAULT_EDITS, EFFECTS, H, MAX_PHOTOS, MAX_STORY_BYTES, MOTIONS, W, buildFrames, loadPhoto, renderGif, renderStill, type Photo, type StoryEdits } from '../storyMaker'
import { AUDIENCES, audienceIds, deleteDraft, deleteTemplate, listDrafts, listTemplates, readCloseFriends, saveCloseFriends, saveDraft, saveTemplate, type Audience, type Draft, type Template } from '../storyDrafts'
import { saveFromUrl } from '../attachmentStore'
import { MAX_MUSIC_BYTES, MAX_VIDEO_BYTES } from '../storyFormat'
import { Music, Video } from 'lucide-react'

type Person = { id: string; name: string; avatar: string }
type PostResult = { ok: true } | { ok: false; error: string; needsUpdate?: boolean }
type Props = {
  myId: string
  people: Person[]
  onClose: () => void
  onPost: (caption: string, days: number, opts: { media?: Blob; mediaType?: string; music?: Blob; musicName?: string; audience?: Audience; audienceIds?: string[] }) => Promise<PostResult>
}

const COLORS = ['#FFFFFF', '#111111', '#FFD95A', '#FF4F6D', '#7CF5C0', '#7AB8FF', '#C38BFF']
const DAYS = [1, 2, 3, 7]
const uid = () => Math.random().toString(36).slice(2, 9)
const chip = (on: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${on ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] ring-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))] ring-[rgb(var(--border))]'}`

/** Story Maker: gallery photos → animated GIF or picture, with text, stickers and effects;
 *  drafts and reusable templates; and who can see the story. */
export default function StoryMaker({ myId, people, onClose, onPost }: Props) {
  const [photos, setPhotos] = useState<{ blob: Blob; img: Photo }[]>([])
  const [gifFile, setGifFile] = useState<Blob | null>(null) // a ready-made GIF, posted as it is
  const [video, setVideo] = useState<File | null>(null) // a video, posted as it is
  const [music, setMusic] = useState<File | null>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const musicRef = useRef<HTMLInputElement>(null)
  const [edits, setEdits] = useState<StoryEdits>(DEFAULT_EDITS)
  const [format, setFormat] = useState<'gif' | 'picture'>('gif')
  const [caption, setCaption] = useState('')
  const [days, setDays] = useState(1)
  const [audience, setAudience] = useState<Audience>('contacts')
  const [picked, setPicked] = useState<string[]>([])
  const [close, setClose] = useState(() => readCloseFriends(myId))
  const [sel, setSel] = useState<string | null>(null)
  const [panel, setPanel] = useState<'look' | 'text' | 'audience' | null>('look')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [templates, setTemplates] = useState<Template[]>(() => listTemplates(myId))
  const [tplName, setTplName] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ id: string; kind: 'text' | 'sticker' } | null>(null)

  const flash = (ok: boolean, text: string) => setMsg({ ok, text })
  const update = (patch: Partial<StoryEdits>) => setEdits((e) => ({ ...e, ...patch }))
  const effectiveFormat = photos.length === 1 ? format : 'gif'
  const selText = edits.texts.find((t) => t.id === sel)

  const addFiles = async (files: File[]) => {
    setMsg(null)
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return flash(false, 'Pick photos or a GIF.')
    if (imgs.length === 1 && imgs[0].type === 'image/gif' && !photos.length) {
      if (imgs[0].size > MAX_STORY_BYTES) return flash(false, 'That GIF is over 2 MB.')
      setGifFile(imgs[0])
      return
    }
    const room = MAX_PHOTOS - photos.length
    if (imgs.length > room) flash(false, `Up to ${MAX_PHOTOS} photos; the first ${room} were added.`)
    const loaded: { blob: Blob; img: Photo }[] = []
    for (const f of imgs.slice(0, room)) {
      try { loaded.push({ blob: f, img: await loadPhoto(f) }) } catch { flash(false, `“${f.name}” couldn’t be opened.`) }
    }
    setGifFile(null)
    setVideo(null)
    setPhotos((p) => [...p, ...loaded])
  }

  // live preview: plays the same frames the GIF will have
  const frames = useMemo(() => buildFrames(photos.map((p) => p.img), effectiveFormat === 'picture' ? { ...edits, motion: 'none' } : edits), [photos, edits, effectiveFormat])
  useEffect(() => {
    const c = canvas.current
    if (!c || !frames.length) return
    const ctx = c.getContext('2d')!
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const step = () => {
      frames[i % frames.length].draw(ctx, W, H)
      t = setTimeout(step, frames[i % frames.length].delay)
      i++
    }
    step()
    return () => clearTimeout(t)
  }, [frames])

  // drag text and stickers on the preview
  const toFrac = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const onDown = (e: React.PointerEvent) => {
    const p = toFrac(e)
    const near = (x: number, y: number, r: number) => Math.hypot((x - p.x) * W, (y - p.y) * H) < r
    const st = [...edits.stickers].reverse().find((s) => near(s.x, s.y, s.size * 0.7))
    const tx = [...edits.texts].reverse().find((t) => near(t.x, t.y, Math.max(40, t.size * 1.5)))
    const hit = st ? { id: st.id, kind: 'sticker' as const } : tx ? { id: tx.id, kind: 'text' as const } : null
    if (!hit) return setSel(null)
    drag.current = hit
    setSel(hit.id)
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = toFrac(e)
    if (d.kind === 'sticker') update({ stickers: edits.stickers.map((s) => (s.id === d.id ? { ...s, ...p } : s)) })
    else update({ texts: edits.texts.map((t) => (t.id === d.id ? { ...t, ...p } : t)) })
  }

  const addText = () => {
    const t = { id: uid(), text: 'Your text', x: 0.5, y: 0.25 + 0.1 * (edits.texts.length % 5), size: 30, color: '#FFFFFF', bg: true }
    update({ texts: [...edits.texts, t] })
    setSel(t.id)
    setPanel('text')
  }
  const removeSelected = () => {
    update({ texts: edits.texts.filter((t) => t.id !== sel), stickers: edits.stickers.filter((s) => s.id !== sel) })
    setSel(null)
  }

  const render = useCallback(async (): Promise<{ blob: Blob; type: string } | null> => {
    if (gifFile) return { blob: gifFile, type: 'image/gif' }
    if (!photos.length) return null
    setBusy('Making your story… 0%')
    try {
      if (effectiveFormat === 'picture') return { blob: await renderStill(photos[0].img, edits), type: 'image/jpeg' }
      return { blob: await renderGif(photos.map((p) => p.img), edits, (p) => setBusy(`Making your GIF… ${Math.round(p * 100)}%`)), type: 'image/gif' }
    } finally {
      setBusy(null)
    }
  }, [gifFile, photos, effectiveFormat, edits])

  const pickVideo = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('video/')) return flash(false, 'Pick a video file.')
    if (f.size > MAX_VIDEO_BYTES) return flash(false, `That video is ${(f.size / 1048576).toFixed(1)} MB. Videos can be up to 8 MB.`)
    setMsg(null); setPhotos([]); setGifFile(null); setVideo(f)
  }
  const pickMusic = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('audio/')) return flash(false, 'Pick an audio file (MP3, M4A, OGG…).')
    if (f.size > MAX_MUSIC_BYTES) return flash(false, `That song is ${(f.size / 1048576).toFixed(1)} MB. Music can be up to 4 MB.`)
    setMsg(null); setMusic(f)
  }

  const post = async () => {
    setMsg(null)
    if (!photos.length && !gifFile && !video && !music && !caption.trim()) return flash(false, 'Add photos, a video, a GIF, music or some text first.')
    let media: { blob: Blob; type: string } | null = null
    try { media = video ? { blob: video, type: video.type } : await render() } catch (e) { return flash(false, (e as Error).message) }
    setBusy('Posting…')
    const r = await onPost(caption.trim(), days, { media: media?.blob, mediaType: media?.type, music: music ?? undefined, musicName: music?.name.replace(/\.[^.]+$/, ''), audience, audienceIds: audienceIds(myId, audience, picked) })
    setBusy(null)
    if (!r.ok) return flash(false, r.error + (r.needsUpdate && (photos.length || gifFile) ? ' Your work is kept: tap “Save draft” or “Save to device”.' : ''))
    if (draftId) await deleteDraft(draftId).catch(() => {})
    onClose()
  }

  const saveToDevice = async () => {
    setMsg(null)
    try {
      const m = await render()
      if (!m) return flash(false, 'Add photos first.')
      const url = URL.createObjectURL(m.blob)
      await saveFromUrl(url, `chatter-story.${m.type === 'image/gif' ? 'gif' : 'jpg'}`, m.type)
      URL.revokeObjectURL(url)
      flash(true, `Saved (${Math.round(m.blob.size / 1024)} KB).`)
    } catch (e) {
      flash(false, (e as Error).message)
    }
  }

  const saveAsDraft = async () => {
    const id = draftId ?? `d${Date.now().toString(36)}`
    try {
      await saveDraft({ id, owner: myId, updatedAt: Date.now(), photos: gifFile ? [gifFile] : photos.map((p) => p.blob), edits, caption, audience, picked, days, format, video: video ?? undefined, music: music ?? undefined, musicName: music?.name })
      setDraftId(id)
      flash(true, 'Draft saved on this device.')
    } catch {
      flash(false, 'Couldn’t save the draft. Storage may be full.')
    }
  }
  const openDraft = async (d: Draft) => {
    setDrafts(null)
    setDraftId(d.id)
    setEdits(d.edits)
    setCaption(d.caption)
    setAudience(d.audience)
    setPicked(d.picked)
    setDays(d.days)
    setFormat(d.format ?? 'gif')
    setMusic(d.music ? new File([d.music], d.musicName ?? 'song', { type: d.music.type }) : null)
    if (d.video) { setPhotos([]); setGifFile(null); setVideo(new File([d.video], 'video', { type: d.video.type })); return }
    setVideo(null)
    if (d.photos.length === 1 && d.photos[0].type === 'image/gif') { setPhotos([]); setGifFile(d.photos[0]); return }
    setGifFile(null)
    const loaded: { blob: Blob; img: Photo }[] = []
    for (const b of d.photos) { try { loaded.push({ blob: b, img: await loadPhoto(b) }) } catch { /* skip */ } }
    setPhotos(loaded)
  }

  if (drafts) {
    return (
      <Shell title="Drafts" onClose={() => setDrafts(null)}>
        <div className="space-y-2 p-4">
          {drafts.length === 0 && <p className="py-8 text-center text-sm text-[rgb(var(--text-secondary))]">No drafts yet.</p>}
          {drafts.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-2.5">
              <DraftThumb blob={d.photos[0]} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.caption || `${d.photos.length} photo${d.photos.length === 1 ? '' : 's'}`}</p>
                <p className="text-xs text-[rgb(var(--text-secondary))]">{new Date(d.updatedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button onClick={() => void openDraft(d)} className="rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--accent-foreground))]">Open</button>
              <button onClick={async () => { await deleteDraft(d.id); setDrafts(await listDrafts(myId)) }} aria-label="Delete draft" className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </Shell>
    )
  }

  const hasMedia = photos.length > 0 || !!gifFile || !!video
  return (
    <Shell
      title="New story"
      onClose={onClose}
      right={<button onClick={async () => setDrafts(await listDrafts(myId).catch(() => []))} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-[rgb(var(--border))]"><FolderOpen size={13} /> Drafts</button>}
    >
      <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Pick photos" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void addFiles(f) }} />
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
        <div className="mx-auto w-[min(17rem,70vw)] shrink-0">
          {gifFile ? (
            <GifPreview blob={gifFile} />
          ) : video ? (
            <div>
              <VideoPreview file={video} />
              <button onClick={() => setVideo(null)} className="mt-2 text-xs font-semibold text-rose-500">Remove video</button>
            </div>
          ) : photos.length ? (
            <canvas ref={canvas} width={W} height={H} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null }} className="aspect-[9/16] w-full touch-none rounded-2xl bg-black shadow-lg" aria-label="Story preview. Drag text and stickers to move them." data-testid="story-preview" />
          ) : (
            <button onClick={() => fileRef.current?.click()} className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--bg-panel-soft))] text-sm text-[rgb(var(--text-secondary))] ring-2 ring-dashed ring-[rgb(var(--border))]">
              <ImagePlus size={30} className="text-[rgb(var(--accent))]" />
              Pick photos or a GIF
              <span className="text-[11px]">Several photos become an animated GIF</span>
            </button>
          )}
          {!photos.length && !gifFile && !video && (
            <button onClick={() => videoRef.current?.click()} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold ring-1 ring-[rgb(var(--border))]"><Video size={14} /> Or pick a video (up to 8 MB)</button>
          )}
          {photos.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto" aria-label="Photos">
              {photos.map((p, i) => (
                <span key={i} className="relative shrink-0">
                  <DraftThumb blob={p.blob} small />
                  <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`} className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"><X size={10} /></button>
                </span>
              ))}
              {photos.length < MAX_PHOTOS && <button onClick={() => fileRef.current?.click()} aria-label="Add photos" className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md ring-1 ring-[rgb(var(--border))]"><ImagePlus size={14} /></button>}
            </div>
          )}
          {gifFile && <button onClick={() => setGifFile(null)} className="mt-2 text-xs font-semibold text-rose-500">Remove GIF</button>}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {photos.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setPanel(panel === 'look' ? null : 'look')} className={chip(panel === 'look')}><Palette size={12} className="mr-1 inline" />Effects</button>
                <button onClick={addText} className={chip(false)}><Type size={12} className="mr-1 inline" />Add text</button>
                <span className="relative">
                  <button onClick={() => setEmojiOpen((o) => !o)} className={chip(emojiOpen)}><Smile size={12} className="mr-1 inline" />Sticker</button>
                  {emojiOpen && <EmojiPicker scope="story" className="absolute left-0 top-9" onClose={() => setEmojiOpen(false)} onPick={(e) => { const s = { id: uid(), emoji: e, x: 0.5, y: 0.6, size: 64 }; update({ stickers: [...edits.stickers, s] }); setSel(s.id); setEmojiOpen(false) }} />}
                </span>
                {sel && <button onClick={removeSelected} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-500 ring-1 ring-rose-500/40"><Trash2 size={12} className="mr-1 inline" />Remove selected</button>}
              </div>
              {photos.length === 1 && (
                <div role="radiogroup" aria-label="Format" className="flex gap-1.5">
                  <button role="radio" aria-checked={format === 'picture'} onClick={() => setFormat('picture')} className={chip(format === 'picture')}>Picture</button>
                  <button role="radio" aria-checked={format === 'gif'} onClick={() => setFormat('gif')} className={chip(format === 'gif')}>Animated GIF</button>
                </div>
              )}
              {panel === 'look' && (
                <div className="space-y-2 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3">
                  <p className="text-xs font-semibold">Effect</p>
                  <div className="flex gap-1.5 overflow-x-auto">{EFFECTS.map((f) => <button key={f.id} onClick={() => update({ effect: f.id })} aria-pressed={edits.effect === f.id} className={chip(edits.effect === f.id)}>{f.label}</button>)}</div>
                  {effectiveFormat === 'gif' && (
                    <>
                      <p className="text-xs font-semibold">Motion</p>
                      <div className="flex gap-1.5 overflow-x-auto">{MOTIONS.map((m) => <button key={m.id} onClick={() => update({ motion: m.id })} aria-pressed={edits.motion === m.id} className={chip(edits.motion === m.id)}>{m.label}</button>)}</div>
                      <label className="flex items-center gap-2 text-xs font-semibold">Speed
                        <input type="range" min={300} max={2500} step={100} value={edits.frameMs} onChange={(e) => update({ frameMs: +e.target.value })} aria-label="Time per photo" className="flex-1 accent-[rgb(var(--accent))]" />
                        <span className="w-10 text-right tabular-nums">{(edits.frameMs / 1000).toFixed(1)}s</span>
                      </label>
                    </>
                  )}
                </div>
              )}
              {selText && (
                <div className="space-y-2 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3">
                  <textarea value={selText.text} onChange={(e) => update({ texts: edits.texts.map((t) => (t.id === sel ? { ...t, text: e.target.value.slice(0, 120) } : t)) })} rows={2} aria-label="Story text" className="w-full resize-none rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-1.5 text-sm outline-none ring-1 ring-[rgb(var(--border))]" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {COLORS.map((c) => <button key={c} onClick={() => update({ texts: edits.texts.map((t) => (t.id === sel ? { ...t, color: c } : t)) })} aria-label={`Text colour ${c}`} aria-pressed={selText.color === c} className={`h-6 w-6 rounded-full ring-2 ${selText.color === c ? 'ring-[rgb(var(--accent))]' : 'ring-[rgb(var(--border))]'}`} style={{ background: c }} />)}
                    <label className="ml-2 flex items-center gap-1 text-xs"><input type="checkbox" checked={selText.bg} onChange={(e) => update({ texts: edits.texts.map((t) => (t.id === sel ? { ...t, bg: e.target.checked } : t)) })} /> Background</label>
                  </div>
                  <input type="range" min={16} max={64} value={selText.size} onChange={(e) => update({ texts: edits.texts.map((t) => (t.id === sel ? { ...t, size: +e.target.value } : t)) })} aria-label="Text size" className="w-full accent-[rgb(var(--accent))]" />
                  <p className="text-[11px] text-[rgb(var(--text-tertiary))]">Drag the text on the preview to move it.</p>
                </div>
              )}
              <div className="space-y-2 rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold"><LayoutTemplate size={13} /> Reuse edits</p>
                <div className="flex flex-wrap gap-1.5">
                  {templates.map((t) => (
                    <span key={t.id} className="flex items-center rounded-full ring-1 ring-[rgb(var(--border))]">
                      <button onClick={() => { setEdits(JSON.parse(JSON.stringify(t.edits))); flash(true, `Applied “${t.name}”.`) }} className="px-3 py-1 text-xs font-semibold">{t.name}</button>
                      <button onClick={() => { deleteTemplate(myId, t.id); setTemplates(listTemplates(myId)) }} aria-label={`Delete template ${t.name}`} className="pr-2 text-[rgb(var(--text-tertiary))]"><X size={11} /></button>
                    </span>
                  ))}
                  {templates.length === 0 && <span className="text-[11px] text-[rgb(var(--text-tertiary))]">Save these edits as a template to use them on other photos.</span>}
                </div>
                <div className="flex gap-1.5">
                  <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name" aria-label="Template name" maxLength={30} className="min-w-0 flex-1 rounded-lg bg-[rgb(var(--bg-panel))] px-2.5 py-1.5 text-xs outline-none ring-1 ring-[rgb(var(--border))]" />
                  <button onClick={() => { saveTemplate(myId, tplName, edits); setTemplates(listTemplates(myId)); setTplName(''); flash(true, 'Template saved.') }} className="rounded-lg px-3 text-xs font-semibold ring-1 ring-[rgb(var(--border))]"><Sparkles size={12} className="mr-1 inline" />Save as template</button>
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold"><Music size={13} /> Music</p>
            {music ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">🎵 {music.name.replace(/\.[^.]+$/, '')}</span>
                <MusicPreview file={music} />
                <button onClick={() => setMusic(null)} aria-label="Remove music" className="rounded-full p-1.5 text-rose-500 hover:bg-rose-500/10"><Trash2 size={14} /></button>
              </div>
            ) : (
              <button onClick={() => musicRef.current?.click()} className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-[rgb(var(--border))]">Add a song from your phone (up to 4 MB)</button>
            )}
            <p className="mt-1.5 text-[11px] text-[rgb(var(--text-tertiary))]">Only add music you’re allowed to share. People who view the story can play it.</p>
          </div>
          <input ref={videoRef} type="file" accept="video/*" className="sr-only" aria-label="Pick a video" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickVideo(f) }} />
          <input ref={musicRef} type="file" accept="audio/*" className="sr-only" aria-label="Pick a song" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickMusic(f) }} />
          <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, hasMedia ? 200 : 280))} rows={hasMedia ? 2 : 4} placeholder={hasMedia ? 'Add a caption (optional)' : 'Or write a text story…'} aria-label="Caption" className="w-full resize-none rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]" />

          <div className="rounded-2xl bg-[rgb(var(--bg-panel-soft))] p-3">
            <button onClick={() => setPanel(panel === 'audience' ? null : 'audience')} className="flex w-full items-center gap-2 text-left text-xs font-semibold">
              <Users size={13} /> Who can see it: <span className="text-[rgb(var(--accent))]">{AUDIENCES.find((a) => a.id === audience)?.label}</span>
            </button>
            {panel === 'audience' && (
              <div className="mt-2 space-y-1.5">
                <div role="radiogroup" aria-label="Who can see this story" className="space-y-1">
                  {AUDIENCES.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-start gap-2 text-xs">
                      <input type="radio" name="aud" checked={audience === a.id} onChange={() => setAudience(a.id)} className="mt-0.5 accent-[rgb(var(--accent))]" />
                      <span><b>{a.label}</b> <span className="text-[rgb(var(--text-secondary))]">· {a.desc}</span></span>
                    </label>
                  ))}
                </div>
                {audience !== 'contacts' && (
                  <div className="max-h-44 overflow-y-auto rounded-xl bg-[rgb(var(--bg-panel))] p-2" aria-label={audience === 'close' ? 'Close friends' : 'People'}>
                    {people.length === 0 && <p className="p-2 text-xs text-[rgb(var(--text-secondary))]">No contacts yet.</p>}
                    {people.map((p) => {
                      const on = audience === 'close' ? close.includes(p.id) : picked.includes(p.id)
                      const toggle = () => {
                        if (audience === 'close') { const next = on ? close.filter((x) => x !== p.id) : [...close, p.id]; setClose(next); saveCloseFriends(myId, next) }
                        else setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])
                      }
                      return (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[rgb(var(--bg-panel-soft))]">
                          <input type="checkbox" checked={on} onChange={toggle} className="accent-[rgb(var(--accent))]" aria-label={p.name} />
                          <img src={p.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                          {p.name}
                        </label>
                      )
                    })}
                  </div>
                )}
                {audience === 'close' && <p className="text-[11px] text-[rgb(var(--text-tertiary))]">Your close-friends list is saved and reused for future stories.</p>}
              </div>
            )}
          </div>

          <div role="radiogroup" aria-label="Visible for" className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold">Visible for</span>
            {DAYS.map((d) => <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={chip(days === d)}>{d} day{d > 1 ? 's' : ''}</button>)}
          </div>

          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{msg.text}</p>}
          {busy && <p role="status" className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-secondary))]"><Loader2 size={13} className="animate-spin" /> {busy}</p>}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => void post()} disabled={!!busy} className="flex items-center gap-1.5 rounded-xl bg-[rgb(var(--accent))] px-4 py-2.5 text-sm font-bold text-[rgb(var(--accent-foreground))] disabled:opacity-50"><Send size={15} /> Share story</button>
            {(hasMedia || !!music) && <button onClick={() => void saveAsDraft()} disabled={!!busy} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ring-[rgb(var(--border))]"><Save size={15} /> Save draft</button>}
            {photos.length > 0 && <button onClick={() => void saveToDevice()} disabled={!!busy} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ring-[rgb(var(--border))]"><Download size={15} /> Save to device</button>}
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ title, onClose, right, children }: { title: string; onClose: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-stretch justify-center bg-black/50 md:items-center md:p-6">
      <div role="dialog" aria-label={title} className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[rgb(var(--bg-panel))] shadow-2xl md:h-auto md:max-h-[92vh] md:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-4 py-3">
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
          <h2 className="flex-1 text-base font-extrabold tracking-tight">{title}</h2>
          {right}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
function DraftThumb({ blob, small }: { blob?: Blob; small?: boolean }) {
  const url = useObjectUrl(blob)
  return url ? <img src={url} alt="" className={`${small ? 'h-12 w-9' : 'h-16 w-12'} shrink-0 rounded-md object-cover`} /> : <span className={`${small ? 'h-12 w-9' : 'h-16 w-12'} shrink-0 rounded-md bg-[rgb(var(--border))]`} />
}
function VideoPreview({ file }: { file: Blob }) {
  const url = useObjectUrl(file)
  return url ? <video src={url} controls playsInline className="aspect-[9/16] w-full rounded-2xl bg-black object-contain" aria-label="Your video" /> : null
}
function MusicPreview({ file }: { file: Blob }) {
  const url = useObjectUrl(file)
  return url ? <audio src={url} controls className="h-8 w-40" aria-label="Preview the song" /> : null
}
function GifPreview({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob)
  return (
    <div className="relative">
      {url && <img src={url} alt="Your GIF" className="aspect-[9/16] w-full rounded-2xl bg-black object-contain" />}
      <p className="mt-1 flex items-center gap-1 text-[11px] text-[rgb(var(--text-tertiary))]"><Check size={11} /> Posted as it is; add a caption below.</p>
    </div>
  )
}
