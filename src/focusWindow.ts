import type { FocusSchedule } from './pro'

/** Is focus on at this moment? Handles schedules that run past midnight (e.g. 22:00–07:00). */
export function inFocusWindow(f: FocusSchedule, now = new Date()) {
  if (!f.enabled) return false
  if (f.meetingMode) return true
  if (f.startHour === f.endHour) return false
  const h = now.getHours()
  const today = (now.getDay() + 6) % 7
  if (f.startHour < f.endHour) return !!f.days[today] && h >= f.startHour && h < f.endHour
  // overnight: the evening part belongs to today, the early-morning part to the day it started
  if (h >= f.startHour) return !!f.days[today]
  if (h < f.endHour) return !!f.days[(today + 6) % 7]
  return false
}
