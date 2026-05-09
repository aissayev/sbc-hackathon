'use client'

import * as React from 'react'
import Image from 'next/image'
import { ASSETS } from '@/lib/brand'
import { cn } from '@/lib/utils'

// "Happy Cake" wordmark. The official logo asset already contains the
// "Family sweets / Happy Cake" lockup, so the header just renders the image —
// no separate cupcake glyph and no duplicated text.
//
// Variants:
//   horizontal     — header / footer chrome (logo at inline height)
//   mark-only      — same image, sized for tight slots (chips, avatars)
//   wordmark-only  — pure typographic fallback if you ever need text only

export function Wordmark({
  className,
  variant = 'horizontal',
  tone = 'cocoa',
}: {
  className?: string
  variant?: 'horizontal' | 'mark-only' | 'wordmark-only'
  tone?: 'cocoa' | 'cream'
}) {
  if (variant === 'wordmark-only') {
    const text = tone === 'cream' ? 'text-cream' : 'text-cocoa-700'
    return (
      <span
        className={cn(
          'font-display tracking-tight font-semibold leading-none flex items-baseline gap-1.5',
          text,
          className,
        )}
      >
        <span className="text-sky">Happy</span>
        <span>Cake</span>
      </span>
    )
  }

  if (variant === 'mark-only') {
    return <LogoImage size={40} className={cn('h-10 w-auto', className)} priority />
  }

  // horizontal — the default header / footer rendering
  return (
    <span className={cn('inline-flex items-center', className)} aria-label="Happy Cake">
      <LogoImage size={64} className="h-12 md:h-16 w-auto shrink-0" priority />
    </span>
  )
}

// next/image, served from the hackathon CDN. Falls back to the typographic
// wordmark in brand colours if the asset 404s so the header is never empty.
function LogoImage({
  size,
  className,
  priority,
}: {
  size: number
  className?: string
  priority?: boolean
}) {
  const [failed, setFailed] = React.useState(false)
  if (failed) {
    return (
      <span
        className={cn(
          'font-display tracking-tight font-semibold leading-none flex items-baseline gap-1.5 text-cocoa-700',
          className,
        )}
      >
        <span className="text-sky">Happy</span>
        <span>Cake</span>
      </span>
    )
  }
  return (
    <Image
      src={ASSETS.logo.px512}
      alt="Happy Cake"
      width={Math.round(size * 2.4)}
      height={size}
      className={cn('object-contain', className)}
      priority={priority}
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}
