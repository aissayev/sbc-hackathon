import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { Product } from '@/lib/api'
import { fmtUsd } from '@/lib/format'
import { CATEGORY_LABELS } from '@/lib/brand'
import { KIND_LABELS, TRADITION_LABELS, type ProductKind } from '@/lib/catalog'
import { CakePhoto } from './cake-photo'
import { cn } from '@/lib/utils'

// Five card variants:
//   default    — square photo on top, full info card. Used on the home
//                "One of each" row when the visitor hasn't seen the catalog.
//   dense      — same skeleton as default but trimmer: 4:3 photo, no
//                description block, no kind pill, smaller padding. Used on
//                /menu where four cards per row beats two; the visitor is
//                in scan-mode, not read-mode.
//   featured   — taller photo with the title overlaid. Use sparingly: home
//                hero specialty, "today's pick", first item in a kind row.
//   compact    — horizontal row (photo left, name + price right). Used in
//                related-products lists and the order-confirmation summary.
//   showcase   — Pokémon-style collectible: tradition chip, hero photo,
//                title, flavor stack ("honey biscuit · custard · walnuts"),
//                evocative tagline, status pill + CTA. Themed accent colour
//                from the cake's `tradition`. Used on the home `One of each`
//                row so each cake reads as genuinely unique.
//
// `showKindPill` is opt-out for surfaces where the section header already
// names the kind (e.g. /menu's "By the slice" heading sits above 4 cards
// each labelled "Slice" — pure noise). Defaults to true so home + /chat
// pickers, where cards mix kinds, keep the affordance.

type Variant = 'default' | 'dense' | 'featured' | 'compact' | 'showcase'

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
  if (variant === 'showcase') return <ShowcaseCard product={product} className={className} />
  if (variant === 'dense') return <DenseCard product={product} className={className} />
  return <DefaultCard product={product} showKindPill={showKindPill} className={className} />
}

// Per-tradition accent: a cream-side card surface, a coloured chip, and a
// faint top-edge stripe so each card carries its family's identity without
// shouting. Kept subtle (low opacity) so the row still reads as a coherent
// set rather than a clown parade of colours. Exported so the product
// detail page can reuse the same theme map for its tradition pill +
// background tint without re-deriving the palette.
export const TRADITION_THEME: Record<
  NonNullable<Product['tradition']>,
  { chip: string; stripe: string; bgTint: string }
> = {
  'kazakh-european-honey': {
    chip: 'bg-amber-100 text-amber-900 ring-amber-300/60',
    stripe: 'from-amber-300/70 via-amber-200/50 to-cream',
    bgTint: 'from-amber-50/40',
  },
  'central-asian': {
    chip: 'bg-orange-100 text-orange-900 ring-orange-300/60',
    stripe: 'from-orange-300/70 via-orange-200/50 to-cream',
    bgTint: 'from-orange-50/40',
  },
  'italian-classic': {
    chip: 'bg-cocoa-700/15 text-cocoa-900 ring-cocoa-700/25',
    stripe: 'from-cocoa-700/35 via-cocoa-700/15 to-cream',
    bgTint: 'from-cocoa-700/5',
  },
  'modern-meringue': {
    chip: 'bg-sky/15 text-sky-800 ring-sky-300/60',
    stripe: 'from-sky/40 via-sky/15 to-cream',
    bgTint: 'from-sky-50/50',
  },
  'french-chocolate': {
    chip: 'bg-cocoa-900/15 text-cocoa-900 ring-cocoa-900/25',
    stripe: 'from-cocoa-900/45 via-cocoa-900/20 to-cream',
    bgTint: 'from-cocoa-900/5',
  },
  'celebration': {
    chip: 'bg-berry/15 text-berry ring-berry/30',
    stripe: 'from-berry/35 via-berry/15 to-cream',
    bgTint: 'from-berry/5',
  },
  'catering': {
    chip: 'bg-sage/30 text-emerald-800 ring-emerald-700/30',
    stripe: 'from-sage/50 via-sage/20 to-cream',
    bgTint: 'from-sage/10',
  },
}

