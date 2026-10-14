import { useState } from 'react'
import { Reply, Tag, Pencil, Clock, Copy, Trash2, X, Camera, RotateCcw, Check } from 'lucide-react'
import { TagPicker, type TagId } from './Innovations'
import { editMessage, resetMessage, editPerson, resetPerson, fileToAvatar, type MsgEdit } from '../edits'

const REACTIONS = ['❤️', '😂', '👍', '🔥', '😮', '😢']
const field = 'w-full rounded-xl bg-[rgb(var(--bg-panel-soft))] px-3.5 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-[rgb(var(--accent))]'
const btnPrimary = 'rounded-xl bg-[rgb(var(--accent))] px-4 py-2.5 text-sm font-semibold text-[rgb(var(--accent-foreground))]'

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[rgb(var(--bg-panel))] p-5 shadow-2xl ring-1 ring-[rgb(var(--border))] sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold tracking-tight">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--accent-soft))]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

type MsgProps = {
  id: string
  text: string
  time: string
  edit?: MsgEdit
  tags: TagId[]
  gestures: { longPress: boolean }
  onClose: () => void
  onReply: () => void
}

export function MessageSheet({ id, text, time, edit, tags, onClose, onReply }: MsgProps) {
  const [mode, setMode] = useState<'menu' | 'text' | 'time' | 'tags'>('menu')
  const [t, setT] = useState(text)
  const [tm, setTm] = useState(/^\d{2}:\d{2}$/.test(time) ? time : '12:00')

  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-[rgb(var(--bg-panel-soft))]'
  return (
    <Sheet title={mode === 'menu' ? 'Message' : mode === 'text' ? 'Edit message' : mode === 'time' ? 'Edit time' : 'Tags'} onClose={onClose}>
      {mode === 'menu' && (
        <>
          <div className="mb-2 flex justify-between rounded-2xl bg-[rgb(var(--bg-panel-soft))] px-3 py-2">
            {REACTIONS.map((r) => (
              <button key={r} onClick={() => { editMessage(id, { reaction: edit?.reaction === r ? undefined : r }); onClose() }} aria-label={`React ${r}`} className={`rounded-full p-1.5 text-2xl transition active:scale-90 ${edit?.reaction === r ? 'bg-[rgb(var(--accent-soft))]' : ''}`}>{r}</button>
            ))}
          </div>
          <button className={item} onClick={() => { onReply(); onClose() }}><Reply size={17} /> Reply</button>
          <button className={item} onClick={() => setMode('tags')}><Tag size={17} /> Tags{tags.length ? ` (${tags.length})` : ''}</button>
          <button className={item} onClick={() => setMode('text')}><Pencil size={17} /> Edit message</button>
          <button className={item} onClick={() => setMode('time')}><Clock size={17} /> Edit time</button>
          <button className={item} onClick={() => { navigator.clipboard?.writeText(edit?.text ?? text); onClose() }}><Copy size={17} /> Copy</button>
          {edit && (edit.text || edit.time) && (
            <button className={item} onClick={() => { editMessage(id, { text: undefined, time: undefined }); onClose() }}><RotateCcw size={17} /> Restore original</button>
          )}
          <button className={`${item} text-rose-500`} onClick={() => { editMessage(id, { deleted: true }); onClose() }}><Trash2 size={17} /> Delete for me</button>
          <p className="mt-2 px-1 text-[11px] text-[rgb(var(--text-secondary))]">Edits change how this message looks on this device only.</p>
        </>
      )}
      {mode === 'text' && (
        <div className="space-y-3">
          <textarea autoFocus rows={4} value={t} onChange={(e) => setT(e.target.value)} className={`${field} resize-none`} aria-label="Message text" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode('menu')} className="rounded-xl px-4 py-2.5 text-sm font-semibold">Back</button>
            <button className={btnPrimary} onClick={() => { if (t.trim()) editMessage(id, { text: t.trim() }); onClose() }}>Save</button>
          </div>
        </div>
      )}
      {mode === 'time' && (
        <div className="space-y-3">
          <input autoFocus type="time" value={tm} onChange={(e) => setTm(e.target.value)} className={field} aria-label="Message time" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode('menu')} className="rounded-xl px-4 py-2.5 text-sm font-semibold">Back</button>
            <button className={btnPrimary} onClick={() => { if (tm) editMessage(id, { time: tm }); onClose() }}>Save</button>
          </div>
        </div>
      )}
      {mode === 'tags' && (
        <div className="space-y-4">
          <TagPicker value={tags} onChange={(v) => editMessage(id, { tags: v })} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode('menu')} className="rounded-xl px-4 py-2.5 text-sm font-semibold">Back</button>
            <button className={btnPrimary} onClick={onClose}><span className="flex items-center gap-1"><Check size={14} /> Done</span></button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

export function PersonEditor({ chatId, name, avatar, edited, onClose }: { chatId: string; name: string; avatar: string; edited: boolean; onClose: () => void }) {
  const [n, setN] = useState(name)
  const [img, setImg] = useState(avatar)
  const [err, setErr] = useState('')
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { setImg(await fileToAvatar(f)) } catch (x) { setErr((x as Error).message) }
  }
  return (
    <Sheet title="Edit contact" onClose={onClose}>
      <div className="space-y-4">
        <label className="relative mx-auto block h-24 w-24 cursor-pointer" aria-label="Change photo">
          <img src={img} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-[rgb(var(--accent-soft))]" />
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] shadow"><Camera size={14} /></span>
          <input type="file" accept="image/*" onChange={pick} className="sr-only" />
        </label>
        {err && <p className="text-center text-xs text-rose-500">{err}</p>}
        <input value={n} onChange={(e) => setN(e.target.value)} maxLength={40} className={field} aria-label="Contact name" />
        <p className="text-[11px] text-[rgb(var(--text-secondary))]">This nickname and photo are shown only on this device.</p>
        <div className="flex justify-between gap-2">
          {edited ? <button onClick={() => { resetPerson(chatId); onClose() }} className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--accent))]"><RotateCcw size={13} /> Reset</button> : <span />}
          <button className={btnPrimary} onClick={() => { editPerson(chatId, { name: n.trim() || undefined, avatar: img !== avatar ? img : undefined }); onClose() }}>Save</button>
        </div>
      </div>
    </Sheet>
  )
}

export { resetMessage }
