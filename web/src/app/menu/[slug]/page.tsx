import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProduct, listProducts, type Product } from '@/lib/api'
import { BRAND, ALLERGEN_LABELS, CATEGORY_LABELS } from '@/lib/brand'
import { KIND_LABELS, TRADITION_LABELS } from '@/lib/catalog'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CakePhoto } from '@/components/product/cake-photo'
import {
  ProductCard,
  StatusPill,
  TRADITION_THEME,
  statusFor,
} from '@/components/product/product-card'
import { ChevronLeft, MessageSquareHeart, ShoppingBag, Clock, Cake, ShieldCheck, Quote } from 'lucide-react'

export const revalidate = 60

type Params = Promise<{ slug: string }>

export async function generateMetadata(props: { params: Params }): Promise<Metadata> {
  const { slug } = await props.params
  const product = await getProduct(slug)
  if (!product) return { title: 'Cake not found' }
  const description = product.tagline ?? product.description ?? `${product.name} — ${BRAND.tagline}`
  return {
    title: product.name,
    description,
    alternates: { canonical: `/menu/${product.id}` },
    openGraph: {
      title: `${product.name} · ${BRAND.name}`,
      description,
      images: product.photo_url ? [product.photo_url] : undefined,
    },
  }
}

// Pick related products that *contrast* with the current cake — different
// tradition first, falling back to other items in the catalog. Avoids the
// previous behaviour of returning the next 3 alphabetical items, which on
// the Honey Cake page meant "you might also like the same cake whole".
function pickRelated(current: Product, all: Product[]): Product[] {
  const others = all.filter((p) => p.id !== current.id)
  const seen = new Set<string>()
  if (current.tradition) seen.add(current.tradition)
  const diverse = others.filter((p) => {
    const t = p.tradition ?? '_unknown'
    if (seen.has(t)) return false
    seen.add(t)
    return true
  })
  // Top up to 3 with same-tradition siblings if we ran out of distinct ones.
  const remaining = others.filter((p) => !diverse.includes(p))
  return [...diverse, ...remaining].slice(0, 3)
}

