import Link from 'next/link'
import Image from 'next/image'
import { listProducts, type Product } from '@/lib/api'
import { BRAND, ASSETS } from '@/lib/brand'
import { BLOG_POSTS } from '@/lib/blog'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { QuickOrderForm } from '@/components/order/quick-order-form'
import { EditorialTriptych } from '@/components/sections/editorial-triptych'
import { PlaceToGather } from '@/components/sections/place-to-gather'
import { Testimonials } from '@/components/sections/testimonials'
import { NewsletterBand } from '@/components/sections/newsletter-band'
import { VisitBand } from '@/components/sections/visit-band'
import { ThreeWaysBand } from '@/components/sections/three-ways-band'
import { ShowcaseRow } from '@/components/sections/showcase-row'
import { ArrowRight, MapPin } from 'lucide-react'

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
      <StoriesBand />
      <VisitBand />
      <NewsletterBand />
      <ClosingCta />
    </>
  )
}

function Hero({ products }: { products: Product[] }) {
  // Bold + simple. No photo, no atmospheric overlay, no decorative
  // gradient. Just cream + typography + the order card. The brand book
  // says "Generous whitespace. Cakes have weight; the layout breathes
  // around them." — leaning all the way into that.
  //
  // The single decorative element is a thin sky-blue awning-stripe band
  // at the very top — the brand book's "polka-dot awning" pattern in
  // its barest form. Reads as a bakery shopfront awning without the
  // page committing to a bakery photo it can't fully own yet.
  //
  // Headline scales up on desktop (text-[clamp(...)]), no
  // text-wrap:balance — the line break is exactly where the eye
  // already wants to land.
  return (
    <section className="relative overflow-hidden bg-cream">
      {/* Awning stripe — a thin sky band with cream polka dots, mirroring
          the brand book's awning motif. 6px tall on desktop; a single
          pixel of brand colour at the very top tells you what kind of
          shop this is before you read a word. */}
      <div
        aria-hidden
        className="h-1.5 bg-sky pattern-dots-cream"
        style={{ backgroundSize: '14px 14px' }}
      />

      <div className="container relative pt-12 pb-14 md:pt-20 md:pb-24 grid gap-12 lg:grid-cols-12 lg:gap-16 items-center">
        <div className="lg:col-span-7">
          <Eyebrow>Family-owned cake shop &amp; coffee bar</Eyebrow>
          <h1
            id="hero-tagline"
            className="mt-5 font-display font-semibold tracking-tight text-cocoa-900 leading-[0.96]"
            style={{ fontSize: 'clamp(2.75rem, 7.5vw, 5.5rem)' }}
          >
            Cakes worth
            <br />
            <span className="text-sky">driving for</span>.
          </h1>
          <p className="mt-7 text-lg md:text-xl text-cocoa-900/80 max-w-xl leading-relaxed">
            Small-batch cakes and pastries, baked from scratch every morning.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
            <a
              href={BRAND.mapsUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-cocoa-900/75 hover:text-cocoa-900"
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
    <section className="container mt-28 md:mt-32">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <Eyebrow>Stories &amp; guides</Eyebrow>
          <h2 className="display-h2 mt-3 [text-wrap:balance]">
            Notes from the bench.
          </h2>
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

function ClosingCta() {
  // Single sky CTA; the secondary "see the menu" link is redundant with
  // the global header nav. Bigger headline, more breathing room.
  return (
    <section className="container mt-24 mb-4">
      <div className="rounded-[32px] bg-cocoa-900 text-cream p-12 md:p-20 relative overflow-hidden">
        <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="font-display text-4xl md:text-6xl leading-[1.02] [text-wrap:balance]">
            Come in for a slice. <span className="text-sky-200">Or order a whole cake.</span>
          </p>
          <div className="mt-8">
            <Button asChild size="lg" variant="sky">
              <Link href="/order">Start an order</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
