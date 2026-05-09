import Link from 'next/link'
import { listProducts } from '@/lib/api'
import { BRAND } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { ArrowRight, MessageSquareHeart, Cake, ShieldCheck } from 'lucide-react'

export const revalidate = 60

export default async function HomePage() {
  const products = await listProducts()
  // The home grid shows the first four cakes from the catalog. We prefer
  // slices + whole cakes when those tags exist, but fall back to whatever
  // the backend hands us so the section is never empty.
  const preferred = products.filter(
    (p) => p.category === 'whole-cakes' || p.category === 'slices' || p.category === 'cake',
  )
  const classics = (preferred.length ? preferred : products).slice(0, 4)

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    '@id': `${BRAND.origin}/#bakery`,
    name: BRAND.name,
    description: `${BRAND.tagline} ${BRAND.slogan}`,
    image: `${BRAND.origin}/og.png`,
    url: BRAND.origin,
    telephone: '+1-555-555-1234',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Sugar Land',
      addressRegion: 'TX',
      addressCountry: 'US',
    },
    sameAs: [BRAND.instagram, BRAND.whatsapp],
    servesCuisine: ['Bakery', 'Cakes', 'Desserts'],
    areaServed: { '@type': 'Place', name: BRAND.region },
    openingHours: 'Mo-Su 09:00-19:00',
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
      <Hero />
      <section className="container mt-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <Eyebrow>Today's bake</Eyebrow>
            <h2 className="display-h2 mt-2">What's in the case</h2>
            <p className="mt-2 text-happy-900/75 max-w-xl">
              Hand-decorated, hand-packed, baked this morning in Sugar Land. Order through Sunday.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/menu">
              See the full menu
              <ArrowRight className="ml-1" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {classics.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <Signposts />
      <Manifesto />
      <ClosingCta />
    </>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pattern-dots-blue opacity-60 pointer-events-none" aria-hidden />
      <div className="container relative pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-3xl">
          <Eyebrow>HappyCake · Sugar Land</Eyebrow>
          <h1 id="hero-tagline" className="display-h1 mt-5 text-[2.6rem] md:text-[3.5rem] leading-[1.05]">
            {BRAND.tagline}
          </h1>
          <p className="mt-5 text-lg text-happy-900/80 max-w-xl">
            {BRAND.slogan} Real cakes, made by hand in our Sugar Land kitchen — the kind your
            grandmother would recognise.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/order">Order a cake</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/menu">See the menu</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/chat">
                <MessageSquareHeart /> Chat with us
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-happy-900/60">
            Today's bake is out — pick yours up by 7 PM.
          </p>
        </div>
      </div>
    </section>
  )
}

function Signposts() {
  const items = [
    {
      icon: Cake,
      title: 'Real cakes',
      body:
        'Made by hand in our Sugar Land kitchen. Every cake is hand-decorated and hand-packed.',
    },
    {
      icon: ShieldCheck,
      title: 'Honest about today',
      body:
        'If a cake takes 24 hours, we say 24 hours. If a slice is sold out, we say so. No false promises.',
    },
    {
      icon: MessageSquareHeart,
      title: 'Order how you like',
      body: 'Site, WhatsApp, or Instagram DM. Same record, same cake, same care.',
    },
  ]
  return (
    <section className="container mt-20">
      <div className="grid gap-5 md:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="p-6 bg-cream-100 rounded-lg border border-happy-700/10">
            <div className="h-10 w-10 rounded-md bg-happy-700 text-cream-50 flex items-center justify-center">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="display-h3 mt-4">{title}</h3>
            <p className="mt-2 text-happy-900/75">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Manifesto() {
  return (
    <section className="container mt-24">
      <div className="grid gap-10 md:grid-cols-2 items-start">
        <div>
          <Eyebrow>Our story</Eyebrow>
          <h2 className="display-h2 mt-2">The original taste of happiness</h2>
        </div>
        <div className="text-happy-900/85 space-y-4 max-w-prose">
          <p>
            It started with a phrase: <em>"It's just like homemade."</em> We started baking cakes
            as if for ourselves. People kept coming back saying it tasted like real home baking.
          </p>
          <p>
            Every ingredient is carefully selected. Every cake is hand-decorated and hand-packed.
            Every recipe was perfected over years until it earned its name.
          </p>
          <p>
            <Link href="/about" className="text-happy-700 underline-offset-4 hover:underline">
              Read the rest of our story →
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="container mt-24">
      <div className="rounded-lg bg-happy-900 text-cream-50 p-10 md:p-14 relative overflow-hidden">
        <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
        <div className="relative">
          <p className="font-display text-3xl md:text-4xl max-w-2xl">
            Today's bake is out — pick yours up by 7 PM.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-cream-50 text-happy-900 hover:bg-cream-100">
              <Link href="/order">Start an order</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-cream-50 hover:bg-happy-700">
              <Link href="/menu">See what's in the case</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
