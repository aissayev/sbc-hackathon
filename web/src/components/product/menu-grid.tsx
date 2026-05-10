'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, Sparkles, ChevronRight } from 'lucide-react'
import type { Product } from '@/lib/api'
import { KIND_LABELS, KIND_ORDER, type ProductKind } from '@/lib/catalog'
import { ProductCard } from './product-card'
import { cn } from '@/lib/utils'

// Single client component owning ALL menu filtering. Products come in
// pre-fetched (server component); we filter in-memory so chip toggles are
// instant — no router round-trip, no skeleton flash. URL is mirrored via
// `replaceState` so links stay shareable.

const ALLERGEN_FILTERS = [
  { value: 'nuts', label: 'No nuts' },
  { value: 'gluten', label: 'No gluten' },
  { value: 'dairy', label: 'No dairy' },
  { value: 'eggs', label: 'No eggs' },
] as const

type AllergenValue = (typeof ALLERGEN_FILTERS)[number]['value']

export function MenuGrid({ products }: { products: Product[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initial state seeded from URL so refresh / direct links work.
  const [query, setQuery] = React.useState(() => searchParams.get('q') ?? '')
  const [activeKind, setActiveKind] = React.useState<ProductKind | 'all'>(() => {
    const k = searchParams.get('kind')
    return k && (KIND_ORDER as string[]).includes(k) ? (k as ProductKind) : 'all'
  })
  const [allergenFree, setAllergenFree] = React.useState<Set<AllergenValue>>(() => {
    const csv = searchParams.get('allergen_free') ?? ''
    return new Set(
      csv
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is AllergenValue =>
          ALLERGEN_FILTERS.some((f) => f.value === s),
        ),
    )
  })

  // Mirror filters into the URL (no scroll, no nav). Lets the user share a
  // filtered view without forcing a server round-trip per change.
  React.useEffect(() => {
    const sp = new URLSearchParams()
    if (query.trim()) sp.set('q', query.trim())
    if (activeKind !== 'all') sp.set('kind', activeKind)
    if (allergenFree.size) sp.set('allergen_free', Array.from(allergenFree).join(','))
    const qs = sp.toString()
    const next = qs ? `${pathname}?${qs}` : pathname
    window.history.replaceState(null, '', next)
    // router not used here — we deliberately skip navigation so filtering
    // stays instant. The server component re-renders only on full nav.
    void router
  }, [query, activeKind, allergenFree, pathname, router])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (activeKind !== 'all' && p.kind !== activeKind) return false
      if (q) {
        const hay = `${p.name} ${p.description ?? ''} ${p.flavor_notes ?? ''} ${p.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (allergenFree.size) {
        const has = new Set((p.allergens ?? '').split(',').map((a) => a.trim()))
        for (const f of allergenFree) if (has.has(f)) return false
      }
      return true
    })
  }, [products, query, activeKind, allergenFree])

  const availableKinds = React.useMemo(() => {
    const present = new Set(products.map((p) => p.kind))
    return KIND_ORDER.filter((k) => present.has(k))
  }, [products])

  function toggleAllergen(value: AllergenValue) {
    setAllergenFree((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const hasActiveFilters = query.trim() || activeKind !== 'all' || allergenFree.size > 0

  return (
    <>
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        activeKind={activeKind}
        onKindChange={setActiveKind}
        availableKinds={availableKinds}
        allergenFree={allergenFree}
        onAllergenToggle={toggleAllergen}
        onClear={() => {
          setQuery('')
          setActiveKind('all')
          setAllergenFree(new Set())
        }}
        hasActiveFilters={Boolean(hasActiveFilters)}
        resultCount={filtered.length}
      />

      <section className="container mt-8 mb-16">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ResultsGrid products={filtered} />
        )}
      </section>
    </>
  )
}

function FilterBar({
  query,
  onQueryChange,
  activeKind,
  onKindChange,
  availableKinds,
  allergenFree,
  onAllergenToggle,
  onClear,
  hasActiveFilters,
  resultCount,
}: {
  query: string
  onQueryChange: (q: string) => void
  activeKind: ProductKind | 'all'
  onKindChange: (k: ProductKind | 'all') => void
  availableKinds: ProductKind[]
  allergenFree: Set<AllergenValue>
  onAllergenToggle: (v: AllergenValue) => void
  onClear: () => void
  hasActiveFilters: boolean
  resultCount: number
}) {
  return (
    <section className="container">
      {/* Big search input — the visual focus. Auto-focused on tablet+ since
          /menu's job is to find a cake. */}
      <div className="bakery-card p-3 md:p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-cocoa-900/40" aria-hidden />
          <input
            type="search"
            placeholder="Search cakes — honey, pistachio, gluten-free…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="h-12 w-full rounded-full bg-cream-50 border border-cocoa-700/10 pl-12 pr-12 text-base placeholder:text-cocoa-900/40 focus:outline-none focus:ring-2 focus:ring-sky/40"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-cocoa-900/55 hover:bg-cream-100 inline-flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type chips — replaces the separate kind-nav. Single bar reads:
            type · dietary · custom CTA. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-cocoa-900/55 font-medium pr-1">
            Type
          </span>
          <Chip
            active={activeKind === 'all'}
            onClick={() => onKindChange('all')}
          >
            All
          </Chip>
          {availableKinds.map((kind) => (
            <Chip
              key={kind}
              active={activeKind === kind}
              onClick={() => onKindChange(kind)}
            >
              {KIND_LABELS[kind].plural}
            </Chip>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-cocoa-900/55 font-medium pr-1">
            Free of
          </span>
          {ALLERGEN_FILTERS.map((f) => (
            <Chip
              key={f.value}
              active={allergenFree.has(f.value)}
              tone="sage"
              onClick={() => onAllergenToggle(f.value)}
            >
              {f.label}
            </Chip>
          ))}
          <Link
            href="/dietary"
            className="ml-auto text-xs text-sky-700 hover:text-sky underline-offset-4 hover:underline"
          >
            Full guide →
          </Link>
        </div>
      </div>

      {/* Result row + custom-cake CTA. Always visible — reading the count is
          the affordance that filters are working. */}
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-cocoa-900/65">
          <span className="font-semibold text-cocoa-900">{resultCount}</span>{' '}
          {resultCount === 1 ? 'cake' : 'cakes'}
          {hasActiveFilters && (
            <>
              {' · '}
              <button
                type="button"
                onClick={onClear}
                className="text-sky-700 hover:text-sky underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </>
          )}
        </p>
        <Link
          href="/order/custom"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-cocoa-900 text-cream text-sm font-medium hover:bg-cocoa-700 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Custom cake
          <ChevronRight className="h-4 w-4 -mr-1" />
        </Link>
      </div>
    </section>
  )
}

function Chip({
  children,
  active,
  onClick,
  tone = 'sky',
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  tone?: 'sky' | 'sage'
}) {
  const activeCls =
    tone === 'sage'
      ? 'bg-emerald-600 text-white ring-emerald-700'
      : 'bg-cocoa-900 text-cream ring-cocoa-900'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center h-8 px-3.5 rounded-full text-xs font-medium ring-1 transition-all',
        active
          ? activeCls
          : 'bg-bakery text-cocoa-900/80 ring-cocoa-700/15 hover:bg-cream-50 hover:text-cocoa-900',
      )}
    >
      {children}
    </button>
  )
}

function ResultsGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} variant="dense" showKindPill={false} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bakery-card p-10 text-center">
      <p className="display-h3 text-xl text-cocoa-900">No matches with these filters.</p>
      <p className="mt-2 text-cocoa-900/70">
        Loosen a filter, or{' '}
        <Link href="/order/custom" className="text-sky-700 underline">
          describe a custom cake
        </Link>{' '}
        — Askhat quotes within the day.
      </p>
    </div>
  )
}
