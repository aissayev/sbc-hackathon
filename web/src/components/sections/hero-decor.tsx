'use client'

// Hero decoration — "Confetti Morning v2" (cake-aligned).
//
// Research pass (2026 bakery hero patterns): the strongest small-bakery
// heroes pair a warm-gradient backdrop with hand-drawn pastry illustrations
// and a *very* subtle depth cue (cursor-driven micro-parallax — "users
// feel the smoothness but can't explain why"). Generic sparkle stars and
// abstract shapes read as "celebration" but not specifically "bakery";
// pastry glyphs (cherry, macaron, cupcake, croissant, heart) say bakery
// without leaning on stock photography.
//
// All shapes inherit `currentColor`. Opacity tuned so accents read as
// atmosphere, never as UI. Hidden on small viewports (form dominates).
//
// Animation:
//   1. Bobbing — small vertical drift on sprinkles (existing, unchanged)
//   2. Twinkling — opacity/scale pulse on sparkles (existing, unchanged)
//   3. Cursor parallax (NEW) — when the mouse moves, decorations drift up
//      to ~6px in the opposite direction of the cursor. Different layers
//      have different multipliers so the field gains depth (foreground
//      moves more than background).
// All three respect prefers-reduced-motion via CSS.

import * as React from 'react'
import { cn } from '@/lib/utils'

export function HeroDecor({ className }: { className?: string }) {
  // Cursor parallax — sets two CSS custom properties on the root that
  // child elements consume via `transform: translate(...)`. The math is
  // intentionally tiny (max 6px) so motion is felt, not seen.
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let raf = 0
    let nextX = 0
    let nextY = 0

    function onMove(e: MouseEvent) {
      // Normalize cursor to [-1, 1] across viewport, scale to 6px
      // and invert (decorations drift opposite the cursor for parallax).
      nextX = -((e.clientX / window.innerWidth) * 2 - 1) * 6
      nextY = -((e.clientY / window.innerHeight) * 2 - 1) * 6
      if (raf) return
      raf = requestAnimationFrame(() => {
        const el = rootRef.current
        if (el) {
          el.style.setProperty('--px', `${nextX.toFixed(2)}px`)
          el.style.setProperty('--py', `${nextY.toFixed(2)}px`)
        }
        raf = 0
      })
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden hidden md:block',
        className,
      )}
      style={{ '--px': '0px', '--py': '0px' } as React.CSSProperties}
      aria-hidden
    >
      {/* Bunting sweep across the top — celebratory anchor that ties the
          left and right columns together. (Parallax depth: 0.4×) */}
      <div className="absolute top-3 left-[3%] right-[3%] h-20">
        <div className="hero-px-back h-full w-full">
          <BuntingSweep className="h-full w-full text-amber-500/40" />
        </div>
      </div>

      {/* Soft sky ribbon arc behind the headline. (Background, no parallax) */}
      <RibbonArc className="absolute -top-12 -left-12 h-72 w-72 text-sky-500/25" />

      {/* Confetti orbs — soft blurry cluster for depth on the right side. */}
      <div className="absolute top-1/3 right-[6%] h-44 w-44">
        <div className="hero-px-back h-full w-full">
          <Confetti className="h-full w-full text-berry/15" />
        </div>
      </div>

      {/* Subtle steam wisp — bakery warmth, mid-left. */}
      <div className="absolute top-[42%] left-[6%] h-32 w-12">
        <div className="hero-px-mid h-full w-full">
          <SteamWisp className="h-full w-full text-sky-300/40" />
        </div>
      </div>

      {/* Frosting swoosh — bottom accent. */}
      <Frosting className="absolute -bottom-6 left-[26%] h-20 w-72 text-cocoa-700/12" />

      {/* Stylized layered cake — anchor element that says "this is a
          cake bakery" without competing with the headline or the form. */}
      <div className="absolute -bottom-8 -left-6 h-44 w-44">
        <div className="hero-px-back h-full w-full">
          <CakeSilhouette className="h-full w-full text-cocoa-700/[0.10]" />
        </div>
      </div>

      {/* Pastry glyph scatter — small hand-drawn cake/pastry icons.
          Three nested layers: outer = position, middle = parallax,
          inner = twinkle. Two transforms (parallax + animation) on the
          same element fight; nesting lets them compose cleanly. */}
      {PASTRY_ICONS.map((p, i) => {
        const Glyph = GLYPHS[p.glyph]
        return (
          <div key={i} className={cn('absolute', p.position)}>
            <div className={p.depth}>
              <div
                className="hero-twinkle"
                style={{ animationDelay: `${i * 0.6}s` }}
              >
                <Glyph className={cn(p.size, p.color)} />
              </div>
            </div>
          </div>
        )
      })}

      {/* Sprinkle field — tilted line-sprinkles distributed across the
          hero. Trimmed from the previous 25 to a curated 18 with tighter
          tilts; reads as designed scatter, not random clutter. */}
      <SprinkleField />
    </div>
  )
}

