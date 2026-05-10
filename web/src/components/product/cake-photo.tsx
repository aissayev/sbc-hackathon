'use client'

import * as React from 'react'
import Image from 'next/image'
import { pickProductPhoto } from '@/lib/brand'
import { cn } from '@/lib/utils'

// Picks a real photo from the canonical asset pack when one isn't provided
// in the catalog. The `photo_url` field on a product still wins — that's how
// the kitchen will assign specific shots to specific cakes once they're paired
// in the seed. In the hackathon timeline we deterministically rotate through
// the 10 approved product shots so each card always shows the same image
// for the same id.
//
// While the binaries aren't on disk yet, next/image's onError lets us fall
// back to a tasteful brand pattern so cards never render as broken-image
// glyphs. Once the user drops the .webp files into web/public/assets/, the
// fallback disappears.

export function CakePhoto({
  productId,
  name,
  src,
  className,
  aspect = 'square',
  priority = false,
}: {
  productId: string
  name: string
  src?: string | null
  className?: string
  aspect?: 'square' | 'portrait' | 'wide' | '4/3'
  priority?: boolean
}) {
  const aspectClass =
    aspect === 'portrait'
      ? 'aspect-[4/5]'
      : aspect === 'wide'
        ? 'aspect-[16/10]'
        : aspect === '4/3'
          ? 'aspect-[4/3]'
          : 'aspect-square'
  const finalSrc = src && src.trim().length > 0 ? src : pickProductPhoto(productId)
  const [failed, setFailed] = React.useState(false)
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-cream-200', aspectClass, className)}>
      <Fallback productId={productId} className={cn('absolute inset-0', failed ? '' : 'opacity-0')} />
      {!failed && (
        <Image
          src={finalSrc}
          alt={name}
          fill
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          priority={priority}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

const SWATCHES = [
  { from: '#FFFBF3', to: '#F8ECD3' },
  { from: '#FFF7EA', to: '#FBE0E9' },
  { from: '#F8ECD3', to: '#D2EFFC' },
  { from: '#FBE0E9', to: '#FFF7EA' },
]

function Fallback({ productId, className }: { productId: string; className?: string }) {
  let h = 0
  for (let i = 0; i < productId.length; i++) h = (h * 31 + productId.charCodeAt(i)) >>> 0
  const swatch = SWATCHES[h % SWATCHES.length]
  return (
    <div
      className={cn('flex items-center justify-center pattern-dots-cocoa', className)}
      style={{ background: `linear-gradient(135deg, ${swatch.from}, ${swatch.to})` }}
      aria-hidden
    >
      <CakeMark className="h-16 w-16 text-cocoa-700/65" />
    </div>
  )
}

function CakeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 30h40v22a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V30Z" strokeLinejoin="round" />
      <path d="M12 30c0-6 4-10 10-10 1-4 4-7 8-7 4 0 7 3 8 7 6 0 10 4 10 10" strokeLinecap="round" />
      <path d="M22 38v8M32 38v8M42 38v8" strokeLinecap="round" />
      <circle cx="32" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}
