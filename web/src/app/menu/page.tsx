import type { Metadata } from 'next'
import Link from 'next/link'
import { listProducts } from '@/lib/api'
import { BRAND, CATEGORY_LABELS } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { Badge } from '@/components/ui/badge'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Menu',
  description:
    'Today\'s HappyCake menu — slices, whole cakes, custom birthday cakes, and catering boxes. Hand-decorated in our Sugar Land kitchen.',
  alternates: { canonical: '/menu' },
}

type SearchParams = Promise<{ category?: string; allergen_free?: string }>

export default async function MenuPage(props: { searchParams?: SearchParams }) {
  const params = (await props.searchParams) ?? {}
  const all = await listProducts()
  const categories = Array.from(new Set(all.map((p) => p.category)))

  let visible = all
  if (params.category) visible = visible.filter((p) => p.category === params.category)
  if (params.allergen_free) {
    const free = params.allergen_free.split(',')
    visible = visible.filter((p) => {
      const has = (p.allergens ?? '').split(',').map((a) => a.trim())
      return free.every((f) => !has.includes(f))
    })
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'HappyCake menu',
    itemListElement: all.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BRAND.origin}/menu/${p.id}`,
      name: p.name,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <section className="container pt-12 md:pt-16">
        <Eyebrow>Today's menu</Eyebrow>
        <h1 className="display-h1 mt-3">What's in the case</h1>
        <p className="mt-3 text-happy-900/80 max-w-xl">
          Slices ready from the case, whole cakes with about an hour's notice, custom orders
          24 hours ahead. {BRAND.closing}
        </p>
      </section>

      <section className="container mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip current={params.category} />
          {categories.map((c) => (
            <CategoryChip key={c} current={params.category} value={c} />
          ))}
          <span className="mx-2 text-happy-900/30">·</span>
          <AllergenChip current={params.allergen_free} value="nuts" label="No nuts" />
          <AllergenChip current={params.allergen_free} value="gluten" label="Gluten-free" />
          <AllergenChip current={params.allergen_free} value="dairy" label="No dairy" />
        </div>
      </section>

      <section className="container mt-8">
        {visible.length === 0 ? (
          <div className="rounded-lg bg-cream-100 p-10 text-center text-happy-900/70">
            Nothing matches that filter today. Try a different option, or{' '}
            <Link href="/chat" className="text-happy-700 underline">
              ask us in chat
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function CategoryChip({ value, current }: { value?: string; current?: string }) {
  const label = value ? CATEGORY_LABELS[value] ?? value : 'All'
  const active = (value ?? null) === (current ?? null)
  const href = value ? `/menu?category=${value}` : '/menu'
  return (
    <Link href={href}>
      <Badge variant={active ? 'blue' : 'outline'} className="cursor-pointer">
        {label}
      </Badge>
    </Link>
  )
}

function AllergenChip({ value, label, current }: { value: string; label: string; current?: string }) {
  const active = (current ?? '').split(',').includes(value)
  const params = new URLSearchParams()
  const next = active ? '' : value
  if (next) params.set('allergen_free', next)
  const href = '/menu' + (params.toString() ? `?${params}` : '')
  return (
    <Link href={href}>
      <Badge variant={active ? 'sage' : 'outline'} className="cursor-pointer">
        {label}
      </Badge>
    </Link>
  )
}