// ─── Pastry-icon scatter ─────────────────────────────────────────────
//
// Mix of hand-drawn pastry glyphs and a couple of sparkle accents.
// Positions hand-tuned to avoid the form (right ~40% of viewport) and
// the headline column. Each carries a parallax depth class so motion
// gains layered depth rather than uniform drift.

type GlyphName =
  | 'cherry'
  | 'macaron'
  | 'cupcake'
  | 'croissant'
  | 'heart'
  | 'donut'
  | 'sparkle'

const PASTRY_ICONS: Array<{
  glyph: GlyphName
  position: string
  size: string
  color: string
  depth: 'hero-px-front' | 'hero-px-mid' | 'hero-px-back'
}> = [
  { glyph: 'cherry',    position: 'top-[12%] left-[44%]',  size: 'h-7 w-7',  color: 'text-berry/55',       depth: 'hero-px-front' },
  { glyph: 'sparkle',   position: 'top-[28%] left-[10%]',  size: 'h-5 w-5',  color: 'text-sky-500/60',     depth: 'hero-px-mid' },
  { glyph: 'macaron',   position: 'top-[68%] left-[34%]',  size: 'h-7 w-7',  color: 'text-berry/45',       depth: 'hero-px-front' },
  { glyph: 'heart',     position: 'top-[80%] right-[46%]', size: 'h-5 w-5',  color: 'text-berry/50',       depth: 'hero-px-mid' },
  { glyph: 'cupcake',   position: 'top-[8%] right-[26%]',  size: 'h-8 w-8',  color: 'text-cocoa-700/35',   depth: 'hero-px-front' },
  { glyph: 'sparkle',   position: 'top-[55%] left-[2%]',   size: 'h-4 w-4',  color: 'text-amber-500/60',   depth: 'hero-px-back' },
  { glyph: 'donut',     position: 'top-[88%] left-[18%]',  size: 'h-6 w-6',  color: 'text-amber-500/45',   depth: 'hero-px-mid' },
  { glyph: 'croissant', position: 'top-[36%] right-[2%]',  size: 'h-7 w-7',  color: 'text-amber-500/40',   depth: 'hero-px-back' },
  { glyph: 'sparkle',   position: 'top-[60%] right-[40%]', size: 'h-3 w-3',  color: 'text-berry/55',       depth: 'hero-px-front' },
]

// ─── Glyphs ──────────────────────────────────────────────────────────

function RibbonArc({ className }: { className?: string }) {
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
      <path d="M28 154 C 72 90, 168 70, 224 112" opacity="0.4" strokeWidth="10" />
    </svg>
  )
}

function BuntingSweep({ className }: { className?: string }) {
  const flags = [80, 160, 240, 320, 400, 480, 560, 640]
  return (
    <svg
      viewBox="0 0 720 80"
      fill="currentColor"
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <path
        d="M10 18 C 180 60, 540 60, 710 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {flags.map((x, i) => (
        <path
          key={x}
          d={`M${x - 14} 36 L${x + 14} 36 L${x} 64 Z`}
          fillOpacity={i % 2 === 0 ? 0.7 : 0.42}
        />
      ))}
    </svg>
  )
}

function Confetti({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 180" fill="currentColor" className={className} aria-hidden>
      <circle cx="50" cy="60" r="34" />
      <circle cx="130" cy="50" r="22" opacity="0.6" />
      <circle cx="100" cy="130" r="40" opacity="0.45" />
    </svg>
  )
}

