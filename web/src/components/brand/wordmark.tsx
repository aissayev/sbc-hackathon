'use client'

import * as React from 'react'
import Image from 'next/image'
import { ASSETS } from '@/lib/brand'
import { cn } from '@/lib/utils'

// "HappyCake" wordmark (one word, two capitals — brand book §2). The
// official logo asset is a 1024×1024 square containing the "Family sweets
// / HappyCake" lockup (cake illustration arc, "Happy" in sky, "Cake" in
// cocoa, rendered without a space). It's an emblem, not a horizontal
// wordmark — there's no wide variant in the asset pack — so the header
// renders it as a chunky icon at one consistent size on every page. The
// typographic fallback below also renders "HappyCake" as one word so
// screen readers and search snippets read it correctly.
//
// Variants:
//   horizontal     — header / footer chrome (default; emblem-as-icon)
//   mark-only      — same image, sized for tight slots (chips, avatars)
//   wordmark-only  — pure typographic fallback if you ever need text only
//
// Sizes (`size`) map to fixed Tailwind heights. Use `sm` in tight chrome
// (footer columns), `md` everywhere else. The square aspect means going
// taller than ~h-16 turns the lockup into a billboard — avoid.

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
          'font-display tracking-tight font-semibold leading-none inline-flex items-baseline',
          text,
          className,
        )}
        aria-label="HappyCake"
      >
        {/* Two coloured spans render as one continuous word — no whitespace
            or gap between them — so the wordmark reads "HappyCake" to a
            screen reader (and to a copy/paste). */}
        <span className="text-sky">Happy</span><span>Cake</span>
      </span>
    )
  }

  if (variant === 'mark-only') {
    return <LogoImage pxSize={56} className={cn('h-10 w-auto', className)} priority />
  }

  // horizontal — the default header / footer rendering.
  // `lg` extends beyond the header's vertical padding via negative margins
  // so the wordmark reads bigger without inflating the row height (the row
  // height is set by the nav links + button beside it). Visual size goes up
  // ~30%, layout stays put.
  const heightClass =
    size === 'sm' ? 'h-10 md:h-12' : size === 'lg' ? 'h-16 md:h-20 -my-3 md:-my-4' : 'h-12 md:h-14'
  const pxSize = size === 'sm' ? 48 : size === 'lg' ? 80 : 56
  return (
    <span className={cn('inline-flex items-center', className)} aria-label="HappyCake">
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
          'font-display tracking-tight font-semibold leading-none inline-flex items-baseline text-cocoa-700',
          className,
        )}
        aria-label="HappyCake"
      >
        <span className="text-sky">Happy</span><span>Cake</span>
      </span>
    )
  }
  // Pull the largest raster when we know we're rendering big — keeps the
  // edges crisp without eating the layout (Tailwind className still wins).
  const src = pxSize >= 96 ? ASSETS.logo.px1024 : ASSETS.logo.px512
  return (
    <Image
      src={src}
      alt="HappyCake"
      width={Math.round(pxSize * 2.4)}
      height={pxSize}
      className={cn('object-contain', className)}
      priority={priority}
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}
