import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

type BIPEvent = Event & { prompt: () => Promise<void> }

export default function InstallButton({ className = '' }: { className?: string }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null)
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
  )

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as BIPEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || !evt) return null

  return (
    <button
      onClick={async () => {
        await evt.prompt()
        setEvt(null)
      }}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-[#E8472B] text-white hover:opacity-90 ${className}`}
    >
      <Download size={16} /> Install Chatter
    </button>
  )
}
