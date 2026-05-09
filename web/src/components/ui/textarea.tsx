import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[88px] w-full rounded-lg border border-cocoa-700/15 bg-bakery px-3.5 py-2.5 text-sm text-ink leading-relaxed',
        'placeholder:text-cocoa-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-cream',
        'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
