// Pure helpers for "is this date+time inside business hours" math, used
// by the home quick-order form so customers can't pick a Monday or a
// 4 AM pickup. Anything that needs to render the hours grid as JSX
// (admin / footer / page heros) lives in components/brand/hours.tsx.

import { BRAND } from './brand'

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

interface DayWindow {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number
  /** Minutes since midnight, inclusive */
  openMin: number
  /** Minutes since midnight, exclusive (the close time) */
  closeMin: number
}

// Flatten BRAND.openingHoursSpec into per-day windows for fast lookup.
function buildWindows(): Map<number, DayWindow> {
  const windows = new Map<number, DayWindow>()
  for (const spec of BRAND.openingHoursSpec) {
    for (const day of spec.dayOfWeek) {
      const idx = DAY_NAMES.indexOf(day as (typeof DAY_NAMES)[number])
      if (idx === -1) continue
      windows.set(idx, {
        dayOfWeek: idx,
        openMin: hhmmToMinutes(spec.opens),
        closeMin: hhmmToMinutes(spec.closes),
      })
    }
  }
  return windows
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

const WINDOWS = buildWindows()

/** True if the bakery is open on this day (per the static BRAND spec). */
export function isOpenDay(date: Date): boolean {
  return WINDOWS.has(date.getDay())
}

/** Human-readable hours line for a given date, e.g. "11:00 AM – 7:00 PM". */
export function hoursLabelForDay(date: Date): string {
  const w = WINDOWS.get(date.getDay())
  if (!w) return 'Closed'
  return `${minutesToLabel(w.openMin)} – ${minutesToLabel(w.closeMin)}`
}

/**
 * Generate pickup/delivery time slots for a given date.
 *
 * - Slots are every 30 minutes from open until `close - leadCloseMin`
 *   (so the kitchen has time to hand the order over before lockup).
 * - For "today" we filter out slots that are already in the past plus
 *   the product's lead-time minimum (`minLeadHours`).
 * - For closed days returns an empty list — the calendar should not let
 *   the user pick that date in the first place, this is a safety net.
 */
export function timeSlotsForDate(
  date: Date,
  options: { now?: Date; minLeadHours?: number; intervalMin?: number; leadCloseMin?: number } = {},
): Array<{ value: string; label: string }> {
  const w = WINDOWS.get(date.getDay())
  if (!w) return []
  const interval = options.intervalMin ?? 30
  const leadClose = options.leadCloseMin ?? 60
  const now = options.now ?? new Date()
  const isToday = sameYMD(date, now)
  const earliestMin = isToday
    ? Math.max(
        w.openMin,
        roundUp(toMinutesOfDay(now) + (options.minLeadHours ?? 1) * 60, interval),
      )
    : w.openMin
  const latestMin = w.closeMin - leadClose
  const slots: Array<{ value: string; label: string }> = []
  for (let m = earliestMin; m <= latestMin; m += interval) {
    slots.push({ value: minutesToHHMM(m), label: minutesToLabel(m) })
  }
  return slots
}

function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function toMinutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step
}

function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return mm === 0 ? `${h12}:00 ${period}` : `${h12}:${String(mm).padStart(2, '0')} ${period}`
}

/** Combine a calendar date and an HH:mm time string into a Date in local TZ. */
export function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const out = new Date(date)
  out.setHours(h, m || 0, 0, 0)
  return out
}

/** First open day at or after `date`, or `null` if none in the next 14 days. */
export function nextOpenDate(date: Date): Date | null {
  const d = new Date(date)
  for (let i = 0; i < 14; i++) {
    if (isOpenDay(d)) return d
    d.setDate(d.getDate() + 1)
  }
  return null
}

/** True if `date` is inside the bakery's hours (closed days return false). */
export function isOpenAt(date: Date): boolean {
  const w = WINDOWS.get(date.getDay())
  if (!w) return false
  const m = toMinutesOfDay(date)
  return m >= w.openMin && m < w.closeMin
}

/**
 * Earliest moment the bakery can hand a cake over, given a product's
 * lead-time in hours. Walks forward from `now + leadHours`:
 *   - If it lands inside an open window, return as-is.
 *   - Otherwise snap to the next day's open time (or the same day's open
 *     if we're before opening, e.g. 9 AM on a Tue with a 1h product).
 *
 * Returns the resolved Date plus a flag for whether the result was pushed
 * outside the strict lead-time minimum (so callers can word the badge
 * differently when the store closure caused a delay vs. just lead-time).
 */
export function earliestReadyAt(
  leadHours: number,
  now: Date = new Date(),
): { at: Date; clampedByHours: boolean } {
  const baseline = new Date(now.getTime() + Math.max(0, leadHours) * 3600_000)
  if (isOpenAt(baseline)) return { at: baseline, clampedByHours: false }

  // Walk forward day-by-day until we find one inside hours.
  // First try the same day's open time (if the baseline is BEFORE today's
  // open). Otherwise jump to the next open day's open time.
  const w = WINDOWS.get(baseline.getDay())
  if (w && toMinutesOfDay(baseline) < w.openMin) {
    const sameDay = new Date(baseline)
    sameDay.setHours(Math.floor(w.openMin / 60), w.openMin % 60, 0, 0)
    return { at: sameDay, clampedByHours: true }
  }

  const cursor = new Date(baseline)
  for (let i = 0; i < 14; i++) {
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(0, 0, 0, 0)
    const nw = WINDOWS.get(cursor.getDay())
    if (nw) {
      cursor.setHours(Math.floor(nw.openMin / 60), nw.openMin % 60, 0, 0)
      return { at: cursor, clampedByHours: true }
    }
  }
  // Fallback: should never happen for a normal weekly schedule.
  return { at: baseline, clampedByHours: false }
}

/**
 * Human label for the earliest-ready time, used as the small badge under
 * each line item in the order form ("About an hour" / "Tomorrow at 11 AM"
 * / "Sunday at noon"). Aligns with store hours so we don't promise a
 * pickup at a closed-store time.
 *
 * Examples:
 *   leadHours=1, now=Tue 2 PM           → "About an hour" (open now)
 *   leadHours=1, now=Sat 11 PM          → "Sunday at 12:00 PM"
 *   leadHours=1, now=Tue 9 AM           → "Today at 11:00 AM"
 *   leadHours=24, now=Wed 3 PM          → "Tomorrow at 3:00 PM" (still in hours)
 *   leadHours=24, now=Mon 3 PM (closed) → "Wednesday at 11:00 AM"
 */
export function earliestReadyLabel(leadHours: number, now: Date = new Date()): string {
  const { at, clampedByHours } = earliestReadyAt(leadHours, now)

  // Inside hours and lead-time wasn't pushed forward → keep the warm
  // existing copy so we don't regress the common case.
  if (!clampedByHours) {
    if (leadHours < 1) return 'Right now from the case'
    if (leadHours === 1) return 'About an hour'
    if (leadHours < 24) return `${leadHours} hours notice`
    const days = Math.round(leadHours / 24)
    return `${days} day${days > 1 ? 's' : ''} notice`
  }

  // Closure pushed us into a future open window — say WHEN.
  const sameDay = sameYMD(at, now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = sameYMD(at, tomorrow)
  const timeStr = minutesToLabel(toMinutesOfDay(at))
  if (sameDay) return `Today at ${timeStr}`
  if (isTomorrow) return `Tomorrow at ${timeStr}`
  return `${DAY_NAMES[at.getDay()]} at ${timeStr}`
}
