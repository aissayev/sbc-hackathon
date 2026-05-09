import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-cream-200 text-cocoa-900',
        outline: 'border-cocoa-700/25 text-cocoa-900',
        sky: 'border-transparent bg-sky-100 text-sky-700',
        cocoa: 'border-transparent bg-cocoa-700 text-cream',
        berry: 'border-transparent bg-berry-100 text-berry',
        sage: 'border-transparent bg-emerald-100 text-emerald-700',
        coral: 'border-transparent bg-berry-100 text-berry',
        blue: 'border-transparent bg-sky-100 text-sky-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
