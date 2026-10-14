import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
    navigator.serviceWorker.register(`./sw.js?v=${__BUILD_ID__}`).then((reg) => {
      const check = () => reg.update().catch(() => {})
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(nw)
        })
      })
      setInterval(check, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    }).catch(() => {})
  }, [])

  if (!waiting || hidden) return null
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1B1626] px-4 py-3 text-sm text-[#F6F1E8] shadow-xl">
      <RefreshCw size={16} className="text-[#FF6A3D]" />
      <span>A new version of Chatter is ready.</span>
      <button onClick={() => waiting.postMessage('SKIP_WAITING')} className="rounded-full bg-[#FF6A3D] px-3 py-1 font-semibold text-white">
        Update
      </button>
      <button aria-label="Dismiss" onClick={() => setHidden(true)}><X size={14} /></button>
    </div>
  )
}
