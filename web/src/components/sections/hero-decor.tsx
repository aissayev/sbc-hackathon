// Hero decoration — "Confetti Morning".
//
// Earlier passes tried two extremes: literal cake/whisk/cherry sketches
// (read as unfinished doodles), then an over-restrained 4-shape composition
// (read as accidental). This pass goes for ambient celebration: a wider
// bunting sweep, a scattered sprinkle field, twinkling sparkle stars, soft
// confetti orbs, a steam wisp, and a frosting swoosh — layered so the hero
// feels like a small bakery at golden hour, not a wireframe.
//
// All shapes inherit `currentColor`. Opacity is tuned per shape (never
// above ~0.55 for accents, ~0.18 for shapes behind type) so they read as
// atmosphere rather than UI. Hidden on small screens because the form
// dominates the viewport there.

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
      {/* Bunting sweep across the top — celebratory anchor that ties the
          left and right columns together. */}
      <BuntingSweep className="absolute top-3 left-[3%] right-[3%] h-20 text-amber-500/40" />

      {/* Soft sky ribbon arc behind the headline. */}
      <RibbonArc className="absolute -top-12 -left-12 h-72 w-72 text-sky-500/25" />

      {/* Confetti orbs — soft blurry cluster for depth on the right side. */}
      <Confetti className="absolute top-1/3 right-[6%] h-44 w-44 text-berry/15" />

      {/* Subtle steam wisp — bakery warmth, mid-left. */}
      <SteamWisp className="absolute top-[42%] left-[6%] h-32 w-12 text-sky-300/40" />

      {/* Frosting swoosh — bottom-left accent. */}
      <Frosting className="absolute -bottom-6 left-[26%] h-20 w-72 text-cocoa-700/12" />

      {/* Stylized layered cake — anchor element that says "this is a
          cake bakery" without competing with the headline or the form.
          Sits low and slightly off-screen so it reads as wallpaper. */}
      <CakeSilhouette className="absolute -bottom-8 -left-6 h-44 w-44 text-cocoa-700/[0.10]" />

      {/* Sparkle stars — joy in the air. Each gets a tiny bobbing motion
          with a varied delay so they don't twinkle in unison. */}
      {SPARKLES.map((s, i) => (
        <SparkleAccent
          key={i}
          className={cn(
            'absolute hero-twinkle',
            s.size,
            s.position,
            s.color,
          )}
          style={{ animationDelay: `${i * 0.7}s` }}
        />
      ))}

      {/* Sprinkle field — many tiny tilted sprinkles distributed across
          the hero. Gives the "celebration in the air" feeling that a few
          isolated accents can't deliver on their own. */}
      <SprinkleField />
    </div>
  )
}

// ─── Sparkle config ──────────────────────────────────────────────────

const SPARKLES = [
  { position: 'top-[12%] left-[44%]',  size: 'h-7 w-7',  color: 'text-amber-500/65' },
  { position: 'top-[28%] left-[10%]',  size: 'h-5 w-5',  color: 'text-sky-500/60' },
  { position: 'top-[68%] left-[34%]',  size: 'h-6 w-6',  color: 'text-berry/55' },
  { position: 'top-[80%] right-[44%]', size: 'h-5 w-5',  color: 'text-sky-500/55' },
  { position: 'top-[8%] right-[26%]',  size: 'h-6 w-6',  color: 'text-berry/55' },
  { position: 'top-[55%] left-[2%]',   size: 'h-4 w-4',  color: 'text-amber-500/60' },
  { position: 'top-[88%] left-[18%]',  size: 'h-4 w-4',  color: 'text-amber-500/55' },
  { position: 'top-[34%] right-[2%]',  size: 'h-4 w-4',  color: 'text-amber-500/55' },
  { position: 'top-[60%] right-[38%]', size: 'h-3 w-3',  color: 'text-berry/55' },
] as const

// ─── Glyphs ──────────────────────────────────────────────────────────

