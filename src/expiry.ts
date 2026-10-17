import { supabase } from './supabase'
import { parseMeta } from './messageMeta'

/** Insert a chat message, also setting `expires_at` when the sender chose disappearing messages, so the
 *  server can hide and delete it (supabase/migrations/message_controls_and_stories.sql). Until that update
 *  is applied the column doesn't exist; then the message is sent without it and the apps still hide it. */
export async function insertWithExpiry(table: 'messages' | 'group_messages', row: { body: string } & Record<string, unknown>) {
  const x = parseMeta(row.body).meta?.x
  if (x) {
    const r = await supabase.from(table).insert({ ...row, expires_at: new Date(x).toISOString() })
    if (!r.error || !/expires_at/.test(r.error.message ?? '')) return r
  }
  return supabase.from(table).insert(row)
}
