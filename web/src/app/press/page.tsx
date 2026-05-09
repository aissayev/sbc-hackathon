import type { Metadata } from 'next'
import Link from 'next/link'
import { Youtube, Mic, ExternalLink, Mail, Newspaper } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Press & podcasts',
  description:
    'Press, podcasts, and YouTube appearances by Askhat — owner of Happy Cake Sugar Land. Family-owned bakery in Sugar Land, TX.',
  alternates: { canonical: '/press' },
}

// When a real appearance lands, drop a row in this array. Keeping it as data
// (not MDX) means the press page doubles as a structured Person/sameAs
// signal for AI search and Knowledge Panel cards.

interface Appearance {
  type: 'youtube' | 'podcast' | 'press'
  title: string
  outlet: string
  date: string // ISO
  description: string
  url?: string
  embed_url?: string // YouTube/podcast embed
  image_url?: string
}

const APPEARANCES: Appearance[] = [
  {
    type: 'youtube',
    title: 'A day at Happy Cake — honey cake, the long way around',
    outlet: 'Happy Cake YouTube',
    date: '2026-03-14',
    description:
      'Askhat walks through one bake of the signature honey cake — biscuit, custard, the overnight rest. The long version of "why six layers".',
    url: 'https://www.youtube.com/@happycake.us',
  },
  {
    type: 'podcast',
    title: 'Family bakeries, immigrant kitchens, and Sugar Land',
    outlet: 'Local Texas Pod',
    date: '2026-02-08',
    description:
      'A conversation about moving a Kazakh family recipe to a Texas counter — what changed, what didn\'t, what surprised us about Sugar Land.',
  },
  {
    type: 'press',
    title: 'Where to find honey cake in Greater Houston',
    outlet: 'Houston neighborhood guide',
    date: '2026-01-22',
    description:
      'Round-up of European-style cakes around Houston; Happy Cake highlighted for the medovik and the Promenade Way counter.',
  },
]

const ICON: Record<Appearance['type'], React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  podcast: Mic,
  press: Newspaper,
}

const TYPE_LABEL: Record<Appearance['type'], string> = {
  youtube: 'YouTube',
  podcast: 'Podcast',
  press: 'Press',
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
        '@type': a.type === 'press' ? 'Article' : 'CreativeWork',
        name: a.title,
        publisher: a.outlet,
        datePublished: a.date,
        url: a.url,
      },
    })),
  }

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
          parts of running a kitchen that don&apos;t make it onto the Instagram feed. Below: YouTube,
          podcast appearances, and the occasional neighborhood-guide write-up.
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

      <section className="container pb-16">
        <ul className="grid gap-5">
          {APPEARANCES.map((a) => {
            const Icon = ICON[a.type]
            const Wrapper = a.url ? 'a' : 'div'
            const linkProps = a.url ? { href: a.url, target: '_blank', rel: 'noopener' } : {}
            return (
              <li key={a.title}>
                <Wrapper
                  {...linkProps}
                  className="bakery-card flex items-start gap-5 p-5 md:p-6 hover:bg-cream-100 transition-colors"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky/10 text-sky-700 shrink-0">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cocoa-900/55">
                      <span>{TYPE_LABEL[a.type]}</span>
                      <span aria-hidden>·</span>
                      <span>{a.outlet}</span>
                      <span aria-hidden>·</span>
                      <span>{new Date(a.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    </div>
                    <h2 className="display-h3 mt-1 [text-wrap:balance]">{a.title}</h2>
                    <p className="mt-2 text-cocoa-900/75 leading-relaxed">{a.description}</p>
                  </div>
                  {a.url && (
                    <ExternalLink className="h-5 w-5 text-cocoa-900/40 shrink-0" aria-hidden />
                  )}
                </Wrapper>
              </li>
            )
          })}
        </ul>

        <div className="mt-12 rounded-2xl bg-cream-100 border border-cocoa-700/10 p-6 md:p-8 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
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
