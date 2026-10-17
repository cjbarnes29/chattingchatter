import { useAuth } from '../auth'
import { isNative } from '../native'
import { useInboxPrivacy, setInboxPrivacy, type InboxPrivacy } from '../inboxPrivacy'
import { Toggle, Row, Group } from './settingsUi'

/** Real account only: how much the Inbox list shows. Choices are stored per account on this device. */
export default function InboxPrivacySettings() {
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const p = useInboxPrivacy(uid)
  if (!uid) return null
  const set = (patch: Partial<InboxPrivacy>) => setInboxPrivacy(uid, patch)
  return (
    <div className="space-y-1 px-5 py-4">
      <Group title="In the list" note="These only change what the Inbox shows. Open chats still show everything, and nothing is changed for the people you chat with.">
        <Row title="Hide message previews" desc="Show “Message hidden” instead of the last message">
          <Toggle on={p.hidePreviews} onChange={(v) => set({ hidePreviews: v })} label="Hide message previews" />
        </Row>
        <Row title="Mask names" desc="Show names as “A•••” so a glance reveals nothing">
          <Toggle on={p.maskNames} onChange={(v) => set({ maskNames: v })} label="Mask names" />
        </Row>
        <Row title="Blur photos" desc="Blur profile photos in the Inbox">
          <Toggle on={p.blurAvatars} onChange={(v) => set({ blurAvatars: v })} label="Blur photos" />
        </Row>
        <Row title="Hide activity" desc="Hide unread counts and online dots">
          <Toggle on={p.hideActivity} onChange={(v) => set({ hideActivity: v })} label="Hide activity" />
        </Row>
      </Group>
      <Group title="When you leave" note={isNative() ? undefined : 'Blocking screenshots is available in the Android app.'}>
        <Row title="Blank the screen in the background" desc="Cover Chatter when you switch to another app">
          <Toggle on={p.shieldOnLeave} onChange={(v) => set({ shieldOnLeave: v })} label="Blank the screen in the background" />
        </Row>
        {isNative() && (
          <Row title="Block screenshots" desc="Stops screenshots, screen recording and the preview in your app switcher">
            <Toggle on={p.blockCapture} onChange={(v) => set({ blockCapture: v })} label="Block screenshots" />
          </Row>
        )}
      </Group>
    </div>
  )
}
