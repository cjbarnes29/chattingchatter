import { useEffect, useRef } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/** The screen that is currently on top registers a handler: it returns true when it used the Back press
 *  (closed a sheet, left a chat…). When nobody handles it, the exit prompt is shown. */
let handler: (() => boolean) | null = null
let leaving = false
let depth = 0

export function useBackHandler(h: () => boolean) {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => {
    handler = () => ref.current()
    return () => {
      handler = null
    }
  }, [])
}

/** Installed once at the root. Phone Back button / browser Back never closes the app straight away. */
export function useBackTrap(onExitRequest: () => void) {
  const ref = useRef(onExitRequest)
  ref.current = onExitRequest
  useEffect(() => {
    const run = () => {
      if (handler && handler()) return
      ref.current()
    }
    if (Capacitor.isNativePlatform()) {
      let sub: { remove: () => Promise<void> } | undefined
      let gone = false
      CapApp.addListener('backButton', run).then((s) => {
        if (gone) s.remove()
        else sub = s
      })
      return () => {
        gone = true
        sub?.remove()
      }
    }
    history.pushState({ chatter: 1 }, '')
    depth += 1
    const pop = () => {
      if (leaving) return
      history.pushState({ chatter: 1 }, '')
      run()
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
}

export async function exitApp() {
  if (Capacitor.isNativePlatform()) {
    await CapApp.exitApp()
    return
  }
  leaving = true
  window.close()
  history.go(-(depth + 1))
}
