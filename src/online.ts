import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** true while the device has a network connection (the browser's own online/offline signal) */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
