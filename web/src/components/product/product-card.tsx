import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { Product } from '@/lib/api'
import { fmtUsd } from '@/lib/format'
import { CATEGORY_LABELS } from '@/lib/brand'
import { KIND_LABELS, type ProductKind } from '@/lib/catalog'
import { CakePhoto } from './cake-photo'
import { cn } from '@/lib/utils'

// Three card variants:
//   default    — square photo on top, full info card. Used in /menu grids.
//   featured   — taller photo with the title overlaid. Use sparingly: home
//                hero specialty, "today's pick", first item in a kind row.
//   compact    — horizontal row (photo left, name + price right). Used in
//                related-products lists and the order-confirmation summary.
//
// `showKindPill` is opt-out for surfaces where the section header already
// names the kind (e.g. /menu's "By the slice" heading sits above 4 cards
// each labelled "Slice" — pure noise). Defaults to true so home + /chat
// pickers, where cards mix kinds, keep the affordance.

type Variant = 'default' | 'featured' | 'compact'

export function ProductCard({
  product,
  variant = 'default',
  showKindPill = true,
  className,
}: {
  product: Product
  variant?: Variant
  showKindPill?: boolean
  className?: string
}) {
  if (variant === 'compact') return <CompactCard product={product} className={className} />
  if (variant === 'featured') return <FeaturedCard product={product} className={className} />
  return <DefaultCard product={product} showKindPill={showKindPill} className={className} />
}

// Translates lead-time + kind into a single customer-facing status. The
// agent prompt teaches concierge to use the same plain-English wording when
// it cites availability, so the card and the chat reply line up.
function statusFor(product: Product): { text: string; tone: 'sage' | 'sky' | 'cocoa' } {
  if (product.kind === 'custom') {
    return { text: 'Designed with you · 24h', tone: 'cocoa' }
  }
  if (product.kind === 'catering') {
    return { text: 'Order 3h+ ahead', tone: 'cocoa' }
  }
  if (product.kind === 'whole') {
    return { text: 'Ready in ~1 hour', tone: 'sky' }
  }
  // slice + pastry → "ready in the case" if lead is short, else generic
  if ((product.lead_time_hours ?? 0) <= 1) {
    return { text: 'Ready in the case', tone: 'sage' }
  }
  return { text: `Ready in ~${product.lead_time_hours}h`, tone: 'sky' }
}

const STATUS_PILL: Record<'sage' | 'sky' | 'cocoa', string> = {
  sage: 'bg-sage/30 text-emerald-800',
  sky: 'bg-sky/15 text-sky-800',
  cocoa: 'bg-cocoa-700/10 text-cocoa-900',
}

function StatusPill({ status }: { status: ReturnType<typeof statusFor> }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
        STATUS_PILL[status.tone],
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full mr-1.5',
          status.tone === 'sage' && 'bg-emerald-600',
          status.tone === 'sky' && 'bg-sky-700',
          status.tone === 'cocoa' && 'bg-cocoa-900',
        )}
        aria-hidden
      />
      {status.text}
    </span>
  )
}

function kindLabelOf(product: Product): string {
  return (
    KIND_LABELS[product.kind as ProductKind]?.singular ??
    CATEGORY_LABELS[product.category] ??
    product.category
  )
}

