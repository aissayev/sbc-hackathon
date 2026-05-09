import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { HoursTable } from '@/components/brand/hours'
import { HeroImage } from '@/components/brand/hero-image'
import { BRAND, ASSETS } from '@/lib/brand'
import {
  MapPin,
  Phone,
  Instagram,
  Mail,
  Heart,
  Users,
  Sparkles,
  Home as HomeIcon,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'About — a family-owned bakery in Sugar Land',
  description:
    'Happy Cake is a family-owned, family-run bakery in Sugar Land, Texas. Run by Askhat and his wife — European cake traditions, warm Kazakh hospitality, and the kind of café you stay an extra cup in.',
  alternates: { canonical: '/about' },
}

// Schema.org Person + LocalBusiness JSON-LD so AI agents and search treat
// the family-owned framing as first-class data, not just marketing copy.

const VALUES = [
  {
    icon: HomeIcon,
    title: 'Family-owned, family-run',
    body:
      'Askhat and his wife run every part of the bakery — kitchen, counter, deliveries, and the late-night recipe testing. There is no headquarters, no franchise board, no shareholder report.',
  },
  {
    icon: Heart,
    title: 'Made with heart',
    body:
      'Every cake is hand-decorated and hand-packed. Recipes were perfected over years until they earned their names. We don\'t cut corners we\'d notice on the dinner table.',
  },
  {
    icon: Users,
    title: 'Sugar Land neighbours',
    body:
      'We bake for our neighbours — the school pickup, the office break, the Sunday family lunch. Local first; we know our regulars by name and dietary preferences.',
  },
  {
    icon: Sparkles,
    title: 'European + Kazakh',
    body:
      'Honey-cake layers from Eastern European tradition, the warm hospitality from Kazakhstan, and the family table they share. Two heritages on one plate.',
  },
]

const TIMELINE = [
  {
    year: '2018',
    title: 'A kitchen in the family home',
    body:
      'Askhat and his wife start baking honey cakes for friends, neighbours, and the local diaspora. Every recipe came from the family — written by hand, tested at the dinner table.',
  },
  {
    year: '2022',
    title: 'The first counter',
    body:
      'Word-of-mouth filled the calendar. Time to open a real shop. We picked Sugar Land because that\'s where our community lives — and because the community deserves a bakery that knows them.',
  },
  {
    year: '2026',
    title: 'A real cake shop on Promenade Way',
    body:
      'A real café and counter in the heart of Sugar Land. Same family. Same recipes. Same warm welcome — now with seats, espresso, and a bigger oven.',
  },
]

const CONTACT_CHANNELS = [
  {
    icon: Phone,
    label: 'Call us',
    detail: BRAND.phone.display,
    href: BRAND.phone.hrefTel,
    note: 'Fastest answer during open hours.',
  },
  {
    icon: Mail,
    label: 'Email',
    detail: BRAND.email,
    href: `mailto:${BRAND.email}`,
    note: 'For B2B, press, partnerships.',
  },
  {
    icon: Instagram,
    label: 'Follow on Instagram',
    detail: BRAND.instagramHandle,
    href: BRAND.instagram,
    note: 'New cakes, behind-the-scenes, daily counter shots.',
  },
]

