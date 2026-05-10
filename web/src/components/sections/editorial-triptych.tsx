import Link from 'next/link'
import Image from 'next/image'
import { ASSETS } from '@/lib/brand'

// Editorial triptych — three large photo cards with a single line of
// title, a one-line tagline, and a single CTA link. Inspired by Tatte's
// "Our Story / Gift Cards / Careers" composition: photos do the work,
// type stays out of the way, generous breathing room between cards.
//
// Sits right after the hero on the home page. Replaces the previous
// 4-pillar text wall — gives the eye a place to rest after the dense
// hero and offers three clear next steps.

const CARDS = [
  {
    href: '/about',
    image: ASSETS.team.ownerPortrait,
    title: 'Our story',
    tagline: 'A family bakery, baking for our Sugar Land neighbours.',
    cta: 'Learn more',
    objectPosition: 'object-top',
  },
  {
    href: '/gift-cards',
    image: ASSETS.products[0],
    title: 'Gift cards',
    tagline: 'Give a slice of Saturday — available in shop or by phone.',
    cta: 'Order one',
    objectPosition: 'object-center',
  },
  {
    href: '/careers',
    image: ASSETS.store.diningRoom,
    title: 'Careers',
    tagline: 'We hire kind, careful people who love feeding their neighbours.',
    cta: 'Join the team',
    objectPosition: 'object-center',
  },
] as const

export function EditorialTriptych() {
  return (
    <section className="container mt-16 md:mt-24 lg:mt-28">
      <div className="grid gap-8 md:gap-10 md:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-4 focus-visible:ring-offset-cream rounded-2xl"
          >
            {/* Photo card — square aspect, soft corners, hover lift. */}
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream-100">
              <Image
                src={card.image}
                alt=""
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className={`object-cover ${card.objectPosition} transition-transform duration-500 ease-out group-hover:scale-[1.03]`}
              />
            </div>

            {/* Caption — Playfair display title + one-line tagline + CTA.
                Mirrors the Tatte cadence: title big, tagline restrained,
                CTA as a single small uppercase link. */}
            <div className="mt-5 md:mt-6">
              <h3 className="display-h3 text-2xl md:text-3xl text-cocoa-900">
                {card.title}
              </h3>
              <p className="mt-2 text-cocoa-900/70 text-base leading-relaxed max-w-prose">
                {card.tagline}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase font-medium text-sky-700 group-hover:text-sky-900 transition-colors">
                {card.cta}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
