'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { CalendarDays, Clock } from 'lucide-react'

import {
  combineDateAndTime,
  hoursLabelForDay,
  isOpenDay,
  nextOpenDate,
  timeSlotsForDate,
} from '@/lib/hours'
import { leadTimeLabel } from '@/lib/format'
import {
  RichSelect as Select,
  RichSelectContent as SelectContent,
  RichSelectItem as SelectItem,
  RichSelectTrigger as SelectTrigger,
  RichSelectValue as SelectValue,
} from '@/components/ui/select-rich'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// Brand-skinned date + time picker tied to BRAND.openingHoursSpec. Used
// in two places: the home hero quick-form, and step 2 of the long order
// wizard. Replaces the native `<input type="datetime-local">` (which
// doesn't know the bakery's hours, doesn't disable Mondays, and looks
// out of place next to the rest of the form chrome).
//
// Round-trips a single ISO string so it drops into react-hook-form
// register/setValue without ceremony.

export interface DateTimePickerProps {
  /** ISO datetime string. Empty / invalid → starts at the next open day at 11 AM. */
  value: string
  onChange: (iso: string) => void
  /** Lead-time gate from the picked product, in hours. Filters past slots on today. */
  minLeadHours?: number
  /** When provided, the bottom of the time-Select reflects which product set this lead. */
  leadHintLabel?: string
  /** Optional id passed to the date trigger, for label `for=` association. */
  id?: string
}

export function DateTimePicker({
  value,
  onChange,
  minLeadHours,
  leadHintLabel,
  id = 'dt-date',
}: DateTimePickerProps) {
  const parsed = React.useMemo(() => {
    const t = Date.parse(value)
    if (Number.isNaN(t)) return null
    return new Date(t)
  }, [value])

  // Decompose the controlled ISO into local (date, time) for the two
  // sub-controls. We re-derive on every render so the picker stays in
  // sync if the parent updates `value` from elsewhere (URL prefill, etc.).
  const date = React.useMemo<Date>(() => {
    if (parsed) {
      const d = new Date(parsed)
      d.setHours(0, 0, 0, 0)
      return d
    }
    const seed = new Date()
    seed.setHours(11, 0, 0, 0)
    seed.setDate(seed.getDate() + 1)
    return nextOpenDate(seed) ?? seed
  }, [parsed])

  const slots = React.useMemo(
    () => timeSlotsForDate(date, { minLeadHours: minLeadHours ?? 1 }),
    [date, minLeadHours],
  )

  const time = React.useMemo<string>(() => {
    if (parsed) {
      const hh = String(parsed.getHours()).padStart(2, '0')
      const mm = String(parsed.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    }
    return ''
  }, [parsed])

  const [calOpen, setCalOpen] = React.useState(false)

  // Whenever the available slots change (new day picked, or lead time
  // shifted), make sure the controlled time is still valid. If not, snap
  // to a sensible default (third slot — usually a polite mid-morning).
  React.useEffect(() => {
    if (slots.length === 0) {
      if (time) onChange('')
      return
    }
    if (!slots.find((s) => s.value === time)) {
      const next = slots[Math.min(2, slots.length - 1)]?.value ?? slots[0].value
      onChange(combineDateAndTime(date, next).toISOString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  function setDateOnly(next: Date) {
    // Keep the existing time-of-day if it's still a valid slot for the
    // newly picked date; otherwise the slots-effect above will fix it.
    const target = combineDateAndTime(next, time || (slots[0]?.value ?? '11:00'))
    onChange(target.toISOString())
  }

  function setTimeOnly(hhmm: string) {
    onChange(combineDateAndTime(date, hhmm).toISOString())
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger
            id={id}
            className="w-full h-12 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 text-left text-sm text-cocoa-900 inline-flex items-center justify-between gap-2 focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25"
          >
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cocoa-700" />
              {format(date, 'EEE, MMM d')}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                if (!d) return
                setDateOnly(d)
                setCalOpen(false)
              }}
              disabled={(d) => {
                if (!isOpenDay(d)) return true
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return d < today
              }}
            />
            <div className="px-4 pb-3 pt-1 text-[11px] text-cocoa-900/60 border-t border-cocoa-700/10">
              Closed Mondays · Tue–Sat 11–7 · Sun 12–6
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Select value={time} onValueChange={setTimeOnly}>
          <SelectTrigger>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-cocoa-700" />
              <SelectValue placeholder={slots.length === 0 ? 'Closed this day' : 'Pick a time'} />
            </span>
          </SelectTrigger>
          <SelectContent>
            {slots.length === 0 ? (
              <div className="px-3 py-2 text-sm text-cocoa-900/60">
                We&apos;re closed on {format(date, 'EEEE')}.
              </div>
            ) : (
              slots.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <p className="sm:col-span-2 -mt-1 text-[11px] text-cocoa-900/60">
        {hoursLabelForDay(date)}
        {minLeadHours
          ? ` · earliest ${leadTimeLabel(minLeadHours).toLowerCase()}${leadHintLabel ? ` (${leadHintLabel})` : ''}`
          : ''}
      </p>
    </div>
  )
}
