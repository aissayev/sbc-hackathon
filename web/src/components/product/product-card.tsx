import Link from 'next/link'
import type { Product } from '@/lib/api'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import { CATEGORY_LABELS } from '@/lib/brand'
import { KIND_LABELS } from '@/lib/catalog'
import { Badge } from '@/components/ui/badge'
import { CakePhoto } from './cake-photo'
import { cn } from '@/lib/utils'

// Three card variants:
//   default    — square photo on top, full info card. Used in /menu grids.
//   featured   — taller photo with the title overlaid. Use sparingly: home
//                hero specialty, "today's pick", first item in a kind row.
//   compact    — horizontal row (photo left, name + price right). Used in
//                related-products lists and the order-confirmation summary.

type Variant = 'default' | 'featured' | 'compact'

export function ProductCard({
  product,
  variant = 'default',
  className,
}: {
  product: Product
  variant?: Variant
  className?: string
}) {
  if (variant === 'compact') return <CompactCard product={product} className={className} />
  if (variant === 'featured') return <FeaturedCard product={product} className={className} />
  return <DefaultCard product={product} className={className} />
}

function DefaultCard({ product, className }: { product: Product; className?: string }) {
  const allergens = product.allergens?.split(',').map((a) => a.trim()).filter(Boolean) ?? []
  const kindLabel = KIND_LABELS[product.kind]?.singular ?? CATEGORY_LABELS[product.category] ?? product.category
  return (
    <Link
      href={`/menu/${product.id}`}
      className={cn(
        'group flex flex-col overflow-hidden bakery-card transition-all duration-200',
        'hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="relative">
        <CakePhoto productId={product.id} name={`${product.name} — ${kindLabel} from Happy Cake`} src={product.photo_url} />
        <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-cocoa-900 shadow-sm">
          {kindLabel}
        </span>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="display-h3 group-hover:text-sky-700 transition-colors">{product.name}</h3>
          <div className="text-right shrink-0">
            <div className="text-xl font-semibold text-cocoa-900">{fmtUsd(product.price_cents)}</div>
          </div>
        </div>
        {product.description && (
          <p className="text-sm text-cocoa-900/70 leading-relaxed line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xs text-cocoa-900/55">{leadTimeLabel(product.lead_time_hours)}</span>
          {allergens.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {allergens.slice(0, 3).map((a) => (
                <Badge key={a} variant="outline" className="text-[11px] py-0 border-cocoa-700/20 text-cocoa-900/70">
                  {a}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function FeaturedCard({ product, className }: { product: Product; className?: string }) {
  const kindLabel = KIND_LABELS[product.kind]?.singular ?? CATEGORY_LABELS[product.category] ?? product.category
  return (
    <Link
      href={`/menu/${product.id}`}
      className={cn(
        'group relative block overflow-hidden rounded-3xl bg-cocoa-900 text-cream shadow-lift',
        'transition-transform duration-200 hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]">
        <CakePhoto
          productId={product.id}
          name={`${product.name} — ${kindLabel} signature from Happy Cake`}
          src={product.photo_url}
          aspect="square"
          className="!aspect-auto absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cocoa-900/85 via-cocoa-900/30 to-transparent" aria-hidden />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full bg-cream/95 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-cocoa-900">
            Today&apos;s pick · {kindLabel}
          </span>
          <span className="rounded-full bg-cream/95 px-3 py-1 text-sm font-semibold text-cocoa-900">
            {fmtUsd(product.price_cents)}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="font-display text-3xl md:text-4xl leading-tight [text-wrap:balance]">{product.name}</h3>
          {product.description && (
            <p className="mt-2 text-cream/85 leading-relaxed line-clamp-2 max-w-md">{product.description}</p>
          )}
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-cream/85">
            <span>{leadTimeLabel(product.lead_time_hours)}</span>
            <span aria-hidden>·</span>
            <span className="underline-offset-4 group-hover:underline">See details →</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function CompactCard({ product, className }: { product: Product; className?: string }) {
  const kindLabel = KIND_LABELS[product.kind]?.singular ?? CATEGORY_LABELS[product.category] ?? product.category
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
          className="!aspect-square h-16 w-16"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.16em] text-cocoa-900/55">{kindLabel}</div>
        <div className="font-display text-lg text-cocoa-900 group-hover:text-sky-700 transition-colors truncate">
          {product.name}
        </div>
        <div className="text-xs text-cocoa-900/60">{leadTimeLabel(product.lead_time_hours)}</div>
      </div>
      <span className="text-sm font-semibold text-sky-700 shrink-0">{fmtUsd(product.price_cents)}</span>
    </Link>
  )
}
