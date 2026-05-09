import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProduct, listProducts } from '@/lib/api'
import { BRAND, ALLERGEN_LABELS, CATEGORY_LABELS } from '@/lib/brand'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CakePhoto } from '@/components/product/cake-photo'
import { ChevronLeft, MessageSquareHeart, ShoppingBag, Clock, Cake, ShieldCheck } from 'lucide-react'

export const revalidate = 60

type Params = Promise<{ slug: string }>

export async function generateMetadata(props: { params: Params }): Promise<Metadata> {
  const { slug } = await props.params
  const product = await getProduct(slug)
  if (!product) return { title: 'Cake not found' }
  const description = product.description ?? `${product.name} — ${BRAND.tagline}`
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

export default async function ProductDetailPage(props: { params: Params }) {
  const { slug } = await props.params
  const product = await getProduct(slug)
  if (!product) notFound()
  const all = await listProducts()
  const related = all.filter((p) => p.id !== product.id).slice(0, 3)
  const allergens = product.allergens?.split(',').map((a) => a.trim()).filter(Boolean) ?? []

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
        <CakePhoto
          productId={product.id}
          name={product.name}
          src={product.photo_url}
          aspect="portrait"
          priority
          className="md:max-w-[540px]"
        />
        <div>
          <Eyebrow>{CATEGORY_LABELS[product.category] ?? product.category}</Eyebrow>
          <h1 className="display-h1 mt-3 text-[2.4rem] md:text-[3.25rem] leading-[1.05] [text-wrap:balance]">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-4 text-lg text-cocoa-900/80 leading-relaxed max-w-prose">
              {product.description}
            </p>
          )}

          <div className="mt-8 flex items-baseline gap-3">
            <span className="font-display text-4xl text-cocoa-900">{fmtUsd(product.price_cents)}</span>
            {product.in_stock === 0 ? (
              <Badge variant="berry">Sold out today</Badge>
            ) : (
              <Badge variant="sage">In the case today</Badge>
            )}
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
            <Button asChild size="lg">
              <Link href={`/order?product=${product.id}`}>
                <ShoppingBag /> Start an order
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
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <Link
                key={p.id}
                href={`/menu/${p.id}`}
                className="bakery-card p-5 flex items-center gap-4 hover:bg-cream-100 transition-colors"
              >
                <div className="h-16 w-16 shrink-0">
                  <CakePhoto productId={p.id} name={p.name} src={p.photo_url} className="h-16 w-16" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg text-cocoa-900 truncate">{p.name}</div>
                  <div className="text-xs text-cocoa-900/60">{leadTimeLabel(p.lead_time_hours)}</div>
                </div>
                <span className="text-sm font-semibold text-sky-700 shrink-0">{fmtUsd(p.price_cents)}</span>
              </Link>
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
