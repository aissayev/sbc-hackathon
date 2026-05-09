import * as React from 'react'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Container } from './container'
import { cn } from '@/lib/utils'

// The dark-cocoa CTA band that closes most pages. Until this lived as its
// own component, six pages duplicated the same rounded rectangle, dot
// pattern, and Eyebrow + display-h2 + buttons stack with minor copy variations.
// Now they all share one shape.

export interface CtaBandProps {
  eyebrow?: string
  title: React.ReactNode
  /** Buttons or other action elements. */
  children?: React.ReactNode
  /** When set, pulls in the inner column to keep the headline readable. */
  maxWidth?: 'narrow' | 'wide'
  /** Outer container max-width — most uses sit inside `max-w-5xl`. */
  outerMaxWidth?: 'narrow' | 'wide' | 'full'
  /** Dim variant — for sections where dark cocoa would be too much. */
  variant?: 'cocoa' | 'sky-soft'
  className?: string
}

export function CtaBand({
  eyebrow,
  title,
  children,
  maxWidth = 'narrow',
  outerMaxWidth = 'wide',
  variant = 'cocoa',
  className,
}: CtaBandProps) {
  const innerMax = maxWidth === 'narrow' ? 'max-w-2xl' : 'max-w-3xl'
  const outerMax = outerMaxWidth === 'narrow' ? 'max-w-3xl' : outerMaxWidth === 'wide' ? 'max-w-5xl' : ''
  return (
    <Container as="section" className={cn('mt-20 mb-20', outerMax, className)}>
      <div
        className={cn(
          'rounded-[28px] p-10 md:p-14 relative overflow-hidden',
          variant === 'cocoa' ? 'bg-cocoa-900 text-cream' : 'bg-sky/5 border border-sky/20 text-cocoa-900',
        )}
      >
        {variant === 'cocoa' && (
          <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
        )}
        <div className={cn('relative', innerMax)}>
          {eyebrow && (
            <Eyebrow className={variant === 'cocoa' ? 'text-sky-200' : 'text-sky-700'}>
              {eyebrow}
            </Eyebrow>
          )}
          <p
            className={cn(
              'font-display mt-3 leading-tight [text-wrap:balance]',
              variant === 'cocoa' ? 'text-3xl md:text-4xl' : 'text-2xl md:text-4xl',
            )}
          >
            {title}
          </p>
          {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
        </div>
      </div>
    </Container>
  )
}
