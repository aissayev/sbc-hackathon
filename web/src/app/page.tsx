import Link from 'next/link'
import Image from 'next/image'
import { listProducts, type Product } from '@/lib/api'
import { BRAND, ASSETS, PILLARS } from '@/lib/brand'
import { BLOG_POSTS } from '@/lib/blog'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HoursTable, isOpenNow } from '@/components/brand/hours'
import { QuickOrderForm } from '@/components/order/quick-order-form'
import {
  ArrowRight,
  Sparkles,
  Coffee,
  Gift,
  Heart,
  MapPin,
  Phone,
  Instagram,
  Leaf,
  ExternalLink,
  Star,
  Clock,
} from 'lucide-react'

export const revalidate = 60

const PILLAR_ICONS = { sparkles: Sparkles, coffee: Coffee, gift: Gift, heart: Heart } as const

export default async function HomePage() {
  const products = await listProducts()
  // Pull one of each major kind so the home grid reads as the case browser
  // would: by-the-slice, whole, pastry, custom. This also addresses
  // "show by slice, whole cake separation" without rebuilding /menu.
  const pickByKind = (kind: string) => products.find((p) => p.kind === kind)
  const featured = [
    pickByKind('slice'),
    pickByKind('whole'),
    pickByKind('pastry'),
    pickByKind('custom'),
  ].filter((p): p is NonNullable<typeof p> => Boolean(p))
  const status = isOpenNow()

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
      <Hero status={status} products={products} />
      <Pillars />

      <section className="container mt-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-3">
          <div>
            <Eyebrow>Today&apos;s bake</Eyebrow>
            <h2 className="display-h2 mt-3">No two cakes the same</h2>
            <p className="mt-2 text-cocoa-900/70 max-w-xl">
              Every cake in the case comes from a different tradition — Kazakh honey, modern
              meringue, Italian classic, French chocolate. Worth trying all of them.
            </p>
          </div>
          <Button asChild variant="outline-sky" shape="pill" size="default">
            <Link href="/menu">
              See the full menu
              <ArrowRight />
            </Link>
          </Button>
        </div>
        {/* Showcase row: each cake is genuinely unique on the market — the
            collectible-style card surfaces its tradition (Kazakh-European
            honey, modern meringue, Italian classic, celebration), its flavor
            stack, and a one-line tagline. Equal-height tiles fit one viewport
            on desktop. */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} variant="showcase" />
          ))}
        </div>
      </section>

      <DietaryAndCustomBand />
      <Manifesto />
      <StoriesBand />
      <VisitSection />
      <BusinessBand />
      <ClosingCta />
    </>
  )
}