function Frosting({ className }: { className?: string }) {
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

function SteamWisp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 110 C 24 90, 4 70, 18 50 C 30 30, 8 20, 20 4" />
      <path d="M28 116 C 16 96, 32 78, 22 58" opacity="0.55" />
    </svg>
  )
}

function CakeSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="currentColor" className={className} aria-hidden>
      <ellipse cx="100" cy="178" rx="78" ry="6" />
      <rect x="22" y="124" width="156" height="50" rx="6" />
      <rect x="44" y="86" width="112" height="42" rx="5" />
      <rect x="68" y="54" width="64" height="36" rx="4" />
      <rect x="96" y="32" width="8" height="22" rx="2" />
      <ellipse cx="100" cy="24" rx="4" ry="8" opacity="0.7" />
      <circle cx="60" cy="124" r="3" opacity="0.55" />
      <circle cx="100" cy="124" r="3" opacity="0.55" />
      <circle cx="140" cy="124" r="3" opacity="0.55" />
      <circle cx="70" cy="86" r="2.5" opacity="0.55" />
      <circle cx="100" cy="86" r="2.5" opacity="0.55" />
      <circle cx="130" cy="86" r="2.5" opacity="0.55" />
    </svg>
  )
}

// ─── Pastry glyphs ───────────────────────────────────────────────────

type GlyphProps = { className?: string }

function Cherry({ className }: GlyphProps) {
  // Two cherries on a curved stem — quintessential cake topper.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M9 4 C 14 6, 18 9, 16 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7"  cy="17" r="4.2" />
      <circle cx="16" cy="18" r="4.2" opacity="0.85" />
      {/* Highlight dots so cherries read as round, not flat */}
      <circle cx="6"  cy="15.5" r="0.8" fill="white" opacity="0.5" />
      <circle cx="15" cy="16.5" r="0.7" fill="white" opacity="0.5" />
    </svg>
  )
}

function Macaron({ className }: GlyphProps) {
  // Two domes with a filling stripe — unmistakable macaron silhouette.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3 8 C 3 4, 21 4, 21 8 L 21 10 L 3 10 Z" />
      <path d="M3 16 C 3 20, 21 20, 21 16 L 21 14 L 3 14 Z" />
      <rect x="3" y="10.5" width="18" height="3" opacity="0.5" />
    </svg>
  )
}

function Cupcake({ className }: GlyphProps) {
  // Frosting swirl + base + liner stripes.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* Frosting swirl (filled) */}
      <path d="M6 11 C 6 6, 18 6, 18 11 C 18 11, 16 9, 12 9 C 8 9, 6 11, 6 11 Z" fill="currentColor" stroke="none" />
      <path d="M7.5 11 C 9 8, 15 8, 16.5 11" fill="currentColor" stroke="none" opacity="0.7" />
      {/* Liner */}
      <path d="M6 12 L 7.5 21 L 16.5 21 L 18 12 Z" fill="currentColor" stroke="none" opacity="0.55" />
      {/* Liner stripes */}
      <line x1="9" y1="13" x2="9.7" y2="20.5" stroke="white" strokeWidth="0.8" opacity="0.45" />
      <line x1="12" y1="13" x2="12" y2="20.5" stroke="white" strokeWidth="0.8" opacity="0.45" />
      <line x1="15" y1="13" x2="14.3" y2="20.5" stroke="white" strokeWidth="0.8" opacity="0.45" />
    </svg>
  )
}

function Croissant({ className }: GlyphProps) {
  // Curved crescent with diagonal segment lines — reads as croissant.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4 16 C 4 8, 12 4, 20 8 C 16 6, 11 8, 9 13 C 7 17, 11 19, 16 18 C 11 21, 4 21, 4 16 Z" />
      {/* Layer ridges */}
      <path d="M9 13 L 11 12" stroke="white" strokeWidth="0.6" opacity="0.45" />
      <path d="M11 15 L 13 14" stroke="white" strokeWidth="0.6" opacity="0.45" />
      <path d="M13 17 L 15 16" stroke="white" strokeWidth="0.6" opacity="0.45" />
    </svg>
  )
}

