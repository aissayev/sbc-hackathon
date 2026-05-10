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
