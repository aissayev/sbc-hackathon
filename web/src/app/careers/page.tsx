import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Eyebrow } from '@/components/brand/eyebrow'
import { BRAND, ASSETS } from '@/lib/brand'
import { Mail, Phone, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: `Careers — join the HappyCake team | ${BRAND.name}`,
  description:
    'Join the HappyCake team in Sugar Land. We hire kind, careful people who love feeding their neighbours. Open roles posted as we grow.',
  alternates: { canonical: '/careers' },
}

export default function CareersPage() {
  return (
    <main>
      {/* Hero band — text left, dining-room photo right. Same Tatte-style
          cadence as /gift-cards: short copy, single primary CTA. */}
      <section className="container pt-12 md:pt-16 pb-12 md:pb-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <Eyebrow>Careers</Eyebrow>
            <h1 className="display-h1 mt-5 [text-wrap:balance]">
              Bake with us in <span className="text-sky">Sugar Land</span>.
            </h1>
            <p className="mt-5 text-lg text-cocoa-900/75 leading-relaxed max-w-prose">
              We&apos;re a small, family-run bakery — every hire matters. We hire kind, careful
              people who love feeding their neighbours and don&apos;t cut corners they&apos;d
              notice on the dinner table.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`mailto:${BRAND.email}?subject=Joining the HappyCake team`}
                className="inline-flex items-center gap-2 rounded-full bg-sky text-white text-sm font-medium px-5 h-11 hover:bg-sky-700 transition-colors shadow-sm"
              >
                <Mail className="h-4 w-4" /> Send a note
              </a>
              <a
                href={BRAND.phone.hrefTel}
                className="inline-flex items-center gap-2 rounded-full border border-cocoa-700/25 text-cocoa-900 text-sm font-medium px-5 h-11 hover:bg-cream-200 transition-colors"
              >
                <Phone className="h-4 w-4" /> {BRAND.phone.display}
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-cream-100">
              <Image
                src={ASSETS.store.diningRoom}
                alt="Inside HappyCake — the Sugar Land dining room"
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What we look for — three quiet attributes in a clean row. */}
      <section className="container pb-16 md:pb-24">
        <div className="rounded-3xl bg-cream-100 border border-cocoa-700/10 px-6 md:px-12 py-10 md:py-14">
          <Eyebrow>What we look for</Eyebrow>
          <h2 className="display-h2 mt-3 [text-wrap:balance] max-w-2xl">
            Three things matter more than experience.
          </h2>

          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {VALUES.map((v, i) => (
              <li key={v.title} className="flex flex-col gap-3">
                <span className="text-[11px] tracking-[0.18em] uppercase text-cocoa-900/55 font-medium tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="display-h3 text-xl">{v.title}</h3>
                <p className="text-cocoa-900/70 leading-relaxed">{v.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Open roles — kept honest. We don't pretend to have a posting board. */}
      <section className="container pb-20 md:pb-28">
        <div className="grid gap-8 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.title} className="bakery-card p-6 md:p-7 flex flex-col">
              <h3 className="display-h3 text-xl">{r.title}</h3>
              <p className="mt-2 text-sm text-cocoa-900/65">{r.schedule}</p>
              <p className="mt-4 text-cocoa-900/75 leading-relaxed flex-1">{r.body}</p>
              <a
                href={`mailto:${BRAND.email}?subject=${encodeURIComponent(`Interested in: ${r.title}`)}`}
                className="mt-6 inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase font-medium text-sky-700 hover:text-sky-900 transition-colors"
              >
                Apply by email
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-cocoa-700/10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="display-h3 text-xl">Don&apos;t see your role?</h3>
            <p className="mt-1 text-cocoa-900/70">
              We hire when the shop&apos;s busy enough to need help. Send a short note and we&apos;ll
              reach out when there&apos;s a fit.
            </p>
          </div>
          <a
            href={`mailto:${BRAND.email}?subject=Joining the HappyCake team`}
            className="inline-flex items-center gap-2 rounded-full bg-sky text-white text-sm font-medium px-5 h-11 hover:bg-sky-700 transition-colors shadow-sm shrink-0"
          >
            <Mail className="h-4 w-4" /> Send a note
          </a>
        </div>
      </section>
    </main>
  )
}

const VALUES = [
  {
    title: 'Care',
    body: 'You notice the small things — a chipped corner on a slice, a crooked label, a customer waiting longer than they should.',
  },
  {
    title: 'Calm',
    body: 'Saturday rush, custom-cake deadlines, last-minute orders — the work is steady. We move quickly without hurrying.',
  },
  {
    title: 'Curiosity',
    body: 'You\'ll learn recipes, decoration techniques, and how the shop runs. The people who grow here are the ones who ask why.',
  },
] as const

const ROLES = [
  {
    title: 'Counter & coffee',
    schedule: 'Part-time · weekends',
    body: 'Greet guests, build orders, pull espresso, package boxes. You\'re the first face people see — set the tone.',
  },
  {
    title: 'Baker / decorator',
    schedule: 'Full-time · early mornings',
    body: 'Bake the day\'s case from scratch. Honey-cake layers, sponges, frostings, decorations. Recipes are taught — neat hands matter.',
  },
  {
    title: 'Delivery driver',
    schedule: 'Part-time · flexible',
    body: 'Drive custom-cake deliveries across the Greater Houston area. Clean record, careful with cargo, friendly at the door.',
  },
] as const