function Hero({
  status,
  products,
}: {
  status: { open: boolean; nextChange?: string }
  products: Product[]
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Layered backdrop: warm cream wash + sky / berry corner glows + a faint
          grid lattice masked to the centre. Pattern mirrors the websites
          monorepo hero recipe (25_karada-u, 24_skymax). */}
      <div className="absolute inset-0 home-hero-bg pointer-events-none" aria-hidden />
      <div className="absolute inset-0 home-hero-grid pointer-events-none opacity-70" aria-hidden />
      <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-sky/15 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-berry/10 blur-3xl pointer-events-none" aria-hidden />

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

          <div className="mt-7 flex flex-wrap items-center gap-4 text-sm">
            <Badge variant={status.open ? 'sage' : 'sky'} className="px-3 py-1">
              <span className={`h-1.5 w-1.5 rounded-full mr-2 ${status.open ? 'bg-emerald-600' : 'bg-sky-700'}`} />
              {status.open ? 'Open now' : 'Closed'} · {status.nextChange}
            </Badge>
            <a
              href={BRAND.mapsUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-cocoa-900/70 hover:text-cocoa-900"
            >
              <MapPin className="h-4 w-4" /> {BRAND.address.line1}
            </a>
            <a
              href={BRAND.phone.hrefTel}
              className="inline-flex items-center gap-1.5 text-cocoa-900/70 hover:text-cocoa-900"
            >
              <Phone className="h-4 w-4" /> {BRAND.phone.display}
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

function Pillars() {
  return (
    <section className="container mt-12 md:mt-20">
      <div className="text-center max-w-2xl mx-auto">
        <Eyebrow>Why guests come back</Eyebrow>
        <h2 className="display-h2 mt-3">Made with heart, served with soul</h2>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p) => {
          const Icon = PILLAR_ICONS[p.icon as keyof typeof PILLAR_ICONS] ?? Sparkles
          return (
            <div key={p.title} className="bakery-card p-6 text-center">
              <div className="h-12 w-12 mx-auto rounded-full bg-sky-100 text-sky flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="display-h3 mt-4 text-lg">{p.title}</h3>
              <p className="mt-2 text-sm text-cocoa-900/70 leading-relaxed">{p.body}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DietaryAndCustomBand() {
  return (
    <section className="container mt-20" aria-labelledby="dietary-and-custom">
      <h2 id="dietary-and-custom" className="sr-only">
        Dietary guide and custom cakes
      </h2>
      <div className="grid gap-5 md:grid-cols-2">
        <Link
          href="/dietary"
          className="group relative overflow-hidden rounded-2xl bg-sage/15 border border-sage/30 p-6 md:p-8 hover:-translate-y-0.5 transition-transform"
        >
          <div className="flex items-start gap-4">
            <span className="h-11 w-11 rounded-full bg-sage/30 inline-flex items-center justify-center shrink-0">
              <Leaf className="h-5 w-5 text-emerald-700" />
            </span>
            <div className="min-w-0">
              <Eyebrow>Dietary guide</Eyebrow>
              <h3 className="display-h3 mt-2 group-hover:text-emerald-700 transition-colors">
                Gluten, nuts, dairy, vegan, halal — what we can and can&apos;t do
              </h3>
              <p className="mt-2 text-sm text-cocoa-900/75 leading-relaxed">
                Plain-English answers from a small kitchen with shared benches. Read this before
                ordering for someone with an allergy.
              </p>
              <span className="mt-3 inline-flex items-center text-sm text-emerald-700">
                Read the guide <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
        <Link
          href="/order/custom"
          className="group relative overflow-hidden rounded-2xl bg-sky/10 border border-sky/30 p-6 md:p-8 hover:-translate-y-0.5 transition-transform"
        >
          <div className="flex items-start gap-4">
            <span className="h-11 w-11 rounded-full bg-sky/25 inline-flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-sky-700" />
            </span>
            <div className="min-w-0">
              <Eyebrow>Custom cake</Eyebrow>
              <h3 className="display-h3 mt-2 group-hover:text-sky-700 transition-colors">
                Birthdays, anniversaries — designed with you in five steps
              </h3>
              <p className="mt-2 text-sm text-cocoa-900/75 leading-relaxed">
                Flavors, fillings, message, photo or fondant. 24 hours notice (36 for vegan or
                gluten-free). Askhat quotes by phone.
              </p>
              <span className="mt-3 inline-flex items-center text-sm text-sky-700">
                Start the design <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
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

function VisitSection() {
  return (
    <section className="container mt-24" id="visit">
      <div className="text-center max-w-2xl mx-auto">
        <Eyebrow>When + where</Eyebrow>
        <h2 className="display-h2 mt-3">Come see us</h2>
      </div>
      {/* Real interior shot anchors the section so "come see us" reads as an
          invitation to a real room, not a postcode. */}
      <div className="mt-8 relative overflow-hidden rounded-[28px] aspect-[21/9] bg-cream-100">
        <Image
          src={ASSETS.store.signOverTable}
          alt="Inside Happy Cake on Promenade Way — the long blue-chair table under our neon sign"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="bakery-card p-7">
          <Eyebrow decorator={false}>Hours</Eyebrow>
          <h3 className="display-h3 mt-2 text-xl">When to visit</h3>
          <HoursTable className="mt-4" />
        </div>
        <div className="bakery-card p-7">
          <Eyebrow decorator={false}>Location</Eyebrow>
          <h3 className="display-h3 mt-2 text-xl">Where to find us</h3>
          <p className="mt-4 text-cocoa-900/85 leading-relaxed">
            {BRAND.address.line1}
            <br />
            {BRAND.address.city}, {BRAND.address.region} {BRAND.address.postalCode}
          </p>
          <p className="mt-3 text-sm text-cocoa-900/65 leading-relaxed">{BRAND.address.parkingNote}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="sky" size="sm">
              <a href={BRAND.mapsUrl} target="_blank" rel="noopener">
                <MapPin /> Get directions
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={BRAND.phone.hrefTel}>
                <Phone /> {BRAND.phone.display}
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={BRAND.instagram} target="_blank" rel="noopener">
                <Instagram /> {BRAND.instagramHandle}
              </a>
            </Button>
          </div>
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
