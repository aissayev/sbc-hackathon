import * as React from 'react'
import { Container } from './container'
import { Eyebrow } from '@/components/brand/eyebrow'
import { cn } from '@/lib/utils'

// The eyebrow + h1 + lead + actions pattern used at the top of every page
// except the home (which has its own custom hero). Centralising it keeps
// /menu /dietary /business /chat /order /policies /about hero blocks in
// the same shape — same spacing, same type scale, same balance.

export interface PageHeroProps {
  eyebrow?: string
  title: React.ReactNode
  intro?: React.ReactNode
  /** Right-side slot for an image or visual block — turns the hero into a 2-col grid. */
  visual?: React.ReactNode
  /** Action area (buttons) below the intro paragraph. */
  actions?: React.ReactNode
  /** Status pill / badge below actions (e.g. open/closed state). */
  meta?: React.ReactNode
  /** Constrain the text column when there's no visual. */
  maxWidth?: 'narrow' | 'prose' | 'wide'
  /** Use the gradient hero background. Defaults to true. */
  gradient?: boolean
  className?: string
}

const TEXT_MAX: Record<NonNullable<PageHeroProps['maxWidth']>, string> = {
  narrow: 'max-w-xl',
  prose: 'max-w-3xl',
  wide: 'max-w-4xl',
}

export function PageHero({
  eyebrow,
  title,
  intro,
  visual,
  actions,
  meta,
  maxWidth = 'prose',
  gradient = true,
  className,
}: PageHeroProps) {
  return (
    <section className={cn('relative overflow-hidden', className)}>
      {gradient && <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />}
      <Container
        as="div"
        className={cn(
          'relative pt-12 md:pt-20 pb-12 md:pb-16',
          visual && 'grid gap-10 lg:grid-cols-12 items-center',
        )}
      >
        <div className={cn(visual ? 'lg:col-span-6' : TEXT_MAX[maxWidth])}>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className={cn('display-h1 mt-4 [text-wrap:balance]', eyebrow && 'mt-5')}>{title}</h1>
          {intro && (
            <p className="mt-5 text-lg text-cocoa-900/80 leading-relaxed max-w-xl">{intro}</p>
          )}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
          {meta && <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">{meta}</div>}
        </div>
        {visual && <div className="lg:col-span-6">{visual}</div>}
      </Container>
    </section>
  )
}