export default function AboutPage() {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BRAND.origin}/#bakery`,
    name: BRAND.legal,
    alternateName: 'Happy Cake',
    description:
      'A family-owned, family-run cake shop in Sugar Land, Texas — European traditions, warm Kazakh hospitality.',
    url: BRAND.origin,
    telephone: BRAND.phone.e164,
    email: BRAND.email,
    image: `${BRAND.origin}${ASSETS.team.ownerPortrait}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address.line1,
      addressLocality: BRAND.address.city,
      addressRegion: BRAND.address.region,
      postalCode: BRAND.address.postalCode,
      addressCountry: BRAND.address.country,
    },
    founder: {
      '@type': 'Person',
      name: 'Askhat',
      jobTitle: 'Owner + Head Baker',
    },
    foundingDate: '2018',
    areaServed: { '@type': 'Place', name: BRAND.region },
    sameAs: [BRAND.instagram, BRAND.whatsapp],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />
        <div className="container relative pt-12 md:pt-20 pb-16 grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-sky/10 text-sky-700 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]">
              <HomeIcon className="h-3.5 w-3.5" /> Family-owned · Sugar Land
            </span>
            <h1 className="display-h1 mt-5 [text-wrap:balance]">
              A small bakery,
              <br className="hidden md:block" />
              <span className="text-sky">run by a family</span> who cares.
            </h1>
            <p className="mt-5 text-lg text-cocoa-900/80 leading-relaxed max-w-xl">
              Happy Cake is owned and run by Askhat and his wife — a family business in the heart
              of Sugar Land. European cake traditions, warm Kazakh hospitality, baked fresh every
              morning. The cake on your table tonight is the cake we'd serve at our own.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/menu">See the menu</Link>
              </Button>
              <Button asChild size="lg" variant="outline-sky">
                <Link href="#visit">Visit us</Link>
              </Button>
            </div>
          </div>
          <div className="lg:col-span-6">
            <HeroImage
              src={ASSETS.team.ownerPortrait}
              alt="Askhat, owner of Happy Cake, with his wife at a community event"
              className="aspect-[4/5]"
            />
            <p className="mt-3 text-xs text-cocoa-900/55 text-right">
              Askhat and his wife — owners + every-day operators.
            </p>
          </div>
        </div>
      </section>

      <section className="container mt-4 max-w-5xl">
        <div className="rounded-2xl bg-cream-100 border border-cocoa-700/10 p-6 md:p-8 grid gap-4 md:grid-cols-3">
          <Quick label="Founded" value="2018" />
          <Quick label="Owners" value="Askhat + family" />
          <Quick label="Where" value="Sugar Land, TX" />
        </div>
      </section>

      <section className="container mt-16 max-w-3xl text-cocoa-900/85 space-y-5 text-lg leading-relaxed">
        <Eyebrow>Our story</Eyebrow>
        <h2 className="display-h2 mt-2">From the family kitchen to Promenade Way</h2>
        <p>
          Happy Cake started in a family kitchen, with Askhat baking honey cakes for friends and
          family. Every recipe was written by hand, tested at the dinner table, and refined until
          it earned a place in our notebook.
        </p>
        <p>
          As the calendar filled with weekend orders, it was clear the cakes belonged with more
          neighbours than just ours. We opened a real counter in Sugar Land — close to where our
          community lives, walks, and gathers — so we could welcome people in person.
        </p>
        <p>
          We are not a chain. We are not a franchise. We are one family making cakes the way we
          would for our own table — and serving them to yours.
        </p>
      </section>

      <section className="container mt-20 max-w-5xl">
        <Eyebrow>What we believe</Eyebrow>
        <h2 className="display-h2 mt-3">A small list of small commitments</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="bakery-card p-7">
              <div className="h-11 w-11 rounded-full bg-sky-100 text-sky inline-flex items-center justify-center">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="display-h3 mt-4 text-xl">{v.title}</h3>
              <p className="mt-2 text-cocoa-900/75 text-sm leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mt-20 max-w-3xl">
        <Eyebrow>Timeline</Eyebrow>
        <h2 className="display-h2 mt-3">How we got here</h2>
        <ol className="mt-8 space-y-6">
          {TIMELINE.map((t) => (
            <li key={t.year} className="grid grid-cols-[80px_1fr] gap-5">
              <div className="font-display text-3xl text-sky text-right leading-none pt-1">{t.year}</div>
              <div className="border-l border-cocoa-700/15 pl-5">
                <div className="font-display text-xl text-cocoa-900">{t.title}</div>
                <p className="mt-1.5 text-cocoa-900/75 text-sm leading-relaxed">{t.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container mt-20 max-w-5xl">
        <Eyebrow>Why family-owned matters</Eyebrow>
        <h2 className="display-h2 mt-3">Local family business, local accountability</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2 items-start">
          <div className="text-cocoa-900/85 leading-relaxed space-y-4">
            <p>
              When you buy a cake from us, your money stays in Sugar Land. It pays our family,
              our neighbours on the team, and the local suppliers we work with. There's no
              corporate parent skimming the top.
            </p>
            <p>
              Family-owned also means accountable. If something's off about your cake, the person
              fixing it is the same person who baked it. We don't have a "customer success" queue
              — we just have us.
            </p>
            <p>
              Supporting local family businesses keeps neighbourhoods alive. Sugar Land has been
              good to us; this is how we try to be good back.
            </p>
          </div>
          <div className="bakery-card p-6 bg-sky/5 border-sky/20">
            <Eyebrow decorator={false} className="text-sky-700">By the numbers</Eyebrow>
            <ul className="mt-3 space-y-3 text-sm text-cocoa-900/85">
              <li className="flex justify-between border-b border-cocoa-700/10 pb-2">
                <span>Local suppliers</span>
                <span className="font-medium text-cocoa-900">12+</span>
              </li>
              <li className="flex justify-between border-b border-cocoa-700/10 pb-2">
                <span>Weekly regular customers</span>
                <span className="font-medium text-cocoa-900">200+</span>
              </li>
              <li className="flex justify-between border-b border-cocoa-700/10 pb-2">
                <span>Cakes baked since 2018</span>
                <span className="font-medium text-cocoa-900">10,000+</span>
              </li>
              <li className="flex justify-between">
                <span>Years run by the same family</span>
                <span className="font-medium text-cocoa-900">8</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="container mt-20 max-w-5xl" id="visit">
        <Eyebrow>Visit · contact · follow</Eyebrow>
        <h2 className="display-h2 mt-3">Come say hello</h2>
        <p className="mt-3 text-cocoa-900/70 max-w-xl">
          The fastest way to know us is to walk in. The second-fastest is to follow along — we
          post the day's bake, behind-the-scenes, and the occasional family moment.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="bakery-card p-7">
            <Eyebrow decorator={false}>Hours</Eyebrow>
            <h3 className="display-h3 mt-2 text-xl">When we're open</h3>
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
            <p className="mt-3 text-sm text-cocoa-900/65">{BRAND.address.parkingNote}</p>
            <Button asChild variant="sky" size="sm" className="mt-5">
              <a href={BRAND.mapsUrl} target="_blank" rel="noopener">
                <MapPin /> Get directions
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {CONTACT_CHANNELS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target={c.href.startsWith('http') ? '_blank' : undefined}
              rel={c.href.startsWith('http') ? 'noopener' : undefined}
              className="bakery-card p-6 hover:bg-cream-100 transition-colors flex items-start gap-4"
            >
              <div className="h-10 w-10 rounded-full bg-sky-100 text-sky inline-flex items-center justify-center shrink-0">
                <c.icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.14em] text-cocoa-900/55">{c.label}</div>
                <div className="font-medium text-cocoa-900 mt-0.5 truncate">{c.detail}</div>
                <div className="text-xs text-cocoa-900/65 mt-1 leading-relaxed">{c.note}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="container mt-20 mb-20 max-w-5xl">
        <div className="rounded-[28px] bg-cocoa-900 text-cream p-10 md:p-14 relative overflow-hidden">
          <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
          <div className="relative max-w-2xl">
            <Eyebrow className="text-sky-200">Family-baked, neighbour-served</Eyebrow>
            <p className="font-display text-3xl md:text-4xl mt-3 leading-tight [text-wrap:balance]">
              The best way to support a family bakery is to taste one of our cakes.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="sky">
                <Link href="/menu">See the menu</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-cream hover:bg-cream/10"
              >
                <Link href="/order">Order a cake</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function Quick({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="text-xs uppercase tracking-[0.14em] text-cocoa-900/55">{label}</div>
      <div className="font-display text-2xl text-cocoa-900 mt-1">{value}</div>
    </div>
  )
}
