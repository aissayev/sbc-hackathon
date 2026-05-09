import type { Metadata } from 'next'
import Link from 'next/link'
import { Youtube, Mic, ExternalLink, Mail, Newspaper } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { APPEARANCES, type Appearance } from '@/lib/press'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Press & podcasts',
  description:
    'Press, podcasts, and YouTube appearances by Askhat — owner of Happy Cake Sugar Land. Family-owned bakery in Sugar Land, TX.',
  alternates: { canonical: '/press' },
}

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
          <div className="grid gap-6 md:grid-cols-2">
            {videos.map((v) => (
              <article key={v.title} className="bakery-card overflow-hidden">
                <div className="relative aspect-video bg-cocoa-900">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}`}
                    title={v.title}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cocoa-900/55">
                    <Youtube className="h-3.5 w-3.5" />
                    <span>{v.outlet}</span>
                    <span aria-hidden>·</span>
                    <span>{new Date(v.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                  <h3 className="display-h3 mt-2 [text-wrap:balance]">{v.title}</h3>
                  <p className="mt-2 text-sm text-cocoa-900/75 leading-relaxed">{v.description}</p>
                  {v.url && (
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky"
                    >
                      Watch on YouTube <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {press.length > 0 && (
        <section className="container pb-16">
          <Eyebrow>Read</Eyebrow>
          <h2 className="display-h2 mt-2 mb-6">In the press</h2>
          <ul className="grid gap-5">
            {press.map((a) => {
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
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cocoa-900/55 flex-wrap">
                        <span>{TYPE_LABEL[a.type]}</span>
                        <span aria-hidden>·</span>
                        <span>{a.outlet}</span>
                        <span aria-hidden>·</span>
                        <span>{new Date(a.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                      </div>
                      <h2 className="display-h3 mt-1 [text-wrap:balance]">{a.title}</h2>
                      <p className="mt-2 text-cocoa-900/75 leading-relaxed">{a.description}</p>
                    </div>
                    {a.url && <ExternalLink className="h-5 w-5 text-cocoa-900/40 shrink-0" aria-hidden />}
                  </Wrapper>
                </li>
              )
            })}
          </ul>
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
