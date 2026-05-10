import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Native select with the same chrome as Input — same height, border, focus
// ring, and a chevron affordance so the control reads as a dropdown across
// browsers (default appearance varies wildly otherwise).
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <span className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          'appearance-none flex h-11 w-full rounded-lg border border-cocoa-700/15 bg-bakery px-3.5 pr-10 py-2 text-sm text-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-cream',
          'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-900/55"
      />
    </span>
  ),
)
Select.displayName = 'Select'
