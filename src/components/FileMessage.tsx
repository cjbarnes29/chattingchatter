import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, X, AlertTriangle } from 'lucide-react'
import { fileKind, formatBytes, type FileAtt } from '../attachmentFormat'
import { saveFromUrl, type AttachmentApi } from '../attachmentStore'

// files that run code if opened; still allowed, but flagged
const RISKY = /\.(apk|aab|exe|msi|bat|cmd|com|scr|ps1|vbs|js|jar|sh|app|dmg|deb|rpm|html?|svg)$/i

/** A file bubble. Pictures show inline (tap to enlarge), audio and video load on tap, anything else
 *  shows its name and size with a Save button. SVG and HTML are never shown inline. */
export default function FileMessage({ att, api, canSave = true }: { att: FileAtt; api?: AttachmentApi; canSave?: boolean }) {
  const kind = fileKind(att.type, att.name)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [big, setBig] = useState(false)

  const resolve = async () => {
    if (url) return url
    if (!api) { setErr('This file isn’t available here.'); return null }
    setBusy(true)
    const u = await api.url(att.key)
    setBusy(false)
    if (!u) { setErr('This file isn’t available.'); return null }
    setUrl(u)
    return u
  }

  // pictures are fetched straight away so they appear like in any messenger
  useEffect(() => {
    if (kind.inline === 'image') void resolve()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.key])

  const save = async () => {
    setErr('')
    const u = await resolve()
    if (!u) return
    try { await saveFromUrl(u, att.name, att.type) } catch { setErr('Couldn’t save the file.') }
  }

  const saveBtn = !canSave ? (
    <span className="shrink-0 text-[10px] text-[rgb(var(--text-tertiary))]" title="The sender turned off saving">Saving off</span>
  ) : (
    <button type="button" onClick={save} aria-label={`Save ${att.name}`} className="flex shrink-0 items-center gap-1 rounded-full bg-[rgb(var(--accent))] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--accent-foreground))]">
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Save
    </button>
  )

  return (
    <div className="w-[min(17rem,70vw)]" data-testid="file-message">
      {kind.inline === 'image' && url ? (
        <button type="button" onClick={() => setBig(true)} aria-label={`Open ${att.name}`} className="block overflow-hidden rounded-lg">
          <img src={url} alt={att.name} draggable={canSave} onContextMenu={canSave ? undefined : (e) => e.preventDefault()} className={`max-h-64 w-full object-cover ${canSave ? '' : 'pointer-events-none select-none'}`} />
        </button>
      ) : kind.inline === 'audio' && url ? (
        <audio controls src={url} className="w-full" controlsList={canSave ? undefined : 'nodownload'} />
      ) : kind.inline === 'video' && url ? (
        <video controls src={url} className="max-h-64 w-full rounded-lg" controlsList={canSave ? undefined : 'nodownload'} onContextMenu={canSave ? undefined : (e) => e.preventDefault()} />
      ) : null}
      <div className="mt-1 flex items-center gap-2.5">
        {!(kind.inline && url) && (
          <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]">
            <FileText size={16} />
            <span className="text-[8px] font-bold leading-none">{kind.label}</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold" title={att.name}>{att.name}</p>
          <p className="text-[11px] text-[rgb(var(--text-secondary))]">{formatBytes(att.size)}</p>
        </div>
        {(kind.inline === 'audio' || kind.inline === 'video') && !url ? (
          <button type="button" onClick={() => void resolve()} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]">{busy ? 'Loading…' : 'Play'}</button>
        ) : null}
        {saveBtn}
      </div>
      {RISKY.test(att.name) && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400"><AlertTriangle size={11} /> Only open this type of file if you trust the sender.</p>
      )}
      {err && <p role="alert" className="mt-1 text-[11px] text-rose-500">{err}</p>}
      {big && url && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/90" onClick={() => setBig(false)}>
          <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="truncate text-sm">{att.name}</p>
            <span className="flex gap-2">
              {saveBtn}
              <button type="button" onClick={() => setBig(false)} aria-label="Close" className="rounded-full p-2 hover:bg-white/10"><X size={18} /></button>
            </span>
          </div>
          <img src={url} alt={att.name} className="m-auto max-h-[85vh] max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
