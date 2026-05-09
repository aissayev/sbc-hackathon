import Link from 'next/link'
import Image from 'next/image'
import { listProducts } from '@/lib/api'
import { BRAND, ASSETS, PILLARS } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HoursTable, isOpenNow } from '@/components/brand/hours'
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
} from 'lucide-react'

export const revalidate = 60

const PILLAR_ICONS = { sparkles: Sparkles, coffee: Coffee, gift: Gift, heart: Heart } as const

export default async function HomePage() {
  const products = await listProducts()
  const featured = products.slice(0, 4)
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
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <Eyebrow>Today's bake</Eyebrow>
            <h2 className="display-h2 mt-3">Our specialties</h2>
            <p className="mt-2 text-cocoa-900/70 max-w-xl">
              Hand-decorated, hand-packed, baked this morning in our Sugar Land kitchen.
            </p>
          </div>
          <Button asChild variant="outline-sky" shape="pill" size="default">
            <Link href="/menu">
              See the full menu
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <Manifesto />
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
          <div className="relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5] rounded-[28px] overflow-hidden shadow-lift bg-cream-200">
            <Image
              src={ASSETS.hero[0]}
              alt="A cake from Happy Cake"
              fill
              priority
              sizes="(min-width: 1024px) 540px, 100vw"
              className="object-cover"
            />
          </div>
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
