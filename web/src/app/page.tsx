import Link from 'next/link'
import Image from 'next/image'
import { listProducts, type Product } from '@/lib/api'
import { BRAND, ASSETS } from '@/lib/brand'
import { BLOG_POSTS } from '@/lib/blog'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { HoursTable } from '@/components/brand/hours'
import { QuickOrderForm } from '@/components/order/quick-order-form'
import { HeroDecor } from '@/components/sections/hero-decor'
import { EditorialTriptych } from '@/components/sections/editorial-triptych'
import { PlaceToGather } from '@/components/sections/place-to-gather'
import { Testimonials } from '@/components/sections/testimonials'
import { NewsletterBand } from '@/components/sections/newsletter-band'
import { VisitBand } from '@/components/sections/visit-band'
import { ThreeWaysBand } from '@/components/sections/three-ways-band'
import { ShowcaseRow } from '@/components/sections/showcase-row'
import { DeliveryZones } from '@/components/sections/delivery-zones'
import { ArrowRight, Sparkles, MapPin, Star, Clock } from 'lucide-react'

export const revalidate = 60

export default async function HomePage() {
  // includeOutOfStock so the showcase can surface the "Out today" state via
  // the card itself instead of silently dropping anything Askhat marked
  // unavailable. The Hero's quick-order picker uses an in-stock-only slice.
  const products = await listProducts({ includeOutOfStock: true })
  const inStockProducts = products.filter((p) => p.in_stock)

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    '@id': `${BRAND.origin}/#bakery`,
    name: BRAND.legal,
    alternateName: 'HappyCake',
    description: BRAND.slogan,
    image: `${BRAND.origin}${ASSETS.hero[0]}`,
    logo: `${BRAND.origin}${ASSETS.logo.px512}`,
    url: BRAND.origin,
    telephone: BRAND.phone.e164,
    email: BRAND.email,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address.line1,
      addressLocality: BRAND.address.city,
      addressRegion: BRAND.address.region,
      postalCode: BRAND.address.postalCode,
      addressCountry: BRAND.address.country,
    },
    sameAs: [BRAND.instagram, BRAND.whatsapp],
    servesCuisine: ['Bakery', 'Cakes', 'Desserts', 'Coffee'],
    areaServed: { '@type': 'Place', name: BRAND.region },
    openingHoursSpecification: BRAND.openingHoursSpec.map((s) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: s.dayOfWeek,
      opens: s.opens,
      closes: s.closes,
    })),
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.eyebrow', '#hero-tagline'],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Hero products={inStockProducts} />
      <EditorialTriptych />

      <ShowcaseRow products={products} />

      <ThreeWaysBand />
      <PlaceToGather />
      <Testimonials />
      <Manifesto />
      <StoriesBand />
      <VisitBand />
      <DeliveryZones />
      <BusinessBand />
      <NewsletterBand />
      <ClosingCta />
    </>
  )
}

