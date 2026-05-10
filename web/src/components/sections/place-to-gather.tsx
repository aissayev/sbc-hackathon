import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ASSETS } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'

// Slimmed pass: photos do the work, the reason list collapses from four
// paragraph cards to three single-word chips. The implicit "come see us"
// CTA links into the visit band below.

const CHIPS = [
  'Long communal tables',
  'Specialty coffee, cheap refills',
  'Fast wifi, friendly to laptops',
] as const

export function PlaceToGather() {
  return (
    <section className="container mt-28 md:mt-32" aria-labelledby="gather-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 items-center">
        {/* Photo collage — wider tile + two square tiles. */}
        <div className="lg:col-span-5 grid gap-3 grid-cols-2 grid-rows-[200px_140px]">
          <div className="relative col-span-2 row-span-1 overflow-hidden rounded-2xl bg-cream-100">
            <Image
              src={ASSETS.store.diningRoom}
              alt="Inside HappyCake — dining room with daylight"
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-cream-100">
            <Image
              src={ASSETS.store.wallArt}
              alt="Cake-poster art on the wall"
              fill
              sizes="(min-width: 1024px) 240px, 50vw"
              className="object-cover"
            />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-cream-100">
            <Image
              src={ASSETS.store.coffeeAndCake}
              alt="Cake slice and HappyCake iced coffee"
              fill
              sizes="(min-width: 1024px) 240px, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="lg:col-span-7">
          <Eyebrow>More than a bakery</Eyebrow>
          <h2 id="gather-heading" className="display-h2 mt-3 [text-wrap:balance]">
            A place to <span className="text-sky">slow down</span>.
          </h2>
          <ul className="mt-7 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <li
                key={c}
                className="inline-flex items-center rounded-full bg-cream-100 border border-cocoa-700/10 px-4 py-2 text-sm font-medium text-cocoa-900"
              >
                {c}
              </li>
            ))}
          </ul>
          <Link
            href="#visit"
            className="mt-7 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900"
          >
            Hours and directions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
