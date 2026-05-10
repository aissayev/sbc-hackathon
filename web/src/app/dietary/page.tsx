import type { Metadata } from 'next'
import Link from 'next/link'
import { listProducts } from '@/lib/api'
import { BRAND } from '@/lib/brand'
import { DIETARY_TAGS, DIETARY_FAQ, dietaryHref } from '@/lib/dietary'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, MessageSquareHeart, Phone, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Dietary options',
  description:
    'Gluten-free, nut-free, dairy-free, vegan, and halal-friendly cakes from HappyCake Sugar Land. Filtered menu views, plain-English allergen disclaimer.',
  alternates: { canonical: '/dietary' },
}

// Count how many in-stock products match each dietary tag's exclusion list.
// `halal` has empty excludes — we render an "ask us" CTA for it instead of a count.
function countMatches(productAllergens: string[], excludes: string[]): boolean {
  return excludes.every((e) => !productAllergens.includes(e))
}

export default async function DietaryPage() {
  const products = await listProducts()

  const tagCounts = DIETARY_TAGS.map((tag) => {
    if (tag.excludes.length === 0) return { tag, count: -1 } // sentinel for "ask us"
    const count = products.filter((p) => {
      const allergens = (p.allergens ?? '').split(',').map((a) => a.trim()).filter(Boolean)
      return countMatches(allergens, tag.excludes)
    }).length
    return { tag, count }
  })

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: DIETARY_FAQ.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />
        <div className="container relative pt-12 md:pt-20 pb-10 max-w-3xl">
          <Eyebrow>Dietary options</Eyebrow>
          <h1 className="display-h1 mt-4 [text-wrap:balance]">
            Cake for <span className="text-sky">every kitchen</span>.
          </h1>
          <p className="mt-5 text-lg text-cocoa-900/80 leading-relaxed">
            Gluten-free, nut-free, dairy-free, vegan, halal-friendly. Pick a tag below to see what
            we have today, or message us if your needs are specific — we'd rather ask than guess.
          </p>
        </div>
      </section>

      <section className="container mt-4">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tagCounts.map(({ tag, count }) => {
            const Icon = tag.icon
            return (
              <article
                key={tag.slug}
                id={tag.slug}
                className="bakery-card p-6 flex flex-col"
              >
                <div className={cn('h-11 w-11 rounded-full inline-flex items-center justify-center', tag.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="display-h3 text-xl mt-4">{tag.label}</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-cocoa-900/55">{tag.short}</p>
                <p className="mt-3 text-sm text-cocoa-900/75 leading-relaxed flex-1">{tag.body}</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  {count === -1 ? (
                    <Badge variant="sky">Ask us when you order</Badge>
                  ) : count === 0 ? (
                    <Badge variant="outline">None today — ask us</Badge>
                  ) : (
                    <Badge variant="sky">
                      {count} {count === 1 ? 'cake' : 'cakes'} in the case
                    </Badge>
                  )}
                  {tag.excludes.length > 0 ? (
                    <Link
                      href={dietaryHref(tag.slug)}
                      className="inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky font-medium"
                    >
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <Link
                      href="/chat"
                      className="inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky font-medium"
                    >
                      Chat <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="container mt-16">
        <div className="rounded-2xl border border-cocoa-700/15 bg-cream-100 p-7 md:p-9 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-full bg-cocoa-700 text-cream inline-flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="display-h3 text-xl">Shared-kitchen disclaimer</h2>
              <p className="mt-2 text-cocoa-900/85 leading-relaxed">
                Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces. Every
                cake we make has at least one of these. <strong>If you have a severe allergy,
                message us first</strong> and we'll talk you through what we can and can't do
                safely. We bake cleanly — new gloves, dedicated parchment, separate mixing bowls —
                but we don't claim cross-contamination is zero.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="default" size="sm">
                  <Link href="/chat">
                    <MessageSquareHeart /> Ask us first
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={BRAND.phone.hrefTel}>
                    <Phone /> {BRAND.phone.display}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-16 max-w-3xl">
        <Eyebrow>Common questions</Eyebrow>
        <h2 className="display-h2 mt-3">What customers ask us</h2>
        <div className="mt-6 divide-y divide-cocoa-700/10 rounded-2xl border border-cocoa-700/10 bg-bakery">
          {DIETARY_FAQ.map((q) => (
            <details key={q.q} className="group p-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <span className="font-medium text-cocoa-900">{q.q}</span>
                <span className="text-sky-700 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-cocoa-900/80 text-sm leading-relaxed">{q.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mt-20 mb-20">
        <div className="rounded-[28px] bg-cocoa-900 text-cream p-10 md:p-14 relative overflow-hidden max-w-5xl mx-auto">
          <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
          <div className="relative max-w-2xl">
            <Eyebrow className="text-sky-200">When in doubt</Eyebrow>
            <p className="font-display text-3xl md:text-4xl mt-3 leading-tight [text-wrap:balance]">
              Ask us before you order — we'd rather get it right.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="sky">
                <Link href="/chat">Chat with us</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-cream hover:bg-cream/10"
              >
                <a href={BRAND.phone.hrefTel}>{BRAND.phone.display}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