function Hero({ products }: { products: Product[] }) {
  return (
    <section className="relative overflow-hidden">
      {/* Layered editorial backdrop, back to front:
          1. home-hero-bg     — warm cream + butter/sky/blush radial glows
          2. home-hero-grain  — subtle paper grain (multiply blend) for tactility
          3. hero-photo       — real honey-cake photo on the left, masked
                                to dissolve into the cream toward the type
          4. soft-blur orbs   — atmospheric bloom in the corners
          5. HeroDecor        — bunting, frosting swoosh, cake silhouette
          The photo is the anchor — research shows real food photography
          is the dominant pattern across leading bakery heroes (Magnolia,
          Janjou, Levain). Decoration is now restrained accent, not
          competing focus. */}
      <div className="absolute inset-0 home-hero-bg pointer-events-none" aria-hidden />
      <div className="absolute inset-0 home-hero-grain pointer-events-none" aria-hidden />

      {/* Editorial cake photo — bleeds in from the left, masked with a
          radial fade so it dissolves into the cream around the headline.
          Color-graded warm via mix-blend-mode + filter so it reads as
          part of the page, not a stock-photo slap. Hidden on mobile. */}
      <div className="absolute -left-[18%] top-0 bottom-0 w-[68%] hidden md:block pointer-events-none" aria-hidden>
        <div className="relative h-full w-full hero-photo-mask hero-px-back">
          <Image
            src={ASSETS.hero[0]}
            alt=""
            fill
            priority
            sizes="68vw"
            className="object-cover hero-photo-tint"
          />
        </div>
      </div>

      <div className="absolute -top-40 -right-32 h-[26rem] w-[26rem] rounded-full bg-amber-300/25 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-44 -left-32 h-[30rem] w-[30rem] rounded-full bg-berry/15 blur-3xl pointer-events-none" aria-hidden />
      <HeroDecor />

      <div className="container relative pt-10 pb-16 md:pt-16 md:pb-24 grid gap-10 lg:grid-cols-12 lg:gap-14 items-center">
        <div className="lg:col-span-7">
          <Eyebrow>Family-owned cake shop & coffee bar</Eyebrow>
          <h1
            id="hero-tagline"
            className="display-h1 mt-5 [text-wrap:balance]"
          >
            Cakes worth <span className="text-sky">driving for</span>.
          </h1>
          <p className="mt-5 text-lg text-cocoa-900/75 max-w-xl leading-relaxed">
            Small-batch cakes and pastries, baked from scratch every morning. Real ingredients,
            generous slices, and the kind of welcome that turns first-time guests into Saturday
            regulars.
          </p>

          {/* Trust strip — replaces the noisy CTA stack with three quiet
              proof points the eye can scan in a glance. */}
          <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-cocoa-900/75">
            <li className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-700" /> Baked fresh daily
            </li>
            <li className="inline-flex items-center gap-2">
              <Star className="h-4 w-4 text-sky-700" /> 500+ regulars and counting
            </li>
            <li className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-700" /> Pickup or local delivery
            </li>
          </ul>

          {/* Hours + phone live in the header now (HeaderStatus + tel link).
              Hero meta row keeps just the address — the one piece the
              header doesn't surface. */}
          <div className="mt-7 flex flex-wrap items-center gap-4 text-sm">
            <a
              href={BRAND.mapsUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-cocoa-900/70 hover:text-cocoa-900"
            >
              <MapPin className="h-4 w-4" /> {BRAND.address.line1}
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 relative">
          <QuickOrderForm products={products} />
        </div>
      </div>
    </section>
  )
}

function StoriesBand() {
  const featured = BLOG_POSTS.slice(0, 3)
  return (
    <section className="container mt-24">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <Eyebrow>Stories & guides</Eyebrow>
          <h2 className="display-h2 mt-3">Notes from the bench</h2>
          <p className="mt-2 text-cocoa-900/70 max-w-xl">
            Honest, useful pieces — honey-cake history, planning a custom cake, allergens. Same
            voice as the counter conversation.
          </p>
        </div>
        <Button asChild variant="outline-sky" shape="pill">
          <Link href="/blog">
            All stories
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="grid gap-6 md:grid-cols-3">
        {featured.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="group bakery-card flex flex-col h-full overflow-hidden hover:-translate-y-0.5 transition-transform"
            >
              <div className="relative aspect-[4/3] bg-cream-100">
                <Image
                  src={p.hero_url}
                  alt={p.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <span className="text-xs uppercase tracking-[0.16em] text-cocoa-900/55">
                  {p.read_minutes} min read
                </span>
                <h3 className="display-h3 group-hover:text-sky-700 transition-colors [text-wrap:balance]">
                  {p.title}
                </h3>
                <p className="text-sm text-cocoa-900/70 leading-relaxed line-clamp-3">
                  {p.description}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Manifesto() {
  return (
    <section className="container mt-24">
      <div className="grid gap-10 md:grid-cols-12 items-start">
        <div className="md:col-span-5">
          <Eyebrow>About us</Eyebrow>
          <h2 className="display-h2 mt-3">A family-run cake shop, hands behind every slice.</h2>
        </div>
        <div className="md:col-span-7 text-cocoa-900/85 space-y-4 leading-relaxed">
          <p>
            HappyCake is owned and run by Askhat and his wife. Every cake is hand-decorated and
            hand-packed; recipes were tested at the dinner table and refined until they earned
            their names.
          </p>
          <p>
            We&apos;re not a chain. We&apos;re one family making cakes the way we would for our
            own table — and serving them to yours, on Promenade Way in Sugar Land.
          </p>
          <p>
            <Link href="/about" className="text-sky-700 underline-offset-4 hover:underline font-medium">
              Read our story →
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

function BusinessBand() {
  return (
    <section className="container mt-24">
      <div className="rounded-[28px] border border-sky/20 bg-sky/5 p-8 md:p-12 grid gap-6 md:grid-cols-[1fr_auto] md:items-center max-w-5xl mx-auto">
        <div>
          <Eyebrow className="text-sky-700">For business</Eyebrow>
          <h2 className="display-h2 mt-2 text-3xl md:text-4xl [text-wrap:balance]">
            Catering, gifting, standing programs.
          </h2>
          <p className="mt-3 text-cocoa-900/75 max-w-xl">
            Office breaks, events, corporate gifting. One point of contact, one invoice. We reply
            to every B2B inquiry within one business day.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" variant="sky">
            <Link href="/business">See programs</Link>
          </Button>
          <Button asChild size="lg" variant="outline-sky">
            <Link href="/business/inquire">Send inquiry</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="container mt-24 mb-4">
      <div className="rounded-[32px] bg-cocoa-900 text-cream p-10 md:p-16 relative overflow-hidden">
        <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
        <div className="relative max-w-2xl">
          <Eyebrow className="text-sky-200">Today's bake is out</Eyebrow>
          <p className="font-display text-3xl md:text-5xl mt-3 leading-[1.05] [text-wrap:balance]">
            Come in for a slice — or order a whole cake by Saturday.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="sky">
              <Link href="/order">Start an order</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-cream hover:bg-cream/10"
            >
              <Link href="/menu">See what's in the case</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
