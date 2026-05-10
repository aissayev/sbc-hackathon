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
//
// Sizes (`size`) map to fixed Tailwind heights so the header lockup stays
// visually proportional to the rest of the chrome on every breakpoint.

export function Wordmark({
  className,
  variant = 'horizontal',
  tone = 'cocoa',
  size = 'md',
}: {
  className?: string
  variant?: 'horizontal' | 'mark-only' | 'wordmark-only'
  tone?: 'cocoa' | 'cream'
  size?: 'sm' | 'md' | 'lg'
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
    return <LogoImage pxSize={56} className={cn('h-10 w-auto', className)} priority />
  }

  // horizontal — the default header / footer rendering. The `lg` step is
  // what the home-page header uses; `md` is the previous default for inner
  // pages and the footer.
  const heightClass =
    size === 'lg'
      ? 'h-14 md:h-20 lg:h-24'
      : size === 'sm'
        ? 'h-10 md:h-12'
        : 'h-12 md:h-16'
  // Render a chunky raster so retina + zoomed-in displays stay crisp at the
  // larger header sizes (the source asset is 1024px so we have headroom).
  const pxSize = size === 'lg' ? 112 : size === 'sm' ? 56 : 80
  return (
    <span className={cn('inline-flex items-center', className)} aria-label="Happy Cake">
      <LogoImage pxSize={pxSize} className={cn(heightClass, 'w-auto shrink-0')} priority />
    </span>
  )
}

// next/image, served from the hackathon CDN. Falls back to the typographic
// wordmark in brand colours if the asset 404s so the header is never empty.
function LogoImage({
  pxSize,
  className,
  priority,
}: {
  pxSize: number
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
  // Pull the largest raster when we know we're rendering big — keeps the
  // edges crisp without eating the layout (Tailwind className still wins).
  const src = pxSize >= 96 ? ASSETS.logo.px1024 : ASSETS.logo.px512
  return (
    <Image
      src={src}
      alt="Happy Cake"
      width={Math.round(pxSize * 2.4)}
      height={pxSize}
      className={cn('object-contain', className)}
      priority={priority}
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}
