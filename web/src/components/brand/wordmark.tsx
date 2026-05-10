'use client'

import * as React from 'react'
import Image from 'next/image'
import { ASSETS } from '@/lib/brand'
import { cn } from '@/lib/utils'

// "Happy Cake" wordmark. The official logo asset is a 1024×1024 square
// containing the "Family sweets / Happy Cake" lockup (cake illustration
// arc, "Happy" in sky, "Cake" in cocoa). It's an emblem, not a horizontal
// wordmark — there's no wide variant in the asset pack — so the header
// renders it as a chunky icon at one consistent size on every page.
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
  size?: 'sm' | 'md'
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

  // horizontal — the default header / footer rendering.
  const heightClass = size === 'sm' ? 'h-10 md:h-12' : 'h-12 md:h-14'
  const pxSize = size === 'sm' ? 48 : 56
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
