import Link from 'next/link'
import Image from 'next/image'
import { listProducts } from '@/lib/api'
import { BRAND, ASSETS, PILLARS } from '@/lib/brand'
import { BLOG_POSTS } from '@/lib/blog'
import { APPEARANCES } from '@/lib/press'
import { KIND_LABELS } from '@/lib/catalog'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HoursTable, isOpenNow } from '@/components/brand/hours'
import { HeroImage } from '@/components/brand/hero-image'
import {
  ArrowRight,
  MessageSquareHeart,
  Sparkles,
  Coffee,
  Gift,
  Heart,
  MapPin,
  Phone,
  Instagram,
  Newspaper,
  Youtube,
  Leaf,
  ExternalLink,
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
      <Hero status={status} />
      <Pillars />

      <section className="container mt-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-3">
          <div>
            <Eyebrow>Today&apos;s bake</Eyebrow>
            <h2 className="display-h2 mt-3">One of each — start here</h2>
            <p className="mt-2 text-cocoa-900/70 max-w-xl">
              By-the-slice, whole cakes, pastries, and custom. Tap any to see the rest of that
              section.
            </p>
          </div>
          <Button asChild variant="outline-sky" shape="pill" size="default">
            <Link href="/menu">
              See the full menu
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 mb-8">
          {(['slice', 'whole', 'pastry', 'custom', 'catering'] as const).map((k) => (
            <Link
              key={k}
              href={`/menu#${k}`}
              className="inline-flex items-center rounded-full border border-cocoa-700/15 bg-white px-4 h-9 text-sm text-cocoa-900 hover:bg-cream-100 transition-colors"
            >
              {KIND_LABELS[k].plural}
            </Link>
          ))}
        </div>
        {/* First product gets the featured (full-bleed, title-overlaid) variant
            so the slice section reads like a magazine spread. The remaining
            kinds fall to the standard card. */}
        <div className="grid gap-6 lg:grid-cols-3">
          {featured[0] && (
            <ProductCard
              product={featured[0]}
              variant="featured"
              className="lg:col-span-2 lg:row-span-2"
            />
          )}
          {featured.slice(1).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <DietaryAndCustomBand />
      <Manifesto />
      <InTheMediaBand />
      <StoriesBand />
      <VisitSection />
      <BusinessBand />
      <ClosingCta />
    </>
  )
}

function Hero({ status }: { status: { open: boolean; nextChange?: string } }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />
      <div className="container relative pt-12 pb-16 md:pt-20 md:pb-24 grid gap-10 lg:grid-cols-12 lg:gap-12 items-center">
        <div className="lg:col-span-6">
          <Eyebrow>Cake shop · Sugar Land, TX</Eyebrow>
          <h1
            id="hero-tagline"
            className="display-h1 mt-5 [text-wrap:balance]"
          >
            Where every bite <span className="text-sky">tells a story</span>.
          </h1>
          <p className="mt-5 text-lg text-cocoa-900/75 max-w-xl leading-relaxed">
            Handcrafted cakes and pastries made with love — European traditions, warm Kazakh
            hospitality, baked fresh every morning in our Sugar Land kitchen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/order">Order a cake</Link>
            </Button>
            <Button asChild size="lg" variant="outline-sky">
              <Link href="/menu">Explore the menu</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/chat">
                <MessageSquareHeart /> Chat with us
              </Link>
            </Button>
          </div>
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
          </div>
        </div>
        <div className="lg:col-span-6 relative">
          <HeroImage
            src={ASSETS.hero[0]}
            alt="Hand-decorated honey cake from Happy Cake's Sugar Land kitchen — six layers of golden biscuit and soft custard"
            className="aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]"
          />
          <div className="absolute -bottom-6 -left-6 sm:-left-10 hidden md:flex items-center gap-3 bakery-card px-5 py-4">
            <Sparkles className="h-5 w-5 text-sky" />
            <div className="text-sm">
              <div className="font-medium text-cocoa-900">Fresh today</div>
              <div className="text-cocoa-900/65">Baked this morning, ready for pickup.</div>
            </div>
          </div>
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

function InTheMediaBand() {
  const featured = APPEARANCES.slice(0, 3)
  if (featured.length === 0) return null
  return (
    <section className="container mt-24">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <Eyebrow>We&apos;re in the media</Eyebrow>
          <h2 className="display-h2 mt-3">Press, podcasts, and YouTube</h2>
          <p className="mt-2 text-cocoa-900/70 max-w-xl">
            Where Askhat&apos;s told the story of Happy Cake — Sugar Land, family recipes, and a
            kitchen that opened with one oven.
          </p>
        </div>
        <Button asChild variant="outline-sky" shape="pill">
          <Link href="/press">
            All appearances
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="grid gap-5 md:grid-cols-3">
        {featured.map((a) => {
          const Icon = a.type === 'youtube' ? Youtube : Newspaper
          const tone = a.type === 'youtube' ? 'bg-berry/10 text-berry' : 'bg-sky/10 text-sky-700'
          const href = a.url ?? '/press'
          const external = Boolean(a.url)
          return (
            <li key={a.title}>
              <a
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener' : undefined}
                className="group bakery-card flex flex-col h-full p-5 hover:-translate-y-0.5 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-cocoa-900/55 truncate">
                      {a.outlet}
                    </div>
                    <div className="text-xs text-cocoa-900/55">
                      {new Date(a.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <h3 className="display-h3 mt-4 text-lg group-hover:text-sky-700 transition-colors [text-wrap:balance]">
                  {a.title}
                </h3>
                <p className="mt-2 text-sm text-cocoa-900/70 leading-relaxed line-clamp-3">
                  {a.description}
                </p>
                {external && (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs text-sky-700">
                    Open <ExternalLink className="h-3 w-3" />
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
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
          <Eyebrow>Our story</Eyebrow>
          <h2 className="display-h2 mt-3">{BRAND.tagline}</h2>
        </div>
        <div className="md:col-span-7 text-cocoa-900/85 space-y-4 leading-relaxed">
          <p>
            Happy Cake was born from a love of bringing people together through exceptional baked
            goods. From layered honey cakes to delicate cloud cakes, every item is crafted fresh,
            every day.
          </p>
          <p>
            We believe the best moments in life come with great coffee and something sweet. Come
            in, sit down, and let us take care of the rest.
          </p>
          <p>
            <Link href="/about" className="text-sky-700 underline-offset-4 hover:underline font-medium">
              Read the rest of our story →
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
      <div className="mt-10 grid gap-6 md:grid-cols-2">
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
