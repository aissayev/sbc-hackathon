import { cn } from '@/lib/utils'

// We don't ship product photography in the seed yet — BRANDBOOK §4 forbids
// AI-generated cake photos. Until real shots arrive we render a tasteful
// placeholder built from the brand patterns and palette so cards still feel
// like HappyCake instead of a Lorem-Picsum holding pattern.

const SWATCHES = [
  { from: 'from-cream-100', to: 'to-cream-200', dot: 'pattern-dots-blue' },
  { from: 'from-happy-200', to: 'to-cream-100', dot: 'pattern-dots-cream' },
  { from: 'from-cream-200', to: 'to-happy-200', dot: 'pattern-dots-blue' },
  { from: 'from-cream-50', to: 'to-cream-200', dot: 'pattern-dots-blue' },
]

function pickSwatch(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return SWATCHES[h % SWATCHES.length]
}

export function CakePhoto({
  productId,
  name,
  src,
  className,
  aspect = 'square',
}: {
  productId: string
  name: string
  src?: string | null
  className?: string
  aspect?: 'square' | 'portrait' | 'wide'
}) {
  const aspectClass =
    aspect === 'portrait' ? 'aspect-[4/5]' : aspect === 'wide' ? 'aspect-[16/10]' : 'aspect-square'

  if (src) {
    return (
      <div className={cn('overflow-hidden rounded-lg bg-cream-100', aspectClass, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    )
  }

  const swatch = pickSwatch(productId)
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-gradient-to-br',
        swatch.from,
        swatch.to,
        aspectClass,
        className,
      )}
      role="img"
      aria-label={name}
    >
      <div className={cn('absolute inset-0 opacity-70', swatch.dot)} aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center">
        <CakeMark className="h-16 w-16 text-happy-700/70" />
      </div>
      <div className="absolute bottom-3 left-4 right-4 text-[11px] uppercase tracking-[0.16em] text-happy-900/70">
        ◆ photo coming soon
      </div>
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
