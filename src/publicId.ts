// Shareable user ID#: 8 Crockford-base32 characters, shown as XXXX-XXXX.
const ALPHABET = /^[0-9A-HJKMNP-TV-Z]{8}$/

/** Upper-cases, strips #, spaces and dashes, and maps look-alikes (O→0, I/L→1) the way Crockford base32 does. */
export function normalizePublicId(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
}

export function isPublicId(input: string): boolean {
  return ALPHABET.test(normalizePublicId(input))
}

export function formatPublicId(id: string): string {
  const n = normalizePublicId(id)
  return n.length === 8 ? `${n.slice(0, 4)}-${n.slice(4)}` : n
}
