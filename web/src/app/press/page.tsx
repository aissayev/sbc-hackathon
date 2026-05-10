import type { Metadata } from 'next'
import Link from 'next/link'
import { Youtube, Mail } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { APPEARANCES } from '@/lib/press'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { PressCardGrid } from '@/components/sections/press-card-grid'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Press & podcasts',
  description:
    'Press, podcasts, and YouTube appearances by Askhat — owner of HappyCake Sugar Land. Family-owned bakery in Sugar Land, TX.',
  alternates: { canonical: '/press' },
}

export default function PressPage() {
  // Person + sameAs signals + ItemList of appearances. Helps Google's KP and
  // GEO crawlers understand who Askhat is and where his media surfaces live.
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Askhat',
    jobTitle: 'Founder & Head Baker',
    worksFor: { '@type': 'Organization', name: BRAND.name, url: BRAND.origin },
    sameAs: [BRAND.instagram, 'https://www.youtube.com/@happycake.us'],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${BRAND.name} press & appearances`,
    itemListElement: APPEARANCES.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': a.type === 'press' ? 'NewsArticle' : 'VideoObject',
        name: a.title,
        publisher: a.outlet,
        datePublished: a.date,
        url: a.url,
        ...(a.youtube_id ? { embedUrl: `https://www.youtube.com/embed/${a.youtube_id}` } : {}),
      },
    })),
  }

  const videos = APPEARANCES.filter((a) => a.youtube_id)
  const press = APPEARANCES.filter((a) => a.type !== 'youtube')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <section className="container pt-12 md:pt-20 pb-10">
        <Eyebrow>Press & podcasts</Eyebrow>
        <h1 className="display-h1 mt-4 [text-wrap:balance]">
          Where you can <span className="text-sky">hear</span> from us
        </h1>
        <p className="mt-4 max-w-2xl text-cocoa-900/75 leading-relaxed">
          Askhat talks about family-recipe baking, building a small bakery in Sugar Land, and the
          parts of running a kitchen that don&apos;t make it onto the Instagram feed. Below: YouTube
          tours, podcast appearances, and the press write-ups.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild variant="outline-sky">
            <a href="https://www.youtube.com/@happycake.us" target="_blank" rel="noopener">
              <Youtube /> YouTube channel
            </a>
          </Button>
          <Button asChild variant="ghost">
            <a href={`mailto:${BRAND.email}?subject=Press inquiry`}>
              <Mail /> Press inquiries
            </a>
          </Button>
        </div>
      </section>

      {videos.length > 0 && (
        <section className="container pb-12">
          <Eyebrow>Watch</Eyebrow>
          <h2 className="display-h2 mt-2 mb-6">Behind the counter</h2>
          <PressCardGrid items={videos} />
        </section>
      )}

      {press.length > 0 && (
        <section className="container pb-16">
          <Eyebrow>Read</Eyebrow>
          <h2 className="display-h2 mt-2 mb-6">In the press</h2>
          <PressCardGrid items={press} compact />
        </section>
      )}

      <section className="container pb-16">
        <div className="rounded-2xl bg-cream-100 border border-cocoa-700/10 p-6 md:p-8 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Eyebrow>Have a story?</Eyebrow>
            <h3 className="display-h3 mt-2">We answer real press inquiries.</h3>
            <p className="mt-2 text-cocoa-900/75 max-w-prose">
              Writing about Sugar Land, family-owned bakeries, immigrant kitchens, or honey cake?
              Email Askhat directly — he reads every message and answers within a day or two.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href={`mailto:${BRAND.email}?subject=Press inquiry`}>
              <Mail /> {BRAND.email}
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
