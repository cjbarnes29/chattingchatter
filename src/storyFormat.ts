/** How a photo/GIF story is written into the story's text (pure, testable).
 *    🎞️ caption-or-label
 *    ⟦story:{"v":1,"k":"story/<me>/<id>.gif","t":"image/gif"}⟧
 *  Older app versions just show the first line. Text-only stories stay plain text. */

export type StoryMedia = { key: string; type: string; music?: { key: string; type: string; name: string } }
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024
export const MAX_MUSIC_BYTES = 4 * 1024 * 1024
export const MAX_STORY_IMAGE_BYTES = 2 * 1024 * 1024
const RE = /\n?⟦story:(\{[^\n]{0,400}\})⟧\s*$/
const KEY = /^(story|reply)\/[0-9a-f-]{36}\/[0-9a-f-]{36}(\/[0-9a-f-]{36})?\.(gif|jpg|png|webp|webm|ogg|m4a|mp4|mp3)$/

export function encodeStory(media: StoryMedia, caption: string) {
  const label = media.type.startsWith('video/') ? '🎬 Video story' : media.type === 'image/gif' ? '🎞️ GIF story' : '🖼️ Photo story'
  const head = caption.trim() || (media.music ? `🎵 ${media.music.name}` : label)
  const o: Record<string, unknown> = { v: 1, k: media.key, t: media.type }
  if (media.music) { o.m = media.music.key; o.mt = media.music.type; o.mn = media.music.name.slice(0, 60) }
  return `${head.slice(0, 600)}\n⟦story:${JSON.stringify(o)}⟧`
}

export function parseStory(body: string): { media: StoryMedia | null; caption: string } {
  const m = RE.exec(body)
  if (!m) return { media: null, caption: body }
  const caption = body.slice(0, m.index)
  try {
    const o = JSON.parse(m[1]) as { k?: unknown; t?: unknown; m?: unknown; mt?: unknown; mn?: unknown }
    if (typeof o.k !== 'string' || !KEY.test(o.k)) return { media: null, caption }
    const type = typeof o.t === 'string' && /^(image|audio|video)\/[\w.+-]{1,40}$/.test(o.t) ? o.t : 'image/gif'
    const music = typeof o.m === 'string' && KEY.test(o.m) && typeof o.mt === 'string' && /^audio\/[\w.+-]{1,40}$/.test(o.mt)
      ? { key: o.m, type: o.mt, name: typeof o.mn === 'string' ? o.mn.slice(0, 60) : 'Music' } : undefined
    const label = /^(🎞️ GIF story|🖼️ Photo story|🎬 Video story|🎵 .*)$/.test(caption) ? '' : caption
    return { media: { key: o.k, type, ...(music ? { music } : {}) }, caption: label }
  } catch {
    return { media: null, caption }
  }
}

export const validMediaKey = (k: string) => KEY.test(k)
export const extFor = (type: string) =>
  type === 'image/gif' ? 'gif' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp'
  : type.startsWith('audio/mpeg') ? 'mp3' : type.startsWith('audio/ogg') ? 'ogg' : type.startsWith('audio/mp4') || type.startsWith('audio/aac') || type.startsWith('audio/x-m4a') ? 'm4a' : type.startsWith('audio/') ? 'webm'
  : type === 'video/webm' ? 'webm' : type.startsWith('video/') ? 'mp4' : 'jpg'

export type ReplyKind = 'text' | 'emoji' | 'gif' | 'picture' | 'voice' | 'story'
export const REPLY_KINDS: ReplyKind[] = ['text', 'emoji', 'gif', 'picture', 'voice', 'story']
/** a reply that points at one of the replier's own stories: body holds that story's id */
export const isStoryId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)
