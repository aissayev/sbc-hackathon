import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Eyebrow } from '@/components/brand/eyebrow'
import { BRAND, ASSETS } from '@/lib/brand'
import { Phone, MapPin, Gift, ArrowRight, Tag, Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: `Gift cards — give a slice of Saturday | ${BRAND.name}`,
  description:
    'HappyCake gift cards — perfect for birthdays, thank-yous, and just-because gifts. Available in shop or by phone, in any amount.',
  alternates: { canonical: '/gift-cards' },
}

export default function GiftCardsPage() {
  return (
    <main>
      {/* Hero band — left: short copy + CTAs, right: large product photo.
          Mirrors the Tatte "Celebrate with something delicious" layout
          (text-light, photo-heavy, single primary CTA). */}
      <section className="container pt-12 md:pt-16 pb-12 md:pb-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <Eyebrow>Gift cards</Eyebrow>
            <h1 className="display-h1 mt-5 [text-wrap:balance]">
              Celebrate with <span className="text-sky">something delicious</span>.
            </h1>
            <p className="mt-5 text-lg text-cocoa-900/75 leading-relaxed max-w-prose">
              For birthdays, graduations, thank-yous, or just because — mark the moment with
              something they&apos;ll truly savor. Gift cards are available in any amount.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={BRAND.phone.hrefTel}
                className="inline-flex items-center gap-2 rounded-full bg-sky text-white text-sm font-medium px-5 h-11 hover:bg-sky-700 transition-colors shadow-sm"
              >
                <Phone className="h-4 w-4" /> Call to order
              </a>
              <a
                href={BRAND.mapsUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full border border-cocoa-700/25 text-cocoa-900 text-sm font-medium px-5 h-11 hover:bg-cream-200 transition-colors"
              >
                <MapPin className="h-4 w-4" /> Visit the shop
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-cream-100">
              <Image
                src={ASSETS.products[0]}
                alt="HappyCake honey cake — perfect gift card pairing"
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works — three steps with icons + connector line.
          White card on cream page so the section reads as a distinct
          surface (was cream-on-cream and disappeared into the page).
          Icons + larger step numbers give each step its own visual
          anchor instead of all three looking identical.  */}
      <section className="container pb-16 md:pb-24">
        <div className="rounded-3xl bg-white shadow-lift border border-cocoa-700/8 px-6 md:px-12 py-10 md:py-14">
          {/* Header row: eyebrow on the left, "never expires" chip on the
              right. Promotes the strongest selling point from a footer
              note to a callout the eye sees before the steps.  */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow>How it works</Eyebrow>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky/10 text-sky-700 text-[11px] font-medium px-3 h-7 border border-sky/20">
              <Sparkles className="h-3 w-3" />
              Cards never expire
            </span>
          </div>

          <h2 className="display-h2 mt-4 [text-wrap:balance] max-w-2xl">
            Three steps, ready in minutes.
          </h2>
          <p className="mt-3 text-cocoa-900/70 max-w-xl leading-relaxed">
            No accounts, no shipping fees. Use it on anything in the
            case — slices, whole cakes, pastries, coffee.
          </p>

          {/* Steps grid. Connector line is a pseudo-row behind the icons,
              visible only on md+ where the steps sit side-by-side.  */}
          <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {/* Dotted connector — sits behind the icon circles at the
                top of each step on desktop. Clipped left/right so it
                doesn't run past the first/last icon. */}
            <div
              aria-hidden
              className="hidden md:block absolute left-[16.66%] right-[16.66%] top-7 border-t border-dashed border-cocoa-700/20"
            />

            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky/10 text-sky-700 ring-4 ring-white shrink-0">
                    <s.icon className="h-6 w-6" />
                  </span>
                  <span className="text-3xl font-display font-semibold text-cocoa-900/30 tabular-nums leading-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="display-h3 text-xl">{s.title}</h3>
                <p className="text-cocoa-900/70 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>

          {/* Card-internal CTA so the natural reading flow ends at action.
              Mirrors the hero pair so users don't have to scroll back up. */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 pt-8 border-t border-cocoa-700/8">
            <p className="text-sm text-cocoa-900/70">
              Ready to gift one? Phone us or stop by — we&apos;ll have it ready.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={BRAND.phone.hrefTel}
                className="inline-flex items-center gap-2 rounded-full bg-sky text-white text-sm font-medium px-5 h-10 hover:bg-sky-700 transition-colors shadow-sm"
              >
                <Phone className="h-4 w-4" /> Call to order
              </a>
              <a
                href={BRAND.mapsUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full border border-cocoa-700/20 text-cocoa-900 text-sm font-medium px-5 h-10 hover:bg-cream-100 transition-colors"
              >
                <MapPin className="h-4 w-4" /> Visit the shop
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA — keep ordering frictionless, point to /menu. */}
      <section className="container pb-20 md:pb-28">
        <div className="rounded-2xl border border-cocoa-700/10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="display-h3 text-xl">Browsing for the recipient first?</h3>
            <p className="mt-1 text-cocoa-900/70">
              Take a look at the menu — the gift card pairs with anything in the case.
            </p>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 rounded-full bg-sky text-white text-sm font-medium px-5 h-11 hover:bg-sky-700 transition-colors shadow-sm shrink-0"
          >
            See the menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}

const STEPS = [
  {
    icon: Tag,
    title: 'Pick an amount',
    body: 'Any value works. Most folks pick $25, $50, or enough for a whole cake (about $65).',
  },
  {
    icon: Phone,
    title: 'Call or stop in',
    body: `Phone us at ${BRAND.phone.display} or visit the shop on Promenade Way. We can have it ready while you wait.`,
  },
  {
    icon: Gift,
    title: 'Hand it over (or mail it)',
    body: 'Cards come in a small envelope, ready to gift. We can also drop one in the mail if you prefer.',
  },
] as const
