import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, ASSETS } from '@/lib/brand'
import { PACKAGES } from '@/lib/b2b'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HeroImage } from '@/components/brand/hero-image'
import {
  ArrowRight,
  Calendar,
  Building2,
  ShieldCheck,
  Truck,
  Phone,
  Mail,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'For business — catering, gifting, standing orders',
  description:
    'Office breaks, event catering, corporate gifting, and standing programs from Happy Cake. Sugar Land + Houston metro. One point of contact, one invoice, dietary-friendly options.',
  alternates: { canonical: '/business' },
}

const TRUST_SIGNALS = [
  {
    icon: Calendar,
    title: '24-hour standard',
    body: 'Most office orders run on a single day\'s notice. Quarterly programs lock the calendar.',
  },
  {
    icon: ShieldCheck,
    title: 'Dietary-friendly by default',
    body: 'Gluten-free, no-nuts, dairy-free, vegan, halal-friendly. We label everything and never guess.',
  },
  {
    icon: Truck,
    title: 'Sugar Land + Houston metro',
    body: 'Local delivery in our service area; outside metro by arrangement. Single drop, single invoice.',
  },
  {
    icon: Building2,
    title: 'One point of contact',
    body: 'Askhat handles every B2B account directly. No queue, no service tier — just a phone call.',
  },
]

const PROCESS = [
  { n: '1', label: 'Inquire', body: 'Five quick questions. Takes ~2 minutes.' },
  { n: '2', label: 'Quote', body: 'Reply within one business day with pricing + a sample plan.' },
  { n: '3', label: 'Tasting', body: 'For programs over $1,500 — bring it to your team to vote.' },
  { n: '4', label: 'Standing', body: 'Recurring drops on your calendar. Pause or change anytime.' },
]

export default function BusinessLanding() {
  // Service / B2B JSON-LD so AI agents and search treat /business as a
  // distinct service surface from /menu.
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Happy Cake — corporate catering, gifting, and standing programs',
    provider: {
      '@type': 'Bakery',
      '@id': `${BRAND.origin}/#bakery`,
      name: BRAND.legal,
      url: BRAND.origin,
    },
    areaServed: { '@type': 'Place', name: BRAND.region },
    serviceType: ['Corporate catering', 'Office breaks', 'Corporate gifting', 'Standing-order programs'],
    offers: PACKAGES.map((p) => ({
      '@type': 'Offer',
      name: p.name,
      description: p.body,
      url: `${BRAND.origin}/business#${p.slug}`,
    })),
    url: `${BRAND.origin}/business`,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />
        <div className="container relative pt-12 md:pt-20 pb-16 grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7">
            <Badge variant="sky" className="px-3 py-1">For business</Badge>
            <h1 className="display-h1 mt-4 [text-wrap:balance]">
              For your <span className="text-sky">office</span>, your event,
              <br className="hidden md:block" />
              and the <span className="text-sky">moments that matter</span>.
            </h1>
            <p className="mt-5 text-lg text-cocoa-900/80 leading-relaxed max-w-xl">
              Office breaks, event catering, corporate gifting, and standing programs. One point
              of contact, one invoice, real cakes baked the same morning.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="sky">
                <Link href="/business/inquire">
                  Tell us about your needs <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={BRAND.phone.hrefTel}>
                  <Phone /> {BRAND.phone.display}
                </a>
              </Button>
            </div>
            <p className="mt-6 text-sm text-cocoa-900/60">
              Reply within one business day · Sugar Land + Houston metro
            </p>
          </div>
          <div className="lg:col-span-5">
            <HeroImage
              src={ASSETS.hero[2] ?? ASSETS.hero[0]}
              alt="Curated office dessert box from Happy Cake — assorted slices, rolls, and mini cakes for a Houston-area office break"
              className="aspect-[4/5]"
            />
          </div>
        </div>
      </section>

      <section className="container mt-12 md:mt-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_SIGNALS.map((t) => (
            <div key={t.title} className="bakery-card p-6">
              <div className="h-11 w-11 rounded-full bg-sky-100 text-sky inline-flex items-center justify-center">
                <t.icon className="h-5 w-5" />
              </div>
              <h3 className="display-h3 text-lg mt-4">{t.title}</h3>
              <p className="mt-2 text-sm text-cocoa-900/70 leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mt-20">
        <div className="text-center max-w-2xl mx-auto">
          <Eyebrow>What we offer</Eyebrow>
          <h2 className="display-h2 mt-3">Three programs, one kitchen</h2>
          <p className="mt-3 text-cocoa-900/70">
            Pick the one that fits — we'll tailor the rest in our reply.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PACKAGES.map((p) => (
            <article id={p.slug} key={p.slug} className="bakery-card p-7 flex flex-col">
              <h3 className="display-h3 text-2xl">{p.name}</h3>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-sky-700">{p.starting_at}</p>
              <p className="mt-4 text-cocoa-900/75 leading-relaxed">{p.body}</p>
              <ul className="mt-5 space-y-2 text-sm text-cocoa-900/85">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="text-sky mt-1">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline-sky" size="sm" className="mt-7 self-start">
                <Link href={`/business/inquire?type=${p.slug}`}>
                  Inquire <ArrowRight />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="container mt-20 max-w-5xl">
        <div className="text-center max-w-2xl mx-auto">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="display-h2 mt-3">From inquiry to standing program</h2>
        </div>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((p) => (
            <li key={p.n} className="bakery-card p-6">
              <div className="h-9 w-9 rounded-full bg-cocoa-700 text-cream inline-flex items-center justify-center font-display font-semibold text-base">
                {p.n}
              </div>
              <h3 className="display-h3 text-lg mt-4">{p.label}</h3>
              <p className="mt-2 text-sm text-cocoa-900/70 leading-relaxed">{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container mt-20 mb-20 max-w-5xl">
        <div className="rounded-[28px] bg-cocoa-900 text-cream p-10 md:p-14 relative overflow-hidden">
          <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
          <div className="relative max-w-2xl">
            <Eyebrow className="text-sky-200">Ready when you are</Eyebrow>
            <p className="font-display text-3xl md:text-4xl mt-3 leading-tight [text-wrap:balance]">
              Tell us what you're planning. We'll reply within one business day.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="sky">
                <Link href="/business/inquire">Send an inquiry</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-cream hover:bg-cream/10">
                <a href={`mailto:${BRAND.email}?subject=Catering inquiry`}>
                  <Mail /> Email us instead
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
