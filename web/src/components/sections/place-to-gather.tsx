import Image from 'next/image'
import Link from 'next/link'
import { Wifi, Users, Coffee, Baby, ArrowRight } from 'lucide-react'
import { ASSETS } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'

// Welcoming "we're a place, not just a counter" section. Sits between the
// product showcase and the manifesto so visitors who came for "what cakes
// are there" get a softer landing into "and you can stay for a few hours".
//
// Pattern: photo collage on the left (uses two real interior shots),
// pillar list on the right (4 quick why-you-stay points). No CTA — the
// implicit one is "come see us" which the section below handles.

const REASONS = [
  {
    icon: Users,
    title: 'Bring the table with you',
    body: 'Long communal tables for catch-ups, study sessions, and birthdays that grow a little.',
  },
  {
    icon: Coffee,
    title: 'Stay for the second cup',
    body: 'Specialty coffee, refills cheap, no wifi rationing. Open late enough that you can actually finish what you came in for.',
  },
  {
    icon: Baby,
    title: 'Family-friendly',
    body: 'High chairs at the counter, water bowls outside for the dog, a basket of crayons by the door.',
  },
  {
    icon: Wifi,
    title: 'A working spot, not a quiet one',
    body: 'Not a library — there\'s music and laughter in the room — but the wifi is fast and the seats are kind to a laptop.',
  },
]

export function PlaceToGather() {
  return (
    <section className="container mt-24" aria-labelledby="gather-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 items-center">
        {/* Photo collage — wider tile + tall tile so the eye reads "real
            place, two angles". */}
        <div className="lg:col-span-5 grid gap-3 grid-cols-2 grid-rows-[200px_140px]">
          <div className="relative col-span-2 row-span-1 overflow-hidden rounded-2xl bg-cream-100">
            <Image
              src={ASSETS.store.diningRoom}
              alt="The Happy Cake dining room — table, blue chairs, daylight from the windows"
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-cream-100">
            <Image
              src={ASSETS.store.wallArt}
              alt="Cake-poster art on the dining-room wall"
              fill
              sizes="(min-width: 1024px) 240px, 50vw"
              className="object-cover"
            />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-cream-100">
            <Image
              src={ASSETS.store.coffeeAndCake}
              alt="Black-Forest cake slice and a Happy Cake-branded iced coffee"
              fill
              sizes="(min-width: 1024px) 240px, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="lg:col-span-7">
          <Eyebrow>More than a bakery</Eyebrow>
          <h2 id="gather-heading" className="display-h2 mt-3">
            A place to meet, work, and slow down.
          </h2>
          <p className="mt-4 text-cocoa-900/75 leading-relaxed max-w-xl">
            We baked the recipe; we built the room around it. Bring your laptop. Bring the kids.
            Bring your nan. Stay an extra cup.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {REASONS.map((r) => (
              <li key={r.title} className="flex items-start gap-3">
                <span className="h-9 w-9 shrink-0 rounded-full bg-sky/15 text-sky-700 inline-flex items-center justify-center">
                  <r.icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-display text-lg text-cocoa-900 leading-tight">{r.title}</div>
                  <p className="mt-1 text-sm text-cocoa-900/70 leading-relaxed">{r.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/#visit"
            className="mt-7 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900"
          >
            See hours and how to find us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
