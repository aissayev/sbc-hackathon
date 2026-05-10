import Link from 'next/link'
import { Star, ArrowRight, Quote } from 'lucide-react'
import { Eyebrow } from '@/components/brand/eyebrow'

// Testimonials grid. Six quotes covering distinct angles so the section
// reads as a real cross-section of regulars rather than a brand monologue:
//   - Birthday parent
//   - Saturday-morning regular
//   - Office gifting / B2B
//   - Wedding planner
//   - Allergen-aware customer
//   - Newcomer / first-time
//
// Hackathon copy. Real stars from happycake.us reviews can drop in via the
// `source` field once we wire the GBP review pull.

interface Testimonial {
  quote: string
  name: string
  context: string
  source?: string
  rating: number
}

// Trimmed from 6 to 3 most-distinctive quotes — covers birthday regular,
// office orders, and first-timer. The breadth still reads, the section
// stops feeling like a wall.
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Three years of birthday cakes. Each one perfect. Askhat remembers my daughter's name.",
    name: 'Maria L.',
    context: 'Sugar Land · birthday regular',
    rating: 5,
  },
  {
    quote:
      "The honey cake is the only reason I haven't bought an espresso machine for the office.",
    name: 'Daniel K.',
    context: 'Office orders · weekly',
    rating: 5,
  },
  {
    quote:
      "Best cardamom-pistachio thing I've had in Houston. The owner came out to ask how it was.",
    name: 'Omar S.',
    context: 'First visit',
    rating: 5,
  },
]

export function Testimonials() {
  return (
    <section className="container mt-28 md:mt-32" aria-labelledby="testimonials-heading">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <Eyebrow>What guests say</Eyebrow>
          <h2 id="testimonials-heading" className="display-h2 mt-3 [text-wrap:balance]">
            500+ regulars and counting.
          </h2>
        </div>
        <Link
          href="https://maps.app.goo.gl/5y1XZuBPYtY9oCJ58"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          All Google reviews
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <ul className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <li key={t.name} className="bakery-card p-7 md:p-8 flex flex-col">
            <Quote className="h-6 w-6 text-sky-700/60 shrink-0" aria-hidden />
            <blockquote className="mt-4 text-cocoa-900 leading-snug text-lg md:text-xl font-display">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <div className="mt-6 pt-4 border-t border-cocoa-700/10 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-cocoa-900 text-sm">{t.name}</div>
                <div className="text-xs text-cocoa-900/55 mt-0.5">{t.context}</div>
              </div>
              <div className="flex items-center gap-0.5" aria-label={`${t.rating} stars`}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