function DefaultCard({
  product,
  showKindPill,
  className,
}: {
  product: Product
  showKindPill: boolean
  className?: string
}) {
  const allergens = product.allergens?.split(',').map((a) => a.trim()).filter(Boolean) ?? []
  const kindLabel = kindLabelOf(product)
  const status = statusFor(product)
  return (
    <Link
      href={`/menu/${product.id}`}
      className={cn(
        'group flex flex-col overflow-hidden bakery-card transition-all duration-200',
        'hover:-translate-y-0.5 active:scale-[0.99]',
        className,
      )}
    >
      <div className="relative">
        <CakePhoto
          productId={product.id}
          name={`${product.name} — ${kindLabel} from Happy Cake`}
          src={product.photo_url}
          // Card already rounds the top via overflow-hidden; the inner photo
          // wrapping with its own radius created a faint double-rounded edge.
          className="!rounded-none"
        />
        {showKindPill && (
          <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-cocoa-900 shadow-sm">
            {kindLabel}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        {/* Caption line: price as a quiet supporting fact, not a competing
            headline. Reads with the title beneath it. */}
        <div className="text-xs uppercase tracking-[0.14em] text-cocoa-900/55 flex items-center gap-2">
          <span className="font-medium text-cocoa-900/80 normal-case tracking-normal text-sm">
            {fmtUsd(product.price_cents)}
          </span>
          {product.kind === 'whole' && <span aria-hidden>·</span>}
          {product.kind === 'whole' && <span>per cake</span>}
        </div>
        <h3 className="display-h3 group-hover:text-sky-700 transition-colors leading-tight">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm text-cocoa-900/70 leading-relaxed line-clamp-2">
            {product.description}
          </p>
        )}
        {allergens.length > 0 && (
          <p className="text-[11px] text-cocoa-900/55 leading-relaxed">
            contains {allergens.join(' · ')}
          </p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between gap-3">
          <StatusPill status={status} />
          <span className="inline-flex items-center gap-1 text-xs font-medium text-cocoa-900/55 group-hover:text-sky-700 transition-colors">
            See details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function FeaturedCard({ product, className }: { product: Product; className?: string }) {
  const kindLabel = kindLabelOf(product)
  const status = statusFor(product)
  return (
    <Link
      href={`/menu/${product.id}`}
      className={cn(
        'group relative block overflow-hidden rounded-3xl bg-cocoa-900 text-cream shadow-lift',
        'transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99]',
        className,
      )}
    >
      <div className="relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]">
        <CakePhoto
          productId={product.id}
          name={`${product.name} — ${kindLabel} signature from Happy Cake`}
          src={product.photo_url}
          aspect="square"
          className="!aspect-auto !rounded-none absolute inset-0 h-full w-full"
        />
        {/* Deeper bottom gradient so the title is always legible regardless
            of what's in the photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-cocoa-900/95 via-cocoa-900/40 to-transparent" aria-hidden />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-cocoa-900">
            Today&apos;s pick · {kindLabel}
          </span>
          <span className="rounded-full bg-cream/95 px-3 py-1 text-sm font-semibold text-cocoa-900">
            {fmtUsd(product.price_cents)}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="font-display text-3xl md:text-4xl leading-tight [text-wrap:balance]">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-2 text-cream/85 leading-relaxed line-clamp-2 max-w-md">
              {product.description}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <StatusPill status={status} />
            <span className="inline-flex items-center gap-1 text-sm text-cream/85 group-hover:text-cream">
              See details
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function CompactCard({ product, className }: { product: Product; className?: string }) {
  const kindLabel = kindLabelOf(product)
  const status = statusFor(product)
  return (
    <Link
      href={`/menu/${product.id}`}
      className={cn(
        'group bakery-card flex items-center gap-4 p-4 hover:bg-cream-100 transition-colors',
        className,
      )}
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-cream-100">
        <CakePhoto
          productId={product.id}
          name={`${product.name} — ${kindLabel} from Happy Cake`}
          src={product.photo_url}
          aspect="square"
          className="!aspect-square !rounded-none h-16 w-16"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-cocoa-900/55">
          {kindLabel}
        </div>
        <div className="font-display text-lg text-cocoa-900 group-hover:text-sky-700 transition-colors truncate">
          {product.name}
        </div>
        <div className="mt-1">
          <StatusPill status={status} />
        </div>
      </div>
      <span className="text-sm font-semibold text-sky-700 shrink-0">{fmtUsd(product.price_cents)}</span>
    </Link>
  )
}
