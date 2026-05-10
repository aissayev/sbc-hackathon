import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Pill-shaped buttons matching happycake.us café feel.
// Primary CTA is brand sky (was cocoa) — owner preference for the lead
// action across the site. Cocoa stays available via the explicit `cocoa`
// variant for the rare cases where a dark filled button is the right call
// (e.g. inside a sky-tinted band where sky-on-sky would disappear). The
// `sky` name is preserved as an alias of default for backward compat
// with existing call sites that asked for it explicitly.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-cream disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-sky text-white hover:bg-sky-700 hover:-translate-y-0.5 shadow-sm',
        sky: 'bg-sky text-white hover:bg-sky-700 hover:-translate-y-0.5 shadow-sm',
        cocoa: 'bg-cocoa-700 text-cream hover:bg-cocoa-900 hover:-translate-y-0.5',
        secondary: 'bg-cream-200 text-cocoa-900 hover:bg-cream-300 border border-cocoa-700/15',
        outline:
          'border border-cocoa-700/30 bg-transparent text-cocoa-900 hover:bg-cream-100',
        'outline-sky':
          'border border-sky text-sky hover:bg-sky hover:text-white hover:-translate-y-0.5',
        ghost: 'text-cocoa-900 hover:bg-cream-200',
        link: 'text-sky-700 underline-offset-4 hover:underline',
        destructive: 'bg-berry text-cream hover:bg-berry/90',
      },
      size: {
        default: 'h-11 px-6 text-sm',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-12 px-7 text-base',
        xl: 'h-14 px-8 text-base',
        icon: 'h-10 w-10',
      },
      shape: {
        pill: 'rounded-full',
        square: 'rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default', shape: 'pill' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, shape, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
