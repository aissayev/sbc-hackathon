'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import type { Product } from '@/lib/api'
import { ProductCard } from '@/components/product/product-card'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'

// Home page "No two cakes the same" row.
//
// Two design moves over the previous pickByKind approach:
//
// 1. **Diversify by tradition.** pickByKind was returning Honey Cake (slice)
//    + Whole Honey Cake (whole) side-by-side because they're different
//    kinds but the same recipe — visually redundant. We now pick one cake
//    per tradition (Kazakh-European honey, Modern meringue, Italian
//    classic, Central Asian, French chocolate, Celebration, Catering),
//    so the first 4 you see are always 4 different cakes.
//
// 2. **Show more, in place.** Initial row is 4. Tapping "Show 4 more" reveals
//    the next batch inline rather than punting the user to /menu, while
//    "See the full menu" stays as the secondary anchor.
//
// Out-of-stock items are still surfaced (not filtered out) so customers can
// see what's coming back tomorrow — the card itself shows the "Out today"
// state via the showcase variant.

const INITIAL = 4
const STEP = 4

function pickDiverse(products: Product[]): Product[] {
  const seenTraditions = new Set<string>()
  const first: Product[] = []
  const rest: Product[] = []
  for (const p of products) {
    const t = p.tradition ?? '_unknown'
    if (!seenTraditions.has(t)) {
      seenTraditions.add(t)
      first.push(p)
    } else {
      rest.push(p)
    }
  }
  // first = one per tradition (in catalog order); rest = the duplicates
  // (e.g. Whole Honey Cake after Honey Cake). Concat so "show more" reveals
  // the variants of traditions you've already seen.
  return [...first, ...rest]
}

export function ShowcaseRow({ products }: { products: Product[] }) {
  const ordered = React.useMemo(() => pickDiverse(products), [products])
  const [count, setCount] = React.useState(INITIAL)
  const visible = ordered.slice(0, count)
  const hasMore = count < ordered.length

  return (
    <section className="container mt-24" aria-labelledby="showcase-heading">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-3">
        <div>
          <Eyebrow>Today&apos;s bake</Eyebrow>
          <h2 id="showcase-heading" className="display-h2 mt-3">
            No two cakes the same
          </h2>
          <p className="mt-2 text-cocoa-900/70 max-w-xl">
            Every cake comes from a different tradition — Kazakh honey, modern meringue, Italian
            classic, French chocolate. Worth trying all of them.
          </p>
        </div>
        <Button asChild variant="outline-sky" shape="pill" size="default">
          <Link href="/menu">
            See the full menu
            <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} variant="showcase" />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(c + STEP, ordered.length))}
            className="inline-flex items-center gap-2 rounded-full bg-cream-100 hover:bg-cream-200 px-5 h-11 text-sm font-medium text-cocoa-900 border border-cocoa-700/15 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Show {Math.min(STEP, ordered.length - count)} more
          </button>
        </div>
      )}
    </section>
  )
}
