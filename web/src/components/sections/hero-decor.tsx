// Hero decoration — soft, sparse, on-brand.
//
// The previous version (cake slice with a candle, sprinkles, whisk,
// hearts, etc.) read like rough sketches at low opacity — triangle
// silhouettes and stray dashes that looked unfinished. Replaced with
// three large, well-drawn shapes positioned far from the type so they
// frame the hero rather than compete with it: a rounded ribbon arc
// behind the headline, a soft-blur dot cluster behind the form, and a
// hand-drawn cake-bunting line near the trust strip.
//
// All shapes inherit `currentColor`; opacity tuned per shape, never
// above 0.18 so they read as wallpaper. Hidden on small screens.

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
      {/* Ribbon arc — sweeping line behind the headline, top-left. */}
      <RibbonArc className="absolute -top-10 -left-12 h-72 w-72 text-sky-500/20" />

      {/* Bunting — celebratory triangle flags with curve, top-right. */}
      <Bunting className="absolute top-12 right-[18%] h-16 w-64 text-amber-500/35" />

      {/* Confetti dot trio — soft blurred orbs near the form. */}
      <Confetti className="absolute top-1/3 right-[6%] h-44 w-44 text-berry/15" />

      {/* Subtle frosting swoosh near bottom-left. */}
      <Frosting className="absolute -bottom-6 left-[8%] h-24 w-72 text-cocoa-700/10" />
    </div>
  )
}

// ─── Glyphs ──────────────────────────────────────────────────────────

function RibbonArc({ className }: { className?: string }) {
  // A bezier sweep with a thicker stroke. Reads as a friendly hand-drawn
  // banner, not a clip-art ribbon.
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      stroke="currentColor"
      strokeWidth="14"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M16 130 C 60 60, 160 40, 220 88" />
      <path
        d="M28 154 C 72 90, 168 70, 224 112"
        opacity="0.4"
        strokeWidth="10"
      />
    </svg>
  )
}

function Bunting({ className }: { className?: string }) {
  // Five small triangle flags hanging from a gentle curve.
  return (
    <svg viewBox="0 0 320 80" fill="currentColor" className={className} aria-hidden>
      {/* String */}
      <path
        d="M8 20 C 80 50, 240 50, 312 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Flags — alternating fill so the row reads playful */}
      {[
        { x: 50, fill: 0.55 },
        { x: 110, fill: 0.4 },
        { x: 170, fill: 0.55 },
        { x: 230, fill: 0.4 },
        { x: 290, fill: 0.55 },
      ].map(({ x, fill }) => (
        <path
          key={x}
          d={`M${x - 12} 32 L${x + 12} 32 L${x} 60 Z`}
          fillOpacity={fill}
        />
      ))}
    </svg>
  )
}

function Confetti({ className }: { className?: string }) {
  // Three soft circles in a loose triangle, no hard edges.
  return (
    <svg viewBox="0 0 180 180" fill="currentColor" className={className} aria-hidden>
      <circle cx="50" cy="60" r="34" />
      <circle cx="130" cy="50" r="22" opacity="0.6" />
      <circle cx="100" cy="130" r="40" opacity="0.45" />
    </svg>
  )
}

function Frosting({ className }: { className?: string }) {
  // Long swoosh that suggests piped frosting. One stroke, no detail.
  return (
    <svg
      viewBox="0 0 320 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="12"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M16 60 C 60 16, 120 80, 180 36 S 280 30, 312 60" />
    </svg>
  )
}
