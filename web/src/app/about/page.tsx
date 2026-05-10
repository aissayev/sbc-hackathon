import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { HeroImage } from '@/components/brand/hero-image'
import { BRAND, ASSETS } from '@/lib/brand'
import { APPEARANCES } from '@/lib/press'
import {
  Heart,
  Users,
  Sparkles,
  Home as HomeIcon,
  Newspaper,
  Youtube,
  ArrowRight,
  ExternalLink,
  Plane,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'About — a family bakery from Kazakhstan, baking in Sugar Land',
  description:
    'HappyCake is a family-owned bakery — born in Kazakhstan, baking in Sugar Land, Texas. Run by Askhat and his wife. European cake traditions, warm Kazakh hospitality, every cake hand-decorated.',
  alternates: { canonical: '/about' },
}

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
    title: 'A kitchen in Kazakhstan',
    body:
      'HappyCake started in Kazakhstan as a family kitchen. Askhat and his wife bake honey cakes for friends, neighbours, and the local diaspora. Every recipe came from family — written by hand, tested at the dinner table, passed down.',
  },
  {
    year: '2022',
    title: 'A community, then a brand',
    body:
      'Word-of-mouth filled the calendar. HappyCake grew across Kazakhstan as a community of families who all believed cakes belong made by hand — not on a conveyor.',
  },
  {
    year: '2024',
    title: 'First US location — Sugar Land',
    body:
      'We moved the family to Sugar Land and opened our first counter on Promenade Way. Same recipes from Kazakhstan, same hands behind the case. Featured by Community Impact as the first US location of a Kazakhstan-born bakery.',
  },
  {
    year: '2026',
    title: 'A real café for the neighbourhood',
    body:
      'A real café and counter in the heart of Sugar Land. Same family. Same recipes. Same warm welcome — now with seats, espresso, and a bigger oven.',
  },
]

export default function AboutPage() {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BRAND.origin}/#bakery`,
    name: BRAND.legal,
    alternateName: 'HappyCake',
    description:
      'A family-owned, family-run cake shop — born in Kazakhstan, baking in Sugar Land, Texas. European traditions, warm Kazakh hospitality.',
    url: BRAND.origin,
    telephone: BRAND.phone.e164,
    email: BRAND.email,
    image: ASSETS.hero[0],
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
    foundingLocation: { '@type': 'Place', name: 'Kazakhstan' },
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
              <Plane className="h-3.5 w-3.5" /> From Kazakhstan · baking in Sugar Land
            </span>
            <h1 className="display-h1 mt-5 [text-wrap:balance]">
              A family bakery
              <br className="hidden md:block" />
              <span className="text-sky">that crossed an ocean</span>.
            </h1>
            <p className="mt-5 text-lg text-cocoa-900/80 leading-relaxed max-w-xl">
              HappyCake started in a family kitchen in Kazakhstan and grew into a community of
              families baking by hand. In 2024 we opened our first US location on Promenade Way in
              Sugar Land — same recipes, same hands behind the case.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/menu">See the menu</Link>
              </Button>
              <Button asChild size="lg" variant="outline-sky">
                <Link href="#timeline">Our journey</Link>
              </Button>
            </div>
          </div>
          <div className="lg:col-span-6">
            <HeroImage
              src={ASSETS.about.hero}
              alt="HappyCake baker holding a tiramisu tart, surrounded by floating slices, berries and pastries — a stylized family-bakery portrait"
              className="aspect-[4/5]"
            />
            <p className="mt-3 text-xs text-cocoa-900/55 text-right">
              The HappyCake family — small bakery, big love.
            </p>
          </div>
        </div>
      </section>

      <section className="container mt-4 max-w-5xl">
        <div className="rounded-2xl bg-cream-100 border border-cocoa-700/10 p-6 md:p-8 grid gap-4 md:grid-cols-4">
          <Quick label="Born" value="Kazakhstan, 2018" />
          <Quick label="In Sugar Land" value="Since 2024" />
          <Quick label="Owners" value="Askhat + family" />
          <Quick label="Where" value="Promenade Way, TX" />
        </div>
      </section>

      <section className="container mt-16 max-w-3xl text-cocoa-900/85 space-y-5 text-lg leading-relaxed">
        <Eyebrow>Our story</Eyebrow>
        <h2 className="display-h2 mt-2">From a Kazakh family kitchen to Promenade Way</h2>
        <p>
          HappyCake was born from a love of bringing people together through exceptional baked
          goods. From layered honey cakes to delicate cloud cakes, every item is crafted fresh
          every day — the same recipes Askhat&apos;s family has perfected since 2018, written by
          hand and tested at the dinner table.
        </p>
        <p>
          We grew across Kazakhstan as a community of families who believe a truly delicious cake
          can&apos;t be made on a conveyor — it has to be made by people who care. As word
          travelled, our customers asked us to bring those cakes to their families abroad. So we
          did.
        </p>
        <p>
          In 2024 we opened our first US location in Sugar Land, the closest place to where our
          community already lives, walks, and gathers. We&apos;re not a chain. We&apos;re not a
          franchise out here. We&apos;re one family, making cakes the way we would for our own
          table — and serving them to yours.
        </p>
      </section>

      {/* Owner portrait — Askhat and his wife. The page hero is a stylised
          composite (chef-with-cake) per design; this section reintroduces
          the real-people photo that anchors the family-owned story. The
          stylised hero stays as the cover; this is the human under the
          apron. The asset resolves to the bundled local file when the CDN
          isn't configured (see ASSETS.team in lib/brand.ts). */}
      <section className="container mt-16 max-w-3xl">
        <figure className="mx-auto max-w-md">
          <HeroImage
            src={ASSETS.team.ownerPortrait}
            alt="Askhat and his wife — owners of HappyCake — at a community event in traditional Kazakh dress"
            className="aspect-[4/5]"
          />
          <figcaption className="mt-3 text-sm text-cocoa-900/65 text-center">
            Askhat and his wife — owners and every-day operators.
          </figcaption>
        </figure>
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

      <section className="container mt-20 max-w-3xl" id="timeline">
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
              our neighbours on the team, and the local suppliers we work with. There&apos;s no
              corporate parent skimming the top.
            </p>
            <p>
              Family-owned also means accountable. If something&apos;s off about your cake, the
              person fixing it is the same person who baked it. We don&apos;t have a
              &quot;customer success&quot; queue — we just have us.
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

      <InsideBakery />

      <PressBand />

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

