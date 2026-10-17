import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { checkPin, hashPin, lockoutMs, validPin, FREE_TRIES } from '../src/pinLock.ts'

test('hashPin produces salted PBKDF2 hashes that verify', async () => {
  const a = await hashPin('1234')
  const b = await hashPin('1234')
  assert.match(a, /^pbkdf2\$210000\$[A-Za-z0-9+/=]+\$[0-9a-f]{64}$/)
  assert.notEqual(a, b, 'same PIN must get a different salt each time')
  assert.deepEqual(await checkPin('1234', a, 'real'), { ok: true, legacy: false })
  assert.deepEqual(await checkPin('1235', a, 'real'), { ok: false, legacy: false })
})

test('checkPin rejects missing and malformed hashes', async () => {
  assert.equal((await checkPin('1234', null, 'real')).ok, false)
  assert.equal((await checkPin('1234', 'pbkdf2$abc$$', 'real')).ok, false)
  assert.equal((await checkPin('1234', 'pbkdf2$0$c2FsdA==$00', 'real')).ok, false)
})

test('legacy unsalted hashes still verify, are flagged for upgrade, and are role-bound', async () => {
  const legacy = createHash('sha256').update('real:4321').digest('hex')
  assert.deepEqual(await checkPin('4321', legacy, 'real'), { ok: true, legacy: true })
  // the same digits under the decoy role must not match a real-role hash
  assert.equal((await checkPin('4321', legacy, 'decoy')).ok, false)
})

test('validPin accepts only 4-6 digits', () => {
  for (const ok of ['1234', '12345', '123456']) assert.equal(validPin(ok), true, ok)
  for (const bad of ['123', '1234567', '12a4', '', ' 1234']) assert.equal(validPin(bad), false, bad)
})

test('lockout: none for the first 5 wrong PINs, then 30s doubling up to 15 min', () => {
  for (let i = 0; i < FREE_TRIES; i++) assert.equal(lockoutMs(i), 0)
  assert.equal(lockoutMs(5), 30_000)
  assert.equal(lockoutMs(6), 60_000)
  assert.equal(lockoutMs(7), 120_000)
  assert.equal(lockoutMs(50), 15 * 60_000)
})
