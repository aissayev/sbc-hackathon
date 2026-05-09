import * as React from 'react'
import { Container } from './container'
import { Eyebrow } from '@/components/brand/eyebrow'
import { cn } from '@/lib/utils'

// Standard page section. Owns the vertical rhythm so individual pages stop
// reinventing `mt-12 md:mt-20` etc. Three spacing tiers map to the page's
// section flow:
//   tight   — first section after the page hero
//   default — between content blocks
//   wide    — first hero-adjacent section that needs a bit more air
type Spacing = 'tight' | 'default' | 'wide'

const SPACING: Record<Spacing, string> = {
  tight: 'mt-12 md:mt-16',
  default: 'mt-16 md:mt-20',
  wide: 'mt-20 md:mt-28',
}

// `tone` lets a section opt into one of the recurring background treatments
// without each page re-implementing the gradient or pattern utilities.
type Tone = 'plain' | 'cream' | 'cocoa' | 'sky'

const TONE: Record<Tone, string> = {
  plain: '',
  cream: 'bg-cream-100',
  cocoa: 'bg-cocoa-900 text-cream',
  sky: 'bg-sky/5',
}

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  spacing?: Spacing
  tone?: Tone
  /** Eyebrow + headline pair. If `eyebrow` set, renders the standard pair above children. */
  eyebrow?: string
  title?: string
  intro?: React.ReactNode
  /** Center the eyebrow/title block. */
  centered?: boolean
  /** Constrain the inner content (handy for body-text sections). */
  maxWidth?: 'prose' | 'narrow' | 'wide' | 'full'
}

const MAX: Record<NonNullable<SectionProps['maxWidth']>, string> = {
  prose: 'max-w-3xl',
  narrow: 'max-w-4xl',
  wide: 'max-w-5xl',
  full: '',
}

export function Section({
  spacing = 'default',
  tone = 'plain',
  eyebrow,
  title,
  intro,
  centered,
  maxWidth = 'full',
  className,
  children,
  ...rest
}: SectionProps) {
  const inner = (
    <Container className={cn(MAX[maxWidth], centered && 'text-center mx-auto', className)}>
      {(eyebrow || title) && (
        <header className={cn(centered && 'mx-auto max-w-2xl')}>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          {title && <h2 className="display-h2 mt-3 [text-wrap:balance]">{title}</h2>}
          {intro && <p className="mt-3 text-cocoa-900/75 leading-relaxed">{intro}</p>}
        </header>
      )}
      <div className={cn(eyebrow || title ? 'mt-8' : '')}>{children}</div>
    </Container>
  )

  // Tones with a background take the spacing as outer padding and stretch
  // edge-to-edge; plain sections keep the `mt-` rhythm directly on Container.
  if (tone !== 'plain') {
    return (
      <section className={cn('py-16 md:py-24', SPACING[spacing], TONE[tone])} {...rest}>
        {inner}
      </section>
    )
  }
  return (
    <section className={cn(SPACING[spacing])} {...rest}>
      {inner}
    </section>
  )
}