function InsideBakery() {
  // Real interior shots from Promenade Way, arranged as an editorial mosaic.
  // The neon-sign-with-flowers carries the eye in (largest tile), then the
  // dining room + wall art + coffee+cake fill out the visit feel without
  // turning into a photo dump.
  const tiles = [
    {
      src: ASSETS.store.signWithFlowers,
      alt: 'HappyCake neon sign over the counter, with a fresh flower bouquet and a branded coffee cup',
      span: 'md:col-span-2 md:row-span-2',
      aspect: 'aspect-[3/4]',
    },
    {
      src: ASSETS.store.signOverTable,
      alt: 'Communal table with blue chairs under the HappyCake neon sign and a Cloud Cake poster',
      span: 'md:col-span-2',
      aspect: 'aspect-[16/10]',
    },
    {
      src: ASSETS.store.coffeeAndCake,
      alt: 'Black-Forest cake slice and a HappyCake-branded iced coffee on the dining table',
      span: '',
      aspect: 'aspect-square',
    },
    {
      src: ASSETS.store.wallArt,
      alt: 'Cupcakes and cake-slice posters framed on the dining-room wall',
      span: '',
      aspect: 'aspect-square',
    },
  ] as const
  return (
    <section className="container mt-20 max-w-5xl" aria-labelledby="inside-bakery">
      <Eyebrow>Inside the bakery</Eyebrow>
      <h2 id="inside-bakery" className="display-h2 mt-3">Where you&apos;ll sit</h2>
      <p className="mt-3 text-cocoa-900/70 max-w-xl">
        Bright neon, blue chairs, oversized windows. We built the room we&apos;d want to bring our
        own family to.
      </p>
      <div className="mt-8 grid gap-3 md:grid-cols-4 md:auto-rows-[160px]">
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-2xl bg-cream-100 ${t.span} ${t.aspect} md:aspect-auto`}
          >
            <Image
              src={t.src}
              alt={t.alt}
              fill
              sizes="(min-width: 1024px) 480px, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function PressBand() {
  const featured = APPEARANCES.slice(0, 3)
  if (featured.length === 0) return null
  return (
    <section className="container mt-20 max-w-5xl" aria-labelledby="press">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <Eyebrow>We&apos;re in the media</Eyebrow>
          <h2 id="press" className="display-h2 mt-3">Press, podcasts, and YouTube</h2>
          <p className="mt-2 text-cocoa-900/70 max-w-xl">
            Where Askhat&apos;s told the story of HappyCake — Sugar Land, family recipes, and a
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
                    <Icon className="h-4 w-4" />
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

function Quick({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="text-xs uppercase tracking-[0.14em] text-cocoa-900/55">{label}</div>
      <div className="font-display text-xl md:text-2xl text-cocoa-900 mt-1 leading-tight">{value}</div>
    </div>
  )
}
