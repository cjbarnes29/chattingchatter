import { supabase } from './supabase'

/** Security question. The answer is hashed and checked on the server, so it never leaves your account in readable form. */
export async function getSecurityQuestion(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_security_question')
  if (error) return null
  return (data as string | null) ?? null
}

export async function checkSecurityAnswer(answer: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_security_answer', { p_answer: answer })
  return !error && data === true
}

export async function setSecurityQuestion(question: string, answer: string, oldAnswer?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('set_security_question', { p_question: question, p_answer: answer, p_old_answer: oldAnswer ?? null })
  if (error) return { ok: false, error: 'Could not save right now. Try again.' }
  if (data === 'ok') return { ok: true }
  if (data === 'wrong-answer') return { ok: false, error: 'Your current answer is not correct.' }
  if (data === 'invalid') return { ok: false, error: 'Use a question of at least 4 characters and an answer of at least 2.' }
  return { ok: false, error: 'Please sign in again.' }
}
