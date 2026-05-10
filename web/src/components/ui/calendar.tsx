'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

import { cn } from '@/lib/utils'

// Brand-skinned wrapper around react-day-picker v10. Uses the library's
// `classNames` map to swap in HappyCake palette tokens (sky for selected
// day, cream for surface). The container imports the library's base
// stylesheet first so our overrides win.
//
// Layout: in v10 the `nav` element renders as a sibling of `month_caption`
// inside `month`, NOT as a child of caption. Earlier versions of these
// classNames placed the prev/next buttons with `position: absolute`,
// which positioned them against the wrong ancestor (the whole month, not
// the caption row) and made them overlap the date grid below.
//
// Now: `nav` is a 44px-tall flex row above the caption, prev/next render
// inline. No absolute positioning, no overlap. Touch targets stay 36×36
// (still above the WCAG 24×24 minimum) — generous without crowding the
// caption text on small screens.

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('rdp-hc p-2', className)}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'space-y-2',
        month_caption:
          'flex justify-center items-center text-sm font-medium text-cocoa-900 h-8',
        caption_label: 'text-sm font-medium',
        // Prev/next sit on their own row above the month label, taking
        // the full width with `justify-between` so the chevrons land at
        // the corners and never collide with the date grid.
        nav: 'flex items-center justify-between px-1 pt-1',
        button_previous:
          'h-9 w-9 inline-flex items-center justify-center rounded-full text-cocoa-900 hover:bg-cream-100 active:bg-cream-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 [&>svg]:h-4 [&>svg]:w-4',
        button_next:
          'h-9 w-9 inline-flex items-center justify-center rounded-full text-cocoa-900 hover:bg-cream-100 active:bg-cream-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 [&>svg]:h-4 [&>svg]:w-4',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-cocoa-900/55 w-9 h-9 inline-flex items-center justify-center text-[11px] uppercase tracking-wider',
        week: 'flex w-full',
        day: 'h-9 w-9 p-0 text-center text-sm relative inline-flex items-center justify-center [&:has([aria-selected])]:bg-transparent',
        day_button:
          'h-9 w-9 inline-flex items-center justify-center rounded-full text-sm transition-colors hover:bg-cream-100 focus:outline-none focus:ring-2 focus:ring-sky/40',
        // Selected day uses brand sky now that sky is the primary CTA
        // colour — keeps the calendar visually aligned with the "Continue"
        // button immediately below it.
        selected: '[&_button]:bg-sky [&_button]:text-white [&_button]:hover:bg-sky-700',
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