export default async function ProductDetailPage(props: { params: Params }) {
  const { slug } = await props.params
  const product = await getProduct(slug)
  if (!product) notFound()
  const all = await listProducts({ includeOutOfStock: true })
  const related = pickRelated(product, all)
  const allergens = product.allergens?.split(',').map((a) => a.trim()).filter(Boolean) ?? []
  const status = statusFor(product)
  const tradition = product.tradition
  const traditionTheme = tradition ? TRADITION_THEME[tradition] : undefined
  const traditionLabel = tradition ? TRADITION_LABELS[tradition].label : null
  const oos = !product.in_stock

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${BRAND.origin}/menu/${product.id}`,
    name: product.name,
    description: product.description ?? undefined,
    sku: product.id,
    image: product.photo_url ? [`${BRAND.origin}${product.photo_url}`] : undefined,
    brand: { '@type': 'Brand', name: BRAND.name },
    category: CATEGORY_LABELS[product.category] ?? product.category,
    offers: {
      '@type': 'Offer',
      url: `${BRAND.origin}/menu/${product.id}`,
      priceCurrency: 'USD',
      price: (product.price_cents / 100).toFixed(2),
      availability:
        product.in_stock !== 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: BRAND.name },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'lead_time_hours', value: product.lead_time_hours },
      ...(allergens.length
        ? [{ '@type': 'PropertyValue', name: 'allergens', value: allergens.join(', ') }]
        : []),
      ...(tradition ? [{ '@type': 'PropertyValue', name: 'tradition', value: traditionLabel ?? tradition }] : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className="container pt-8">
        <Link
          href="/menu"
          className="inline-flex items-center text-sm text-sky-700 hover:text-sky transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          All cakes
        </Link>
      </div>
      <article className="container mt-6 grid gap-10 md:grid-cols-2 md:gap-14 pb-12">
        <div className="relative">
          <CakePhoto
            productId={product.id}
            name={product.name}
            src={product.photo_url}
            aspect="portrait"
            priority
            className="md:max-w-[540px]"
          />
          {oos && (
            <span className="absolute top-4 left-4 inline-flex items-center rounded-full bg-cream/95 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-berry shadow-sm ring-1 ring-berry/30">
              Out today
            </span>
          )}
        </div>
        <div>
          {/* Header row: tradition chip + kind eyebrow. The chip carries the
              same colour the showcase card on the home page used, so the
              detail page reads as the card "expanded". */}
          <div className="flex items-center gap-3 flex-wrap">
            {tradition && traditionTheme && (
              <span
                className={
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ' +
                  traditionTheme.chip
                }
              >
                {TRADITION_LABELS[tradition].short}
              </span>
            )}
            <Eyebrow decorator={false}>
              {KIND_LABELS[product.kind]?.singular ?? CATEGORY_LABELS[product.category] ?? product.category}
            </Eyebrow>
          </div>

          <h1 className="display-h1 mt-3 text-[2.4rem] md:text-[3.25rem] leading-[1.05] [text-wrap:balance]">
            {product.name}
          </h1>

          {/* Flavor stack — same small-caps spec line as the showcase card.
              Lets the eye scan the build before reading the prose. */}
          {product.flavor_notes && (
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-cocoa-900/65 leading-relaxed">
              {product.flavor_notes}
            </p>
          )}

          {/* Tagline as a quiet pull-quote when present; otherwise the
              full description carries on. Together with the flavor stack
              this gives the page three layers of how-to-feel-about-the-cake:
              spec → tagline → description. */}
          {product.tagline && (
            <blockquote className="mt-5 inline-flex items-start gap-2 text-cocoa-900 text-lg italic leading-relaxed max-w-prose">
              <Quote className="h-4 w-4 text-sky-700/70 mt-1.5 shrink-0" aria-hidden />
              <span>{product.tagline}</span>
            </blockquote>
          )}
          {product.description && (
            <p className="mt-5 text-base text-cocoa-900/80 leading-relaxed max-w-prose">
              {product.description}
            </p>
          )}

          <div className="mt-8 flex items-baseline gap-3 flex-wrap">
            <span className="font-display text-4xl text-cocoa-900">{fmtUsd(product.price_cents)}</span>
            <StatusPill status={status} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 max-w-md">
            <Stat
              icon={Clock}
              label="Lead time"
              value={leadTimeLabel(product.lead_time_hours)}
            />
            <Stat
              icon={Cake}
              label={product.daily_capacity ? 'Daily capacity' : 'Made fresh'}
              value={product.daily_capacity ? `${product.daily_capacity} per day` : 'Every morning'}
            />
          </dl>

          {allergens.length > 0 && (
            <div className="mt-7">
              <Eyebrow decorator={false}>Allergens</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allergens.map((a) => (
                  <Badge key={a} variant="outline">
                    {ALLERGEN_LABELS[a] ?? a}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-cocoa-900/55 leading-relaxed inline-flex items-start gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces.{' '}
                <Link href="/policies" className="underline">
                  Read more
                </Link>
                .
              </p>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" disabled={oos}>
              <Link href={`/order?product=${product.id}`}>
                <ShoppingBag /> {oos ? 'Out today — back tomorrow' : 'Start an order'}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline-sky">
              <Link href={`/chat?product=${product.id}`}>
                <MessageSquareHeart /> Ask a question
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-cocoa-900/65">
            Want this with a different flavor or as a custom build?{' '}
            <Link href="/order/custom" className="text-sky-700 underline-offset-4 hover:underline font-medium">
              Design a custom cake →
            </Link>
          </p>
          <p className="mt-3 text-sm text-cocoa-900/65">{BRAND.closing}</p>
        </div>
      </article>

      {related.length > 0 && (
        <section className="container mt-16 mb-16">
          <Eyebrow>You might also like</Eyebrow>
          <h2 className="display-h2 mt-3">Pairs well with</h2>
          {/* Showcase variant so the related row reads consistently with the
              home page — tradition chip, flavor stack, status pill. We ask
              for 3 distinct traditions where possible (see pickRelated). */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} variant="showcase" />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream-100 p-4 border border-cocoa-700/8">
      <div className="flex items-center gap-2 text-cocoa-900/60">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="text-base font-medium text-cocoa-900 mt-1.5">{value}</div>
    </div>
  )
}
