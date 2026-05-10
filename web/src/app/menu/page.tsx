import type { Metadata } from 'next'
import Link from 'next/link'
import { listProducts, type Product } from '@/lib/api'
import { BRAND } from '@/lib/brand'
import { KIND_LABELS, KIND_ORDER, type ProductKind } from '@/lib/catalog'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ProductCard } from '@/components/product/product-card'
import { MenuSearch } from '@/components/product/menu-search'
import { MenuKindNav } from '@/components/product/menu-kind-nav'
import { Badge } from '@/components/ui/badge'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Menu',
  description:
    'Today\'s Happy Cake menu — by-the-slice, whole cakes, pastries, custom orders, and catering. Hand-decorated in our Sugar Land kitchen.',
  alternates: { canonical: '/menu' },
}

type SearchParams = Promise<{ q?: string; allergen_free?: string }>

export default async function MenuPage(props: { searchParams?: SearchParams }) {
  const params = (await props.searchParams) ?? {}
  const all = await listProducts()
  const q = (params.q ?? '').trim().toLowerCase()
  const allergenFree = (params.allergen_free ?? '').split(',').filter(Boolean)

  // Filter then group, preserving the canonical kind ordering. Empty kinds are
  // dropped so we don't render a "By the slice" block when nothing matches.
  const filtered = all.filter((p) => {
    if (q) {
      const hay = `${p.name} ${p.description ?? ''} ${p.category}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (allergenFree.length) {
      const has = (p.allergens ?? '').split(',').map((a) => a.trim())
      if (!allergenFree.every((f) => !has.includes(f))) return false
    }
    return true
  })

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: filtered.filter((p) => p.kind === kind),
  })).filter((g) => g.items.length > 0)

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${BRAND.name} menu`,
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />
        <div className="container relative pt-12 md:pt-20 pb-10">
          <Eyebrow>Today's menu</Eyebrow>
          <h1 className="display-h1 mt-4 [text-wrap:balance]">
            Something for <span className="text-sky">every sweet tooth</span>
          </h1>
          <p className="mt-4 text-cocoa-900/75 max-w-xl leading-relaxed">
            Slices ready from the case, whole cakes with about an hour's notice, custom orders
            24 hours ahead. {BRAND.closing}
          </p>
        </div>
      </section>

      <section className="container -mt-2">
        <div className="bakery-card p-4 md:p-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <MenuSearch defaultValue={q} />
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <span className="text-xs text-cocoa-900/55 uppercase tracking-[0.16em]">Free of</span>
            <AllergenChip current={params.allergen_free} value="nuts" label="Nuts" />
            <AllergenChip current={params.allergen_free} value="gluten" label="Gluten" />
            <AllergenChip current={params.allergen_free} value="dairy" label="Dairy" />
            <Link
              href="/dietary"
              className="ml-1 text-xs text-sky-700 hover:text-sky underline-offset-4 hover:underline"
            >
              Full guide →
            </Link>
          </div>
        </div>
      </section>

      <section className="container mt-6">
        <MenuKindNav available={grouped.map((g) => g.kind)} />
      </section>

      <section className="container mt-8 mb-16 space-y-14">
        {grouped.length === 0 ? (
          <MenuEmpty hasFilters={Boolean(q || allergenFree.length)} hasAnyProducts={all.length > 0} />
        ) : (
          grouped.map(({ kind, items }) => (
            <KindSection key={kind} kind={kind} items={items} />
          ))
        )}
      </section>
    </>
  )
}

function KindSection({ kind, items }: { kind: ProductKind; items: Product[] }) {
  const meta = KIND_LABELS[kind]
  return (
    <div id={kind} className="scroll-mt-28">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>{meta.singular}</Eyebrow>
          <h2 className="display-h2 mt-2">{meta.plural}</h2>
          <p className="mt-2 max-w-2xl text-cocoa-900/70 leading-relaxed">{meta.blurb}</p>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-cocoa-900/45">
          {items.length} {items.length === 1 ? 'option' : 'options'}
        </span>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} showKindPill={false} />
        ))}
      </div>
    </div>
  )
}

function MenuEmpty({ hasFilters, hasAnyProducts }: { hasFilters: boolean; hasAnyProducts: boolean }) {
  if (!hasAnyProducts) {
    return (
      <div className="bakery-card p-10 text-center">
        <p className="display-h3 text-xl text-cocoa-900">The case is between bakes.</p>
        <p className="mt-2 text-cocoa-900/70 max-w-md mx-auto">
          We can't reach the kitchen right now. Call us at {BRAND.phone.display} or{' '}
          <Link href="/chat" className="text-sky-700 underline">
            send a message
          </Link>{' '}
          and we'll tell you what's ready.
        </p>
      </div>
    )
  }
  return (
    <div className="bakery-card p-10 text-center">
      <p className="display-h3 text-xl text-cocoa-900">No matches with these filters.</p>
      <p className="mt-2 text-cocoa-900/70">
        {hasFilters ? 'Loosen a filter, or ' : 'Try a different search, or '}
        <Link href="/menu" className="text-sky-700 underline">
          show everything
        </Link>{' '}
        — there's plenty in the case today.
      </p>
    </div>
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
      <Badge variant={active ? 'sage' : 'outline'} className="cursor-pointer px-3 py-1">
        {label}
      </Badge>
    </Link>
  )
}
