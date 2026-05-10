'use client'

// Hero decoration — editorial pass.
//
// Earlier passes (sparse line-art → "Confetti Morning" → cake-aligned
// glyphs) chased the wow factor through density. The bigger lever was
// always the unused real-cake photography: every leading bakery hero
// (Magnolia, Janjou, Levain) anchors on photo, not abstract decoration.
//
// With the honey-cake photo now carrying the hero's emotional weight,
// decoration becomes restrained accent — only three pieces:
//   1. Bunting sweep across the top (celebration cue, ties columns)
//   2. Frosting swoosh near the bottom (bakery cue, brand color)
//   3. Tiny cake silhouette anchor in the corner (quiet brand mark)
//
// Cursor parallax retained — the photo + decorations drift up to ~8px
// opposite the cursor across three depth tiers. Subtle on purpose:
// "users feel the smoothness but can't explain why" (Builder.io, 2026).
//
// All gated on prefers-reduced-motion. Hidden on small viewports.

import * as React from 'react'
import { cn } from '@/lib/utils'

export function HeroDecor({ className }: { className?: string }) {
  // Cursor parallax — single rAF-throttled mousemove listener sets two
  // CSS custom properties on the root; depth-tier classes consume them
  // via translate3d. No React re-renders.
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let raf = 0
    let nextX = 0
    let nextY = 0

    function onMove(e: MouseEvent) {
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
      {/* Bunting sweep across the top — celebration anchor that ties
          the headline column to the form column. */}
      <div className="absolute top-3 left-[3%] right-[3%] h-20">
        <div className="hero-px-mid h-full w-full">
          <BuntingSweep className="h-full w-full text-amber-500/45" />
        </div>
      </div>

      {/* Frosting swoosh — quiet bakery cue near the bottom. */}
      <div className="absolute -bottom-6 right-[18%]">
        <div className="hero-px-back">
          <Frosting className="h-20 w-72 text-cocoa-700/[0.10]" />
        </div>
      </div>

      {/* Tiny cake silhouette — corner brand mark, opposite the photo so
          it doesn't compete. */}
      <div className="absolute -bottom-4 right-[2%]">
        <div className="hero-px-front">
          <CakeSilhouette className="h-20 w-20 text-cocoa-700/[0.10]" />
        </div>
      </div>
    </div>
  )
}

// ─── Glyphs ──────────────────────────────────────────────────────────

function BuntingSweep({ className }: { className?: string }) {
  // Eight triangle flags hanging from a long, gentle catenary curve.
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

function Frosting({ className }: { className?: string }) {
  // One stroke that suggests piped frosting.
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

function CakeSilhouette({ className }: { className?: string }) {
  // Three-tier layered cake with a single candle. Used as a tiny corner
  // brand mark now that the hero photo carries the cake imagery.
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
