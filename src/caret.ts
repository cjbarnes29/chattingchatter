/** Inserts text at the caret of a textarea or input and puts the caret after it. */
export function insertAtCaret(el: HTMLTextAreaElement | HTMLInputElement | null, value: string, insert: string, set: (v: string) => void) {
  if (!el) return set(value + insert)
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  set(value.slice(0, start) + insert + value.slice(end))
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + insert.length
    try { el.setSelectionRange(pos, pos) } catch { /* some inputs (datetime) don't have a caret */ }
  })
}
