import { Capacitor, registerPlugin } from '@capacitor/core'

/** Bridge to the Android code in android/app/src/main/java/app/chatter/messenger/ChatterDevicePlugin.java.
 *  Only call it when isNative() is true; the web build keeps using the browser's own APIs. */

export type PermName = 'camera' | 'microphone' | 'notifications'
export type PermState = 'granted' | 'prompt' | 'prompt-with-rationale' | 'denied'
export type BioState = 'available' | 'not-enrolled' | 'unavailable'
export type DeviceStatus = Record<PermName, PermState> & { biometric: BioState }

interface ChatterDevicePlugin {
  getStatus(): Promise<DeviceStatus>
  request(o: { name: PermName }): Promise<DeviceStatus>
  openSettings(): Promise<void>
  verifyBiometric(o: { title: string; subtitle?: string }): Promise<{ ok: boolean; code?: string; message?: string }>
  showNotification(o: { id: string; title: string; body: string }): Promise<void>
  setSecure(o: { enabled: boolean }): Promise<void>
  saveFile(o: { name: string; mime: string; text: string }): Promise<{ saved: boolean }>
}

export const isNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
export const Device = registerPlugin<ChatterDevicePlugin>('ChatterDevice')

/** Save a text file: the system "Save to" picker on Android, a normal download in the browser. */
export async function saveTextFile(name: string, mime: string, text: string): Promise<boolean> {
  if (isNative()) return (await Device.saveFile({ name, mime, text })).saved
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return true
}
