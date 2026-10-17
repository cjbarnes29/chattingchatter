import { useEffect, useRef, useState } from 'react'
import { Clock, Smile, Hand, Heart, PawPrint, Coffee, Plane, Lightbulb } from 'lucide-react'

const GROUPS: { id: string; label: string; icon: typeof Smile; list: string }[] = [
  { id: 'smileys', label: 'Smileys', icon: Smile, list: '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👻 💀 🤖 🎃 😺 😸 😹 😻' },
  { id: 'people', label: 'Gestures', icon: Hand, list: '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 💪 🦾 🧠 👀 👁️ 👅 👄 💋 👶 🧒 👦 👧 🧑 👱 👨 👩 🧓 👴 👵 🙋 🙆 🙅 🤷 🤦 💁 🙇 🧑‍💻 🧑‍🍳 🧑‍🎓 👮 🕵️ 💃 🕺 👯 🧘 🏃 🚶' },
  { id: 'hearts', label: 'Hearts', icon: Heart, list: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 💤' },
  { id: 'nature', label: 'Animals & nature', icon: PawPrint, list: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🦀 🐠 🐬 🐳 🦈 🐊 🐘 🦒 🐕 🐈 🌵 🎄 🌲 🌳 🌴 🌱 🌿 🍀 🍁 🍂 🌷 🌹 🌺 🌸 🌼 🌻 🌞 🌝 🌚 🌙 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ 🌊' },
  { id: 'food', label: 'Food & drink', icon: Coffee, list: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🍞 🥐 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍰 🎂 🧁 🍮 🍭 🍬 🍫 🍿 🍩 🍪 ☕ 🍵 🧃 🥤 🧋 🍺 🍻 🥂 🍷 🍸 🍹' },
  { id: 'travel', label: 'Activities & travel', icon: Plane, list: '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 ⛳ 🎣 🎽 🎿 🛹 🏆 🥇 🥈 🥉 🏅 🎖️ 🎫 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎸 🎻 🎲 🎯 🎳 🎮 🧩 🚗 🚕 🚌 🚓 🚑 🚒 🚲 🛵 🏍️ ✈️ 🚀 🛸 🚁 ⛵ 🚢 🚆 🚇 🗺️ 🏖️ 🏝️ 🏔️ ⛺ 🏠 🏡 🏢 🏥 🏫 ⛪ 🕌 🗽 🗼 🎡 🎢 🌃 🌅 🌄' },
  { id: 'objects', label: 'Objects & symbols', icon: Lightbulb, list: '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 📷 📸 📹 🎥 📞 ☎️ 📺 📻 ⏰ ⏳ 💡 🔦 🕯️ 💸 💵 💳 💎 🔧 🔨 🛠️ 🔑 🗝️ 🔒 🔓 🧲 💊 💉 🩹 🧸 🎁 🎈 🎉 🎊 ✉️ 📦 📝 📌 📎 ✂️ 📚 📖 🔖 🗓️ 📅 ✅ ☑️ ❌ ⭕ ❗ ❓ ‼️ ⁉️ ⚠️ 🚫 🔞 ♻️ ✔️ ➕ ➖ ➗ ✖️ 🔝 🆗 🆕 🆒 🆓 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🏳️ 🏴 🏁 🚩 🏳️‍🌈' },
]

const MAX_RECENT = 24
const recentKey = (scope: string) => `chatter.emoji.recent.${scope}`
const readRecent = (scope: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(scope)) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

type Props = {
  onPick: (emoji: string) => void
  onClose: () => void
  /** recent emojis are remembered per scope, so decoy mode never shows what was used in real chats */
  scope: string
  className?: string
}

/** A compact emoji panel. Click or Enter inserts; Escape or a click outside closes it. */
export default function EmojiPicker({ onPick, onClose, scope, className = '' }: Props) {
  const [recent, setRecent] = useState(() => readRecent(scope))
  const [tab, setTab] = useState(() => (readRecent(scope).length ? 'recent' : 'smileys'))
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const down = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    // wait a tick so the click that opened the panel doesn't close it straight away
    const t = setTimeout(() => document.addEventListener('pointerdown', down), 0)
    document.addEventListener('keydown', key, true)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key, true) }
  }, [onClose])

  const pick = (e: string) => {
    onPick(e)
    const next = [e, ...recent.filter((x) => x !== e)].slice(0, MAX_RECENT)
    setRecent(next)
    try { localStorage.setItem(recentKey(scope), JSON.stringify(next)) } catch { /* ignore */ }
  }

  const tabs = [...(recent.length ? [{ id: 'recent', label: 'Recent', icon: Clock }] : []), ...GROUPS]
  const list = tab === 'recent' ? recent : (GROUPS.find((x) => x.id === tab) ?? GROUPS[0]).list.split(' ')

  return (
    <div ref={box} role="dialog" aria-label="Emoji" className={`z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl bg-[rgb(var(--bg-panel))] shadow-2xl ring-1 ring-[rgb(var(--border))] ${className}`}>
      <div role="tablist" aria-label="Emoji groups" className="flex gap-0.5 overflow-x-auto border-b border-[rgb(var(--border))] px-1.5 py-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-label={t.label} title={t.label} onClick={() => setTab(t.id)} className={`shrink-0 rounded-lg p-2 ${tab === t.id ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-panel-soft))]'}`}>
            <t.icon size={16} />
          </button>
        ))}
      </div>
      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-1.5" role="listbox" aria-label={tabs.find((t) => t.id === tab)?.label}>
        {list.map((e) => (
          <button key={e} type="button" role="option" aria-selected={false} aria-label={e} onClick={() => pick(e)} className="flex h-9 items-center justify-center rounded-lg text-[22px] leading-none hover:bg-[rgb(var(--bg-panel-soft))] focus-visible:bg-[rgb(var(--accent-soft))] focus-visible:outline-none">
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

