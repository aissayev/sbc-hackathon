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
// Touch-target fix: react-day-picker renders the prev/next chevrons as
// large oversized SVGs that visually extend past the button's bounding
// box. The `[&_svg]` rules constrain the chevron and the wrapper button
// is sized 44×44 (Apple HIG / WCAG min touch target). The default-class
// reset (classNames="") was also needed because the library ships its
// own .rdp-button class with absolute positioning that the user-supplied
// classNames *augment*, they don't replace.

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('rdp-hc p-2', className)}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'space-y-3',
        month_caption:
          'flex justify-center pt-1 pb-1 relative items-center text-sm font-medium text-cocoa-900 h-11',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        // 44x44 touch target with a tightly-sized chevron inside (16x16
        // via [&>svg] override). The whole pill is now clickable, not just
        // the corner where the oversized SVG used to sit.
        button_previous:
          'absolute left-1 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-full text-cocoa-900 hover:bg-cream-100 active:bg-cream-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 [&>svg]:h-4 [&>svg]:w-4',
        button_next:
          'absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-full text-cocoa-900 hover:bg-cream-100 active:bg-cream-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 [&>svg]:h-4 [&>svg]:w-4',
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