function RibbonArc({ className }: { className?: string }) {
  // Two parallel bezier sweeps — friendly hand-drawn banner feel.
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

function BuntingSweep({ className }: { className?: string }) {
  // Eight triangle flags hanging from a long, gentle catenary curve.
  // Wider than the previous bunting (640 vs 320 viewBox width) so it
  // spans the hero rather than tucking into one corner.
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

function SparkleAccent({
  className,
  style,
}: { className?: string; style?: React.CSSProperties }) {
  // Four-point sparkle (Notion AI / Apple Intelligence style) — reads as
  // joy/magic, not a literal star. Concave-cubic sides give the soft
  // pinched look.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M12 0 C 12 7, 17 12, 24 12 C 17 12, 12 17, 12 24 C 12 17, 7 12, 0 12 C 7 12, 12 7, 12 0 Z" />
    </svg>
  )
}

function CakeSilhouette({ className }: { className?: string }) {
  // Three-tier layered cake with a single candle. Drawn as filled rounded
  // rectangles + a small flame so it reads as a friendly silhouette, not
  // a wireframe. Single fill colour via currentColor; opacity controlled
  // by the className text-* alpha.
  return (
    <svg viewBox="0 0 200 200" fill="currentColor" className={className} aria-hidden>
      {/* Plate */}
      <ellipse cx="100" cy="178" rx="78" ry="6" />
      {/* Bottom tier */}
      <rect x="22" y="124" width="156" height="50" rx="6" />
      {/* Middle tier */}
      <rect x="44" y="86" width="112" height="42" rx="5" />
      {/* Top tier */}
      <rect x="68" y="54" width="64" height="36" rx="4" />
      {/* Candle */}
      <rect x="96" y="32" width="8" height="22" rx="2" />
      {/* Flame */}
      <ellipse cx="100" cy="24" rx="4" ry="8" opacity="0.7" />
      {/* Frosting drip detail on each tier */}
      <circle cx="60" cy="124" r="3" opacity="0.55" />
      <circle cx="100" cy="124" r="3" opacity="0.55" />
      <circle cx="140" cy="124" r="3" opacity="0.55" />
      <circle cx="70" cy="86" r="2.5" opacity="0.55" />
      <circle cx="100" cy="86" r="2.5" opacity="0.55" />
      <circle cx="130" cy="86" r="2.5" opacity="0.55" />
    </svg>
  )
}

function SteamWisp({ className }: { className?: string }) {
  // Two undulating vertical strokes — gentle warmth rising. Subtle on
  // purpose; the second stroke at lower opacity adds depth.
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

// ─── Sprinkle field ──────────────────────────────────────────────────
//
// Many tiny tilted line-sprinkles distributed across the hero. Positions
// are hand-tuned (not random) so the field feels designed — random
// scatter tends to clump. Each sprinkle bobs gently with a varied delay.
//
// Sprinkles render as <span> with `bg-current` so they pick up the
// per-item `text-*` color class without needing inline styles for color.

const SPRINKLES: Array<{ x: number; y: number; r: number; c: string }> = [
  { x:  6, y: 14, r:  30, c: 'text-amber-500/55' },
  { x: 22, y:  8, r: -20, c: 'text-sky-500/50' },
  { x: 36, y: 26, r:  60, c: 'text-berry/45' },
  { x: 48, y:  6, r: -45, c: 'text-amber-500/55' },
  { x: 62, y: 20, r:  15, c: 'text-sky-500/50' },
  { x: 78, y: 12, r: -10, c: 'text-berry/45' },
  { x: 90, y: 26, r:  40, c: 'text-amber-500/55' },
  { x:  4, y: 38, r: -55, c: 'text-sky-500/45' },
  { x: 18, y: 46, r:  22, c: 'text-berry/40' },
  { x: 30, y: 56, r: -30, c: 'text-amber-500/50' },
  { x: 44, y: 40, r:  70, c: 'text-sky-500/45' },
  { x: 56, y: 52, r: -15, c: 'text-berry/45' },
  { x:  8, y: 64, r:  50, c: 'text-amber-500/50' },
  { x: 14, y: 76, r: -40, c: 'text-sky-500/45' },
  { x: 26, y: 88, r:  25, c: 'text-berry/45' },
  { x: 38, y: 72, r: -25, c: 'text-amber-500/50' },
  { x: 52, y: 84, r:  35, c: 'text-sky-500/45' },
  { x: 66, y: 92, r: -50, c: 'text-berry/45' },
  { x: 76, y: 60, r:  20, c: 'text-amber-500/50' },
  { x: 86, y: 80, r: -35, c: 'text-sky-500/45' },
  { x: 96, y: 90, r:  15, c: 'text-berry/45' },
  { x: 12, y: 30, r:  80, c: 'text-amber-500/45' },
  { x: 28, y: 34, r: -65, c: 'text-sky-500/40' },
  { x: 42, y: 30, r:  10, c: 'text-berry/40' },
  { x: 70, y: 32, r: -75, c: 'text-amber-500/50' },
]

function SprinkleField() {
  return (
    <div className="absolute inset-0" aria-hidden>
      {SPRINKLES.map((s, i) => (
        <span
          key={i}
          className={cn(
            'absolute block w-3 h-[3px] rounded-full bg-current hero-bob',
            s.c,
          )}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `rotate(${s.r}deg)`,
            animationDelay: `${(i % 5) * 0.9}s`,
          }}
        />
      ))}
    </div>
  )
}
