import type { Metadata } from 'next'
import { Suspense } from 'react'
import { listProducts } from '@/lib/api'
import { BRAND } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'
import { MenuGrid } from '@/components/product/menu-grid'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Menu',
  description:
    'Today\'s HappyCake menu — by-the-slice, whole cakes, pastries, custom orders, and catering. Hand-decorated in our Sugar Land kitchen.',
  alternates: { canonical: '/menu' },
}

export default async function MenuPage() {
  // Server fetch once; the client `MenuGrid` filters in-memory below so chip
  // toggles are instant. URL params are read client-side from the same list,
  // so deep links / share URLs still resolve correctly without a second
  // server round-trip per filter change (the prior /menu route did).
  const all = await listProducts()

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
      {/* Compact hero — search is the actual hero, not a body block. The
          eyebrow + tight headline carry the brand voice in two lines and
          immediately yield to the filter strip. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />
        <div className="container relative pt-10 md:pt-14 pb-4">
          <Eyebrow>Today's menu · {all.length} cakes</Eyebrow>
          <h1 className="display-h2 mt-3 [text-wrap:balance]">
            Find your <span className="text-sky">cake</span>.
          </h1>
        </div>
      </section>

      {/* MenuGrid reads useSearchParams() — must sit inside <Suspense> so
          Next 15 can statically prerender the surrounding page while this
          island hydrates client-side. The fallback reserves a chunk of
          height so the page doesn't jump on hydration. */}
      <Suspense
        fallback={
          <div
            className="container mt-6 mb-16 h-[60vh] rounded-2xl bg-cream-100 animate-pulse"
            aria-hidden
          />
        }
      >
        <MenuGrid products={all} />
      </Suspense>
    </>
  )
}
