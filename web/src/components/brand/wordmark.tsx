import Image from 'next/image'
import { ASSETS } from '@/lib/brand'
import { cn } from '@/lib/utils'

// "Happy Cake" lockup — the actual logo asset on the left, the wordmark on
// the right in Playfair Display. Matches the canonical lockup the owner
// uses on happycake.us. The logo image lives in /public/assets/logo/* —
// when the file isn't there, next/image hides itself via onError, leaving
// the typographic mark alone (still on-brand).
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
  if (variant === 'mark-only') {
    return (
      <Image
        src={ASSETS.logo.px256}
        alt="Happy Cake"
        width={48}
        height={48}
        className={cn('h-10 w-10 object-contain', className)}
        priority
      />
    )
  }
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
  return (
    <span className={cn('inline-flex items-center gap-3', className)} aria-label="Happy Cake">
      <Image
        src={ASSETS.logo.px256}
        alt=""
        width={44}
        height={44}
        className="h-9 w-9 md:h-10 md:w-10 object-contain shrink-0"
        priority
      />
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