// Translates lead-time + kind + stock into a single customer-facing status.
// Wording mirrors what the concierge prompt teaches the agent so the card
// and the chat reply about the same product line up. Kept short so the pill
// always fits on one line — long copy used to wrap and push the See-details
// link out of horizontal alignment with sibling cards. Exported so the
// product detail page can render the same status pill its card siblings do.
export function statusFor(product: Product): { text: string; tone: 'sage' | 'sky' | 'cocoa' | 'berry' } {
  if (!product.in_stock) {
    return { text: 'Out today · back tomorrow', tone: 'berry' }
  }
  if (product.kind === 'custom') {
    return { text: '24h notice', tone: 'cocoa' }
  }
  if (product.kind === 'catering') {
    return { text: '3h+ notice', tone: 'cocoa' }
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

const STATUS_PILL: Record<'sage' | 'sky' | 'cocoa' | 'berry', string> = {
  sage: 'bg-sage/30 text-emerald-800',
  sky: 'bg-sky/15 text-sky-800',
  cocoa: 'bg-cocoa-700/10 text-cocoa-900',
  berry: 'bg-berry/15 text-berry',
}

export function StatusPill({ status }: { status: ReturnType<typeof statusFor> }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        STATUS_PILL[status.tone],
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full mr-1.5',
          status.tone === 'sage' && 'bg-emerald-600',
          status.tone === 'sky' && 'bg-sky-700',
          status.tone === 'cocoa' && 'bg-cocoa-900',
          status.tone === 'berry' && 'bg-berry',
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
  // When the kind pill is suppressed (e.g. on /menu where the section
  // header already names the kind), surface the *tradition* chip instead.
  // This way each menu card still carries a small family signal — Honey,
  // Italian, Meringue, etc. — without doubling chrome with the section
  // header above it.
  const tradition = product.tradition
  const showTraditionChip = !showKindPill && Boolean(tradition)
  const traditionTheme = tradition ? TRADITION_THEME[tradition] : undefined
  const traditionLabel = tradition ? TRADITION_LABELS[tradition].short : ''
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
        {showTraditionChip && traditionTheme && (
          <span
            className={cn(
              'absolute top-3 left-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 shadow-sm',
              traditionTheme.chip,
            )}
          >
            {traditionLabel}
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

// Showcase: Pokémon-card style. Tradition chip → hero photo → name → flavor
// stack → tagline → status pill + CTA. Equal-height grid friendly: photo is
// fixed-aspect, body grows but the bottom rail stays anchored, so any 3 or
// 4 cards in a row align cleanly.
function ShowcaseCard({ product, className }: { product: Product; className?: string }) {
  const status = statusFor(product)
  const tradition = product.tradition ?? 'kazakh-european-honey'
  const theme = TRADITION_THEME[tradition]
  const traditionLabel = TRADITION_LABELS[tradition].short
  const kindLabel = kindLabelOf(product)
  const tagline = product.tagline ?? product.description ?? ''
  const oos = !product.in_stock
  return (
    <Link
      href={`/menu/${product.id}`}
      aria-disabled={oos || undefined}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl bg-cream border border-cocoa-700/10 shadow-sm',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]',
        oos && 'opacity-75 saturate-[0.6]',
        className,
      )}
    >
      {/* Tradition stripe — a one-pixel hint of the cake's family across the
          top edge. Cleaner than a full border colour, still felt. */}
      <span
        aria-hidden
        className={cn('h-1.5 w-full bg-gradient-to-r', theme.stripe)}
      />
      {/* Subtle background wash so each card carries its accent without
          competing with the photo. Renders behind everything. */}
      <span aria-hidden className={cn('absolute inset-0 bg-gradient-to-b to-transparent pointer-events-none', theme.bgTint)} />

      <div className="relative px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 shrink-0',
              theme.chip,
            )}
          >
            {traditionLabel}
          </span>
          <span className="text-sm font-medium text-cocoa-900/80 tabular-nums shrink-0">
            {fmtUsd(product.price_cents)}
          </span>
        </div>
      </div>

      <div className="relative mt-4 mx-5">
        <CakePhoto
          productId={product.id}
          name={`${product.name} — ${kindLabel} from Happy Cake`}
          src={product.photo_url}
          aspect="square"
          className="!rounded-2xl"
        />
        {oos && (
          <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-cream/95 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-berry shadow-sm ring-1 ring-berry/30">
            Out today
          </span>
        )}
      </div>

      <div className="relative px-5 pt-5 pb-5 flex flex-col gap-3 flex-1">
        <h3 className="font-display text-2xl leading-tight text-cocoa-900 group-hover:text-sky-700 transition-colors [text-wrap:balance]">
          {product.name}
        </h3>
        {product.flavor_notes && (
          <p className="text-[11px] uppercase tracking-[0.14em] text-cocoa-900/60 leading-relaxed line-clamp-2">
            {product.flavor_notes}
          </p>
        )}
        {tagline && (
          <p className="text-sm text-cocoa-900/75 leading-relaxed line-clamp-2">{tagline}</p>
        )}
        {/* Footer rail anchored bottom: status pill (truncates to one line)
            on the left, See details on the right (shrink-0 so it never gets
            pushed out by a long status). All sibling cards line up because
            border-t + py are constant. */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-cocoa-700/10">
          <StatusPill status={status} />
          <span className="inline-flex items-center gap-1 text-xs font-medium text-cocoa-900/60 group-hover:text-sky-700 transition-colors shrink-0 whitespace-nowrap">
            See details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

// Dense: the /menu workhorse. Stripped of the description and kind pill
// (the filter strip above already names the kind), trimmed padding, 4:3
// photo. Goal is four-up on desktop, two-up on mobile, with the bare
// essentials a scanner needs: photo, name, price, allergens, status.
function DenseCard({ product, className }: { product: Product; className?: string }) {
  const allergens = product.allergens?.split(',').map((a) => a.trim()).filter(Boolean) ?? []
  const kindLabel = kindLabelOf(product)
  const status = statusFor(product)
  const tradition = product.tradition
  const traditionTheme = tradition ? TRADITION_THEME[tradition] : undefined
  const traditionLabel = tradition ? TRADITION_LABELS[tradition].short : ''
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
          aspect="4/3"
          className="!rounded-none"
        />
        {tradition && traditionTheme && (
          <span
            className={cn(
              'absolute top-2 left-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 shadow-sm',
              traditionTheme.chip,
            )}
          >
            {traditionLabel}
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-base sm:text-lg leading-tight text-cocoa-900 group-hover:text-sky-700 transition-colors line-clamp-1">
            {product.name}
          </h3>
          <span className="text-sm font-medium text-cocoa-900/80 tabular-nums shrink-0">
            {fmtUsd(product.price_cents)}
          </span>
        </div>
        {allergens.length > 0 && (
          <p className="text-[11px] text-cocoa-900/55 leading-snug line-clamp-1">
            contains {allergens.join(' · ')}
          </p>
        )}
        <div className="mt-auto pt-2">
          <StatusPill status={status} />
        </div>
      </div>
    </Link>
  )
}
