import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  initialSession, reduce, viewOf, inviteWait, graceRuns, wipeOnLeave, elapsedSecs, fmtElapsed,
  NOTICE_AFTER, INVITE_COOLDOWN, type Session,
} from '../src/ghostSession.ts'

const T0 = 1_000_000

test('waiting alone: pill first, card after the notice delay, never a close', () => {
  const s = reduce(initialSession(T0), { type: 'linkUp' })
  assert.equal(viewOf(s, T0), 'pill')
  assert.equal(viewOf(s, T0 + (NOTICE_AFTER - 1) * 1000), 'pill')
  assert.equal(viewOf(s, T0 + NOTICE_AFTER * 1000), 'card')
  // an hour later it is still only the waiting card
  assert.equal(viewOf(s, T0 + 3_600_000), 'card')
})

test('hold-to-stay countdown never runs while waiting alone in a real room', () => {
  const s = reduce(initialSession(T0), { type: 'linkUp' })
  assert.equal(graceRuns(true, s), false)
  assert.equal(graceRuns(true, reduce(s, { type: 'peerJoined' })), true)
  assert.equal(graceRuns(false, s), true, 'demo canvas (no room) keeps the countdown')
})

test('Keep Waiting collapses the card; reopen restores it', () => {
  let s: Session = reduce(initialSession(T0), { type: 'linkUp' })
  s = reduce(s, { type: 'keepWaiting' })
  assert.equal(viewOf(s, T0 + 60_000), 'pill')
  s = reduce(s, { type: 'reopen' })
  assert.equal(viewOf(s, T0 + 60_000), 'card')
})

test('peer leaving restarts the wait clock; a peer who never joined cannot "leave"', () => {
  const waiting = reduce(initialSession(T0), { type: 'linkUp' })
  assert.equal(reduce(waiting, { type: 'peerLeft', at: T0 + 5000 }), waiting)
  const present = reduce(waiting, { type: 'peerJoined' })
  assert.equal(viewOf(present, T0 + 999_999), 'none')
  const away = reduce(present, { type: 'peerLeft', at: T0 + 50_000 })
  assert.equal(away.peer, 'away')
  assert.equal(elapsedSecs(away, T0 + 53_000), 3)
  assert.equal(viewOf(away, T0 + 53_000), 'pill')
})

test('connection failure shows a recoverable error and retry goes back to connecting', () => {
  const failed = reduce(initialSession(T0), { type: 'linkDown' })
  assert.equal(viewOf(failed, T0), 'failed')
  const retrying = reduce(failed, { type: 'retry' })
  assert.equal(retrying.link, 'connecting')
  assert.equal(reduce(retrying, { type: 'retry' }), retrying, 'retry while connecting is a no-op')
})

test('invite cooldown', () => {
  const s = reduce(initialSession(T0), { type: 'invited', at: T0 })
  assert.equal(inviteWait(initialSession(T0), T0), 0)
  assert.equal(inviteWait(s, T0 + 1000), INVITE_COOLDOWN - 1)
  assert.equal(inviteWait(s, T0 + INVITE_COOLDOWN * 1000), 0)
})

test('"Close when I leave" only wipes when there is something to protect', () => {
  const waiting = initialSession(T0)
  const present = reduce(waiting, { type: 'peerJoined' })
  assert.equal(wipeOnLeave(true, waiting, false), false)
  assert.equal(wipeOnLeave(true, waiting, true), true)
  assert.equal(wipeOnLeave(true, present, false), true)
  assert.equal(wipeOnLeave(false, present, true), false)
})

test('fmtElapsed', () => {
  assert.equal(fmtElapsed(0), '0:00')
  assert.equal(fmtElapsed(75), '1:15')
})
