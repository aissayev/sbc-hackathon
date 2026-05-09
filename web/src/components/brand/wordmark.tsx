'use client'

import * as React from 'react'
import Image from 'next/image'
import { ASSETS } from '@/lib/brand'
import { cn } from '@/lib/utils'

// "Happy Cake" lockup — the actual logo asset on the left, the wordmark on
// the right in Playfair Display. The logo PNG lives in /public/assets/logo/*.
// Until the binary lands, we render a small SVG cake mark in brand sky-blue
// in its place — never a broken-image rectangle.
export function Wordmark({
  className,
  variant = 'horizontal',
  tone = 'cocoa',
}: {
  className?: string
  variant?: 'horizontal' | 'mark-only' | 'wordmark-only'
  tone?: 'cocoa' | 'cream'
}) {
  const text = tone === 'cream' ? 'text-cream' : 'text-cocoa-700'

  if (variant === 'wordmark-only') {
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
    return <Mark size={48} className={cn('h-10 w-10', className)} />
  }

  return (
    <span className={cn('inline-flex items-center gap-3', className)} aria-label="Happy Cake">
      <Mark size={44} className="h-9 w-9 md:h-10 md:w-10 shrink-0" />
      <span
        className={cn(
          'font-display tracking-tight font-semibold leading-none text-[1.4rem] md:text-[1.6rem] flex items-baseline gap-1.5',
          text,
        )}
      >
        <span className="text-sky">Happy</span>
        <span>Cake</span>
      </span>
    </span>
  )
}

// Renders the real logo PNG when available, swaps to a brand-coloured SVG cake
// silhouette on error. Tracks load state so the SVG paints first (no layout
// jump) and the image fades in if it succeeds.
function Mark({ size, className }: { size: number; className?: string }) {
  const [failed, setFailed] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  return (
    <span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      <CakeSvg className={cn('absolute inset-0 transition-opacity duration-200', loaded && !failed ? 'opacity-0' : 'opacity-100')} />
      {!failed && (
        <Image
          src={ASSETS.logo.px256}
          alt=""
          width={size}
          height={size}
          className={cn(
            'object-contain transition-opacity duration-200 relative',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          priority
        />
      )}
    </span>
  )
}

// Brand-coloured cupcake glyph used wherever the real logo PNG isn't on disk
// yet. Sky-blue cup, cocoa stripes, sized to the parent. Works at 16×16 and
// 256×256 without hinting weirdness.
function CakeSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="hc-cup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5EC5F1" />
          <stop offset="100%" stopColor="#00AEEA" />
        </linearGradient>
      </defs>
      {/* dome / frosting */}
      <path
        d="M14 28c0-7 6-12 12-12 1-5 4-9 6-9s5 4 6 9c6 0 12 5 12 12"
        fill="#FFF7EA"
        stroke="#6B3A1E"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* cup */}
      <path d="M14 28h36l-2.5 22a3 3 0 0 1-3 2.6H19.5a3 3 0 0 1-3-2.6L14 28Z" fill="url(#hc-cup)" stroke="#0E2A3C" strokeWidth="2" strokeLinejoin="round" />
      {/* cup stripes */}
      <path d="M22 30v22M32 30v22M42 30v22" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* cherry */}
      <circle cx="32" cy="9" r="2.4" fill="#E94B7B" />
    </svg>
  )
}
