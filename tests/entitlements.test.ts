import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FEATURES, canUse, limit } from '../src/entitlements.ts'
import { inFocusWindow } from '../src/focusWindow.ts'

test('features that are not built are never usable, even on Pro', () => {
  for (const f of FEATURES.filter((x) => x.status !== 'live')) {
    assert.equal(canUse(f.id, true), false, f.id)
    assert.equal(limit(f.id, true), 0, f.id)
  }
})

test('free vs Pro limits for decoy and confidential chats', () => {
  assert.equal(limit('decoyChats', false), 1)
  assert.equal(limit('decoyChats', true), Infinity)
  assert.equal(limit('confidentialChats', false), 1)
  assert.equal(canUse('bioUnlock', false), false)
  assert.equal(canUse('bioUnlock', true), true)
  assert.equal(canUse('appLock', false), true)
})

const base = { enabled: true, days: [true, true, true, true, true, false, false], startHour: 9, endHour: 17, meetingMode: false, allowFavorites: true }
// 2026-10-19 is a Monday
const at = (day: number, hour: number) => new Date(2026, 9, 19 + day, hour, 30)

test('focus: daytime window on chosen days only', () => {
  assert.equal(inFocusWindow(base, at(0, 10)), true)
  assert.equal(inFocusWindow(base, at(0, 17)), false)
  assert.equal(inFocusWindow(base, at(0, 8)), false)
  assert.equal(inFocusWindow(base, at(5, 10)), false, 'Saturday is off')
  assert.equal(inFocusWindow({ ...base, enabled: false }, at(0, 10)), false)
  assert.equal(inFocusWindow({ ...base, meetingMode: true }, at(5, 3)), true)
  assert.equal(inFocusWindow({ ...base, startHour: 9, endHour: 9 }, at(0, 9)), false)
})

test('focus: overnight window belongs to the day it started', () => {
  const night = { ...base, startHour: 22, endHour: 7 }
  assert.equal(inFocusWindow(night, at(0, 23)), true, 'Monday 23:30')
  assert.equal(inFocusWindow(night, at(1, 3)), true, 'Tuesday 03:30 continues Monday night')
  assert.equal(inFocusWindow(night, at(5, 3)), true, 'Saturday 03:30 continues Friday night')
  assert.equal(inFocusWindow(night, at(6, 3)), false, 'Sunday 03:30: Saturday night is off')
  assert.equal(inFocusWindow(night, at(1, 12)), false)
})
