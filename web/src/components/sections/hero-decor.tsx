// Subtle cake-themed SVG decorations for the home hero. Drawn in line-art so
// they read as "doodles on the wall" rather than clip-art — friendly,
// kid-safe, never shouting. Each glyph is positioned absolutely behind the
// hero copy at low opacity. Hidden on small screens (md:block) to keep
// mobile tight.
//
// Glyphs:
//  - Cake slice with a candle (top-left)
//  - Steam swirl (top-right, near the trust strip)
//  - Coffee cup (bottom-left of the hero)
//  - Cherry on stem (mid-right, behind the order form)
//  - Sprinkle dots (scattered, two clusters)
//  - Whisk (bottom-right, near the open-now badge)

import { cn } from '@/lib/utils'

export function HeroDecor({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden hidden md:block',
        className,
      )}
      aria-hidden
    >
      <CakeSlice className="absolute -left-2 top-10 h-20 w-20 text-cocoa-700/15 -rotate-6" />
      <Steam className="absolute right-[14%] top-6 h-14 w-14 text-sky-400/30" />
      <CoffeeCup className="absolute left-[6%] bottom-12 h-16 w-16 text-cocoa-700/15 rotate-3" />
      <Cherry className="absolute right-[8%] bottom-24 h-12 w-12 text-berry/30 -rotate-12" />
      <Whisk className="absolute right-[20%] bottom-8 h-12 w-12 text-cocoa-700/15 rotate-12" />
      <Sprinkle x="12%" y="55%" rotate={-12} className="text-amber-500/40" />
      <Sprinkle x="38%" y="14%" rotate={20} className="text-sky-500/30" />
      <Sprinkle x="58%" y="78%" rotate={-30} className="text-berry/30" />
      <Sprinkle x="80%" y="40%" rotate={10} className="text-amber-500/35" />
      <Hearts className="absolute left-[44%] top-[68%] h-10 w-10 text-berry/25" />
    </div>
  )
}

// ─── Glyphs ───────────────────────────────────────────────────────────────
// Each is a stand-alone SVG, currentColor for stroke so it themes via
// className. Stroke widths kept consistent (1.6) so the line-art feels like
// one hand drew them all.

function CakeSlice({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Slice silhouette (triangle-on-base) */}
      <path d="M10 46 L34 18 L58 46 Z" />
      {/* Two cream layers */}
      <path d="M16 40 L34 22 L52 40" opacity="0.55" />
      <path d="M22 34 L34 26 L46 34" opacity="0.4" />
      {/* Candle */}
      <line x1="34" y1="14" x2="34" y2="6" />
      {/* Flame */}
      <path d="M34 6 c 1 -1 1 -3 0 -4 c -1 1 -1 3 0 4 z" />
    </svg>
  )
}

function Steam({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
      <path d="M22 50 c -4 -6 4 -10 0 -16 c -4 -6 4 -10 0 -16" />
      <path d="M34 52 c -4 -6 4 -10 0 -16 c -4 -6 4 -10 0 -16" />
      <path d="M46 50 c -4 -6 4 -10 0 -16 c -4 -6 4 -10 0 -16" />
    </svg>
  )
}

function CoffeeCup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Cup body */}
      <path d="M14 24 h32 v22 a6 6 0 0 1 -6 6 H20 a6 6 0 0 1 -6 -6 Z" />
      {/* Saucer */}
      <path d="M8 56 h44" />
      {/* Handle */}
      <path d="M46 30 c 8 0 8 12 0 12" />
      {/* Steam */}
      <path d="M24 12 c -2 4 4 4 2 8" opacity="0.7" />
      <path d="M32 10 c -2 4 4 4 2 8" opacity="0.7" />
    </svg>
  )
}

function Cherry({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Stems */}
      <path d="M32 8 c 2 12 -8 18 -14 24" />
      <path d="M32 8 c 0 14 6 18 14 24" />
      {/* Leaf */}
      <path d="M32 12 c 8 -4 12 0 14 4 c -6 4 -12 2 -14 -4 z" fill="currentColor" fillOpacity="0.18" />
      {/* Cherries */}
      <circle cx="18" cy="44" r="10" fill="currentColor" fillOpacity="0.18" />
      <circle cx="46" cy="44" r="10" fill="currentColor" fillOpacity="0.18" />
      {/* Highlights */}
      <path d="M14 40 a 3 3 0 0 1 3 -2" />
      <path d="M42 40 a 3 3 0 0 1 3 -2" />
    </svg>
  )
}

function Whisk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Handle */}
      <line x1="44" y1="8" x2="28" y2="32" />
      {/* Bulb */}
      <ellipse cx="22" cy="44" rx="14" ry="16" />
      {/* Wires */}
      <path d="M28 32 c -8 8 -10 16 -8 24" />
      <path d="M22 30 c -6 10 -6 18 -2 26" />
      <path d="M18 30 c -2 10 0 18 4 26" />
    </svg>
  )
}

function Sprinkle({
  x,
  y,
  rotate = 0,
  className,
}: {
  x: string
  y: string
  rotate?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={cn('absolute h-8 w-8', className)}
      style={{ left: x, top: y, transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <line x1="6" y1="10" x2="12" y2="6" />
      <line x1="20" y1="20" x2="26" y2="14" />
      <line x1="14" y1="26" x2="20" y2="22" />
      <line x1="26" y1="28" x2="32" y2="24" />
    </svg>
  )
}

function Hearts({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} aria-hidden>
      <path d="M16 14 c -4 0 -8 4 -8 8 c 0 8 12 14 12 14 s 12 -6 12 -14 c 0 -4 -4 -8 -8 -8 c -2 0 -4 1 -4 4 c 0 -3 -2 -4 -4 -4 z" opacity="0.6" />
      <path d="M44 30 c -3 0 -6 3 -6 6 c 0 6 8 10 8 10 s 8 -4 8 -10 c 0 -3 -3 -6 -6 -6 c -1 0 -2 0 -2 2 c 0 -2 -1 -2 -2 -2 z" opacity="0.45" />
    </svg>
  )
}
