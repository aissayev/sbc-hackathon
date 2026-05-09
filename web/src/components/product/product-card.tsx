import Link from 'next/link'
import type { Product } from '@/lib/api'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import { CATEGORY_LABELS } from '@/lib/brand'
import { Badge } from '@/components/ui/badge'
import { CakePhoto } from './cake-photo'
import { cn } from '@/lib/utils'

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const allergens = product.allergens?.split(',').map((a) => a.trim()).filter(Boolean) ?? []
  return (
    <Link
      href={`/menu/${product.id}`}
      className={cn(
        'group flex flex-col overflow-hidden bakery-card transition-all duration-200',
        'hover:-translate-y-0.5',
        className,
      )}
    >
      <CakePhoto productId={product.id} name={product.name} src={product.photo_url} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{CATEGORY_LABELS[product.category] ?? product.category}</p>
            <h3 className="display-h3 mt-1 group-hover:text-sky-700 transition-colors">{product.name}</h3>
          </div>
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
