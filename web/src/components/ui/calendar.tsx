'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

import { cn } from '@/lib/utils'

// Brand-skinned wrapper around react-day-picker v10. Uses the library's
// `classNames` map to swap in HappyCake palette tokens (cocoa brown for
// the selected day, sky for hover, cream for the surface). The container
// imports the library's base stylesheet first so our overrides win.

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('rdp-hc p-2', className)}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'space-y-3',
        month_caption: 'flex justify-center pt-1 relative items-center text-sm font-medium text-cocoa-900',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        button_previous:
          'absolute left-1 top-1 h-8 w-8 inline-flex items-center justify-center rounded-full text-cocoa-900 hover:bg-cream-100',
        button_next:
          'absolute right-1 top-1 h-8 w-8 inline-flex items-center justify-center rounded-full text-cocoa-900 hover:bg-cream-100',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-cocoa-900/55 w-9 h-9 inline-flex items-center justify-center text-[11px] uppercase tracking-wider',
        week: 'flex w-full',
        day: 'h-9 w-9 p-0 text-center text-sm relative inline-flex items-center justify-center [&:has([aria-selected])]:bg-transparent',
        day_button:
          'h-9 w-9 inline-flex items-center justify-center rounded-full text-sm transition-colors hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-sky/40',
        selected: '[&_button]:bg-cocoa-700 [&_button]:text-cream [&_button]:hover:bg-cocoa-900',
        today: '[&_button]:ring-1 [&_button]:ring-sky/50 [&_button]:font-semibold',
        outside: 'text-cocoa-900/30',
        disabled: 'opacity-30 cursor-not-allowed [&_button]:cursor-not-allowed [&_button]:hover:bg-transparent',
        hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  )
}
