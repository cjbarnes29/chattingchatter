// @mentions in group chats. Pure helpers so the rules can be tested without React.

/** The text after a trailing "@" being typed (no spaces yet), or null when the user isn't mentioning anyone */
export function activeMention(draft: string): string | null {
  const m = /(?:^|\s)@([^\s@]*)$/.exec(draft)
  return m ? m[1] : null
}

/** Replaces the trailing "@partial" with "@Name " */
export function insertMention(draft: string, name: string): string {
  return draft.replace(/(^|\s)@[^\s@]*$/, `$1@${name} `)
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export type Piece = { text: string; mention: boolean }

/** Splits a message into plain text and @Name pieces, for the given member names (longest name wins) */
export function splitMentions(text: string, names: string[]): Piece[] {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!clean.length || !text.includes('@')) return [{ text, mention: false }]
  const re = new RegExp(`(^|\\s)@(${clean.map(escapeRe).join('|')})(?=$|[\\s.,!?;:])`, 'gi')
  const out: Piece[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length
    if (start > last) out.push({ text: text.slice(last, start), mention: false })
    out.push({ text: `@${m[2]}`, mention: true })
    last = start + 1 + m[2].length
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false })
  return out.length ? out : [{ text, mention: false }]
}

export const mentionsMe = (text: string, myName: string) => splitMentions(text, [myName]).some((p) => p.mention)
