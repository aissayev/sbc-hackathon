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
import { ChevronLeft, MessageSquareHeart, ShoppingBag } from 'lucide-react'

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
  const related = all.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 3)

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
      availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: BRAND.name },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'lead_time_hours', value: product.lead_time_hours },
      ...(allergens.length
        ? [{ '@type': 'PropertyValue', name: 'allergens', value: allergens.join(', ') }]
        : []),
      ...(product.daily_capacity
        ? [{ '@type': 'PropertyValue', name: 'daily_capacity', value: product.daily_capacity }]
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
          className="inline-flex items-center text-sm text-happy-700 hover:text-happy-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          All cakes
        </Link>
      </div>
      <article className="container mt-6 grid gap-10 md:grid-cols-2 md:gap-14">
        <CakePhoto productId={product.id} name={product.name} src={product.photo_url} className="md:max-w-[520px]" />
        <div>
          <Eyebrow>{CATEGORY_LABELS[product.category] ?? product.category}</Eyebrow>
          <h1 className="display-h1 mt-3 text-[2.4rem] md:text-[3rem] leading-[1.05]">{product.name}</h1>
          {product.description && (
            <p className="mt-4 text-lg text-happy-900/80 max-w-prose">{product.description}</p>
          )}

          <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-md bg-cream-100 p-4">
              <div className="text-xs text-happy-900/60">Price</div>
              <div className="text-2xl font-medium text-happy-900 mt-1">
                {fmtUsd(product.price_cents)}
              </div>
            </div>
            <div className="rounded-md bg-cream-100 p-4">
              <div className="text-xs text-happy-900/60">Lead time</div>
              <div className="text-base font-medium text-happy-900 mt-1">
                {leadTimeLabel(product.lead_time_hours)}
              </div>
            </div>
            {product.daily_capacity ? (
              <div className="rounded-md bg-cream-100 p-4">
                <div className="text-xs text-happy-900/60">Daily capacity</div>
                <div className="text-base font-medium text-happy-900 mt-1">
                  {product.daily_capacity} per day
                </div>
              </div>
            ) : null}
            <div className="rounded-md bg-cream-100 p-4">
              <div className="text-xs text-happy-900/60">Status</div>
              <div className="text-base font-medium mt-1">
                {product.in_stock === 0 ? (
                  <span className="text-coral">Sold out today</span>
                ) : (
                  <span className="text-sage">In the case today</span>
                )}
              </div>
            </div>
          </div>

          {allergens.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.16em] text-happy-900/60 mb-2">Allergens</p>
              <div className="flex flex-wrap gap-1.5">
                {allergens.map((a) => (
                  <Badge key={a} variant="outline">
                    {ALLERGEN_LABELS[a] ?? a}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-happy-900/60">
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
            <Button asChild size="lg" variant="outline">
              <Link href={`/chat?product=${product.id}`}>
                <MessageSquareHeart /> Ask a question
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-happy-900/60">{BRAND.closing}</p>
        </div>
      </article>

      {related.length > 0 && (
        <section className="container mt-24">
          <h2 className="display-h2">Pairs well with</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <RelatedCard key={p.id} id={p.id} name={p.name} price={p.price_cents} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function RelatedCard({ id, name, price }: { id: string; name: string; price: number }) {
  return (
    <Link
      href={`/menu/${id}`}
      className="rounded-lg border border-happy-700/15 bg-white p-5 hover:bg-cream-100 transition-colors flex items-center justify-between"
    >
      <span className="font-display text-h3">{name}</span>
      <span className="text-sm text-happy-700">{fmtUsd(price)}</span>
    </Link>
  )
}
