import test from 'node:test'
import assert from 'node:assert/strict'
import { activeMention, insertMention, splitMentions, mentionsMe } from '../src/mentions.ts'
import { normalizePublicId, isPublicId, formatPublicId } from '../src/publicId.ts'
import { initialSession, reduce, viewOf, wipeOnLeave, inviteWait, NOTICE_AFTER, INVITE_COOLDOWN } from '../src/ghostSession.ts'
import { enqueue, nextDue, classify, afterFailure, loadOutbox, saveOutbox, patch, backoffMs, MAX_ATTEMPTS } from '../src/outbox.ts'
import { maskName } from '../src/inboxPrivacy.ts'

test('mentions: detects and completes the word being typed', () => {
  assert.equal(activeMention('hi @al'), 'al')
  assert.equal(activeMention('hi @'), '')
  assert.equal(activeMention('hi @al there'), null)
  assert.equal(activeMention('mail a@b'), null)
  assert.equal(insertMention('hi @al', 'Alex Kim'), 'hi @Alex Kim ')
})

test('mentions: splits message into pieces, longest name first', () => {
  const p = splitMentions('hey @Alex Kim, and @Sam!', ['Alex', 'Alex Kim', 'Sam'])
  assert.deepEqual(p.filter((x) => x.mention).map((x) => x.text), ['@Alex Kim', '@Sam'])
  assert.equal(p.map((x) => x.text).join(''), 'hey @Alex Kim, and @Sam!')
  assert.equal(splitMentions('no mention', ['Alex']).length, 1)
  assert.equal(splitMentions('x@Alex', ['Alex'])[0].mention, false)
  assert.ok(mentionsMe('ping @sam now', 'Sam'))
})

test('user ID#: normalize, validate, format', () => {
  assert.equal(normalizePublicId('#k7qm-4xz2'), 'K7QM4XZ2')
  assert.ok(isPublicId('K7QM-4XZ2'))
  assert.ok(!isPublicId('K7QM-4XZ'))
  assert.ok(!isPublicId('K7QM-4XZU'.replace('Z', '!')))
  assert.equal(formatPublicId('k7qm4xz2'), 'K7QM-4XZ2')
})

test('ghost session: waiting, peer join/leave, never auto-closes', () => {
  let s = initialSession(0)
  assert.equal(viewOf(s, 0), 'pill')
  assert.equal(viewOf(s, NOTICE_AFTER * 1000), 'card')
  s = reduce(s, { type: 'linkUp' })
  s = reduce(s, { type: 'peerJoined' })
  assert.equal(viewOf(s, 999999), 'none')
  s = reduce(s, { type: 'peerLeft', at: 5 })
  assert.equal(s.peer, 'away')
  s = reduce(s, { type: 'invited', at: 0 })
  assert.equal(inviteWait(s, 1000), INVITE_COOLDOWN - 1)
  assert.equal(wipeOnLeave(true, initialSession(0), false), false)
  assert.equal(wipeOnLeave(true, reduce(initialSession(0), { type: 'peerJoined' }), false), true)
})

test('inbox privacy: names are masked', () => {
  assert.equal(maskName('Alex Smith'), 'A••• S•••')
})

test('outbox: queue dedupes by id, keeps order per chat, survives restart', () => {
  const mem: Record<string, string> = {}
  const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } }
  let q = enqueue([], { id: 'a', peerId: 'p1', body: 'one' })
  q = enqueue(q, { id: 'a', peerId: 'p1', body: 'one' })
  q = enqueue(q, { id: 'b', peerId: 'p1', body: 'two' })
  q = enqueue(q, { id: 'c', peerId: 'p2', body: 'three' })
  assert.equal(q.length, 3)
  assert.equal(enqueue(q, { id: 'x', peerId: 'p1', body: '   ' }).length, 3)
  assert.equal(nextDue(q, 0)?.id, 'a')
  q = patch(q, 'a', { state: 'sending' })
  assert.equal(nextDue(q, 0)?.id, 'c') // p1 is busy, b must not overtake a
  saveOutbox(store, 'u', patch(q, 'a', { state: 'sending' }))
  const back = loadOutbox(store, 'u')
  assert.equal(back.find((i) => i.id === 'a')?.state, 'queued') // restart mid-send retries
  assert.equal(back.length, 3)
})

test('outbox: failures back off, then fail; duplicates count as delivered', () => {
  assert.equal(classify(null), 'delivered')
  assert.equal(classify({ code: '23505' }), 'delivered')
  assert.equal(classify({ code: '42501', status: 403 }), 'rejected')
  assert.equal(classify({ message: 'Failed to fetch' }), 'retry')
  assert.equal(classify({ status: 503 }), 'retry')
  let item = enqueue([], { id: 'a', peerId: 'p', body: 'x' })[0]
  item = afterFailure(item, 'retry', 1000)
  assert.equal(item.state, 'queued')
  assert.equal(item.nextAt, 1000 + backoffMs(1))
  assert.equal(nextDue([item], 1000), undefined)
  assert.equal(nextDue([item], item.nextAt)?.id, 'a')
  for (let i = 1; i < MAX_ATTEMPTS; i++) item = afterFailure(item, 'retry', 0)
  assert.equal(item.state, 'failed')
  assert.equal(nextDue([item], 1e12), undefined)
})
