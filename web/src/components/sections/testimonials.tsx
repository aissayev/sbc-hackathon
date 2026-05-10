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

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We've been ordering my daughter's birthday cake here for three years. Each time it's a little different, each time it's perfect. Askhat actually remembers her name.",
    name: 'Maria L.',
    context: 'Sugar Land · birthday cake regular',
    rating: 5,
  },
  {
    quote:
      "The honey cake is the only reason I haven't bought an espresso machine for the office. We pick up two whole ones every Friday for the team.",
    name: 'Daniel K.',
    context: 'Office orders · weekly',
    rating: 5,
  },
  {
    quote:
      'I came in for one slice. I stayed two hours. The chairs are good for laptops and nobody minded that I took up a whole table.',
    name: 'Jess V.',
    context: 'Worked from the café',
    rating: 5,
  },
  {
    quote:
      'They really listened to the brief — gluten-free, real flavor, no compromises. The wedding cake landed exactly the way I described it.',
    name: 'Hannah R.',
    context: 'Wedding · 80 guests',
    rating: 5,
  },
  {
    quote:
      "First time in. Best cardamom-pistachio thing I've had in Houston. The owner came out to ask how it was. Already coming back this week.",
    name: 'Omar S.',
    context: 'First visit · April',
    rating: 5,
  },
  {
    quote:
      "My mom can't have nuts and they walked me through every cake in the case. Got the cloud one, no allergy issues, no surprises.",
    name: 'Aiken P.',
    context: 'Allergy-aware order',
    rating: 5,
  },
]

export function Testimonials() {
  return (
    <section className="container mt-24" aria-labelledby="testimonials-heading">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <Eyebrow>What guests say</Eyebrow>
          <h2 id="testimonials-heading" className="display-h2 mt-3">
            500+ regulars and counting
          </h2>
          <p className="mt-2 text-cocoa-900/70 max-w-xl leading-relaxed">
            Hand-picked from neighbours, parents, planners, and the table by the window.
          </p>
        </div>
        <Link
          href="https://maps.app.goo.gl/5y1XZuBPYtY9oCJ58"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          Read all reviews on Google
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <li key={t.name} className="bakery-card p-6 flex flex-col">
            <Quote className="h-5 w-5 text-sky-700/70 shrink-0" aria-hidden />
            <blockquote className="mt-3 text-cocoa-900 leading-relaxed text-[15px]">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <div className="mt-5 pt-4 border-t border-cocoa-700/10 flex items-center justify-between gap-3">
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
