import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Eyebrow } from '@/components/brand/eyebrow'
import { BRAND, ASSETS } from '@/lib/brand'
import { Phone, MapPin, Gift, ArrowRight } from 'lucide-react'

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

      {/* How it works — three quiet steps. No card stack, just a clean row. */}
      <section className="container pb-16 md:pb-24">
        <div className="rounded-3xl bg-cream-100 border border-cocoa-700/10 px-6 md:px-12 py-10 md:py-14">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="display-h2 mt-3 [text-wrap:balance] max-w-2xl">
            Three steps. No accounts, no shipping fees.
          </h2>

          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3">
                <span className="text-[11px] tracking-[0.18em] uppercase text-cocoa-900/55 font-medium tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="display-h3 text-xl">{s.title}</h3>
                <p className="text-cocoa-900/70 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex items-center gap-3 text-sm text-cocoa-900/70">
            <Gift className="h-4 w-4 text-sky-700" />
            Cards never expire and can be used on anything in the case — slices, whole cakes,
            pastries, coffee.
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
    title: 'Pick an amount',
    body: 'Any value works. Most folks pick $25, $50, or enough for a whole cake (about $65).',
  },
  {
    title: 'Call or stop in',
    body: `Phone us at ${BRAND.phone.display} or visit the shop on Promenade Way. We can have it ready while you wait.`,
  },
  {
    title: 'Hand it over (or mail it)',
    body: 'Cards come in a small envelope, ready to gift. We can also drop one in the mail if you prefer.',
  },
] as const