function Heart({ className }: GlyphProps) {
  // Plump little heart — love for the bakery.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 21 C 4 15, 2 9, 6 6 C 9 4, 11 6, 12 8 C 13 6, 15 4, 18 6 C 22 9, 20 15, 12 21 Z" />
    </svg>
  )
}

function Donut({ className }: GlyphProps) {
  // Ring with sprinkle dots on top.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 4 A 8 8 0 1 0 12 20 A 8 8 0 1 0 12 4 Z M12 9 A 3 3 0 1 1 12 15 A 3 3 0 1 1 12 9 Z" fillRule="evenodd" />
      {/* Sprinkles on glaze */}
      <line x1="7"  y1="8"  x2="8"  y2="9"  stroke="white" strokeWidth="0.9" opacity="0.6" />
      <line x1="16" y1="8"  x2="17" y2="9"  stroke="white" strokeWidth="0.9" opacity="0.6" />
      <line x1="6"  y1="14" x2="7"  y2="15" stroke="white" strokeWidth="0.9" opacity="0.6" />
      <line x1="17" y1="14" x2="18" y2="15" stroke="white" strokeWidth="0.9" opacity="0.6" />
    </svg>
  )
}

function Sparkle({ className }: GlyphProps) {
  // Four-point sparkle (Notion-AI style) — magic accent.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 0 C 12 7, 17 12, 24 12 C 17 12, 12 17, 12 24 C 12 17, 7 12, 0 12 C 7 12, 12 7, 12 0 Z" />
    </svg>
  )
}

const GLYPHS: Record<GlyphName, (p: GlyphProps) => React.JSX.Element> = {
  cherry: Cherry,
  macaron: Macaron,
  cupcake: Cupcake,
  croissant: Croissant,
  heart: Heart,
  donut: Donut,
  sparkle: Sparkle,
}

// ─── Sprinkle field ──────────────────────────────────────────────────
//
// 18 hand-tuned tilted line-sprinkles. Trimmed from 25 in v1; fewer
// pieces with stronger color reads more "designed scatter" and less
// "background noise". Foreground layer carries the strongest parallax.

const SPRINKLES: Array<{ x: number; y: number; r: number; c: string }> = [
  { x:  8, y: 14, r:  30, c: 'text-amber-500/60' },
  { x: 24, y: 50, r: -25, c: 'text-sky-500/55' },
  { x: 36, y: 26, r:  60, c: 'text-berry/50' },
  { x: 48, y:  6, r: -45, c: 'text-amber-500/55' },
  { x: 62, y: 20, r:  15, c: 'text-sky-500/50' },
  { x: 78, y: 12, r: -10, c: 'text-berry/50' },
  { x:  4, y: 38, r: -55, c: 'text-sky-500/45' },
  { x: 18, y: 46, r:  22, c: 'text-berry/40' },
  { x: 30, y: 56, r: -30, c: 'text-amber-500/50' },
  { x: 44, y: 40, r:  70, c: 'text-sky-500/45' },
  { x: 52, y: 84, r:  35, c: 'text-sky-500/45' },
  { x: 66, y: 92, r: -50, c: 'text-berry/45' },
  { x: 76, y: 60, r:  20, c: 'text-amber-500/50' },
  { x: 86, y: 80, r: -35, c: 'text-sky-500/45' },
  { x: 96, y: 90, r:  15, c: 'text-berry/45' },
  { x: 12, y: 70, r:  80, c: 'text-amber-500/45' },
  { x: 28, y: 88, r: -65, c: 'text-sky-500/40' },
  { x: 70, y: 32, r: -75, c: 'text-amber-500/50' },
]

function SprinkleField() {
  // Two-level nesting so per-sprinkle rotation survives the parallax
  // transform. Sprinkles are static (no bob) — motion lives on the
  // pastry icons (twinkle) and the field as a whole (parallax). Adding
  // bob here would require a third nesting level and the field already
  // feels alive enough.
  return (
    <div className="absolute inset-0 hero-px-mid" aria-hidden>
      {SPRINKLES.map((s, i) => (
        <span
          key={i}
          className={cn('absolute block w-3 h-[3px] rounded-full bg-current', s.c)}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `rotate(${s.r}deg)`,
          }}
        />
      ))}
    </div>
  )
}
