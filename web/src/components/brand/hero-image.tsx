'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// Hero-grade image that always feels intentional: the brand-pattern panel
// renders underneath and stays visible until the photo loads. If the .webp
// is missing (the binaries land in web/public/assets/* on a separate cycle),
// the photo never paints and the brand panel stays — no broken-image alt
// text, no jarring empty rectangle.

export function HeroImage({
  src,
  alt,
  priority = true,
  className,
  rounded = 'rounded-[28px]',
}: {
  src: string
  alt: string
  priority?: boolean
  className?: string
  rounded?: string
}) {
  const [loaded, setLoaded] = React.useState(false)
  return (
    <div
      className={cn(
        'relative overflow-hidden shadow-lift bg-gradient-to-br from-cream-100 via-cream-200 to-sky-100',
        rounded,
        className,
      )}
    >
      <div className="absolute inset-0 pattern-dots-cocoa opacity-50" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Mark className={cn('h-24 w-24 text-cocoa-700/35 transition-opacity duration-500', loaded && 'opacity-0')} />
      </div>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 540px, 100vw"
        className={cn(
          'object-cover transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 30h40v22a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V30Z" strokeLinejoin="round" />
      <path d="M12 30c0-6 4-10 10-10 1-4 4-7 8-7 4 0 7 3 8 7 6 0 10 4 10 10" strokeLinecap="round" />
      <path d="M22 38v8M32 38v8M42 38v8" strokeLinecap="round" />
      <circle cx="32" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}
