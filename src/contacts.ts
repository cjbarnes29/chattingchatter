import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { avatarFor } from './auth'

export type ContactPerson = { id: string; name: string; avatar: string; favorite: boolean; blocked: boolean; addedAt: string }
export type ChatPref = { archived: boolean; pinned: boolean; deletedBefore: string | null }

/** Contacts the user added, plus blocks and per-chat preferences (archive / pin / delete). */
export function useContacts(myId: string) {
  const [contacts, setContacts] = useState<ContactPerson[]>([])
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [prefs, setPrefs] = useState<Record<string, ChatPref>>({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const [{ data: cs }, { data: bs }, { data: ps }] = await Promise.all([
      supabase.from('contacts').select('contact_id, favorite, created_at').eq('owner_id', myId),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', myId),
      supabase.from('chat_prefs').select('peer_id, archived, pinned, deleted_before').eq('owner_id', myId),
    ])
    const ids = (cs ?? []).map((c) => c.contact_id as string)
    const { data: profs } = ids.length ? await supabase.from('profiles').select('id, name, avatar').in('id', ids) : { data: [] }
    const pmap = Object.fromEntries((profs ?? []).map((p) => [p.id as string, p]))
    const blocked = new Set((bs ?? []).map((b) => b.blocked_id as string))
    setBlockedIds(blocked)
    setContacts(
      (cs ?? []).map((c) => ({
        id: c.contact_id,
        name: pmap[c.contact_id]?.name ?? 'Chatter user',
        avatar: avatarFor(c.contact_id, pmap[c.contact_id]?.avatar),
        favorite: !!c.favorite,
        blocked: blocked.has(c.contact_id),
        addedAt: c.created_at,
      })),
    )
    setPrefs(
      Object.fromEntries(
        (ps ?? []).map((p) => [
          p.peer_id as string,
          { archived: !!p.archived, pinned: !!p.pinned, deletedBefore: (p.deleted_before as string | null) ?? null },
        ]),
      ),
    )
  }, [myId])

  useEffect(() => {
    let cancelled = false
    load().then(() => !cancelled && setLoaded(true))
    const ch = supabase
      .channel(`contacts-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `owner_id=eq.${myId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks', filter: `blocker_id=eq.${myId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_prefs', filter: `owner_id=eq.${myId}` }, () => load())
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [myId, load])

  /** Add a registered user as a contact by their id. */
  const addContact = useCallback(
    async (peerId: string) => {
      const { error } = await supabase.from('contacts').upsert({ owner_id: myId, contact_id: peerId }, { onConflict: 'owner_id,contact_id' })
      if (error) return { ok: false as const, error: error.message }
      await load()
      return { ok: true as const }
    },
    [myId, load],
  )

  const removeContact = useCallback(
    async (peerId: string) => {
      await supabase.from('contacts').delete().eq('owner_id', myId).eq('contact_id', peerId)
      await load()
    },
    [myId, load],
  )

  const setFavorite = useCallback(
    async (peerId: string, favorite: boolean) => {
      await supabase.from('contacts').update({ favorite }).eq('owner_id', myId).eq('contact_id', peerId)
      await load()
    },
    [myId, load],
  )

  const setBlocked = useCallback(
    async (peerId: string, blocked: boolean) => {
      if (blocked) await supabase.from('blocks').upsert({ blocker_id: myId, blocked_id: peerId }, { onConflict: 'blocker_id,blocked_id' })
      else await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', peerId)
      await load()
    },
    [myId, load],
  )

  const updatePref = useCallback(
    async (peerId: string, patch: Partial<{ archived: boolean; pinned: boolean; deleted_before: string | null }>) => {
      await supabase.from('chat_prefs').upsert({ owner_id: myId, peer_id: peerId, ...patch }, { onConflict: 'owner_id,peer_id' })
      await load()
    },
    [myId, load],
  )

  return { contacts, blockedIds, prefs, loaded, addContact, removeContact, setFavorite, setBlocked, updatePref, reload: load }
}

/** Look up many phone-contact emails at once; returns the registered users found. */
export async function findRegisteredByEmails(emails: string[]) {
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (!clean.length) return [] as { id: string; name: string; avatar: string | null }[]
  const { data, error } = await supabase.rpc('find_profiles_by_emails', { p_emails: clean })
  if (error) return []
  return (data as { id: string; name: string; avatar: string | null }[] | null) ?? []
}

/** Read contacts from the phone via the Contact Picker API (Chrome on Android). */
export async function pickPhoneContacts(): Promise<string[] | 'unsupported' | 'cancelled'> {
  const nav = navigator as Navigator & {
    contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ email?: string[] }[]> }
  }
  if (!nav.contacts?.select) return 'unsupported'
  try {
    const picked = await nav.contacts.select(['email'], { multiple: true })
    return picked.flatMap((c) => c.email ?? [])
  } catch {
    return 'cancelled'
  }
}
