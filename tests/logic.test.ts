import test from 'node:test'
import assert from 'node:assert/strict'
import { activeMention, insertMention, splitMentions, mentionsMe } from '../src/mentions.ts'
import { normalizePublicId, isPublicId, formatPublicId } from '../src/publicId.ts'
import { initialSession, reduce, viewOf, wipeOnLeave, inviteWait, NOTICE_AFTER, INVITE_COOLDOWN } from '../src/ghostSession.ts'
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
