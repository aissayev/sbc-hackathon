'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cake, Store, Truck, ArrowRight, Clock, MessageSquareHeart } from 'lucide-react'

import type { Product } from '@/lib/api'
import { CATALOG } from '@/lib/catalog'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

// Inline lead-capture form that lives in the home hero. The full /order
// wizard owns validation, payment, kitchen routing — this is just the
// "pick a cake, pick a mode, when do you want it" funnel that hands off
// the prefilled state via query params. Mirrors the lead-form pattern
// from the websites monorepo (rabbit-roofing HeroForm) but tuned to the
// HappyCake palette.

type Mode = 'pickup' | 'delivery'

const FEATURED_KINDS = ['slice', 'whole', 'pastry', 'custom'] as const

export function QuickOrderForm({ products }: { products: Product[] }) {
  const router = useRouter()

  // Pull one product per featured kind (slice / whole / pastry / custom)
  // so the dropdown reads as the case browser would. The backend's stale
  // seed sometimes omits `in_stock` and `kind`, leaving `products` empty —
  // when that happens we fall back to the canonical CATALOG so the hero
  // form never ships with an empty dropdown.
  const featured = React.useMemo(() => {
    const source = products.length > 0 ? products : CATALOG
    const picks: Product[] = []
    for (const k of FEATURED_KINDS) {
      const p = source.find((x) => x.kind === k)
      if (p) picks.push(p)
    }
    if (picks.length < 4) {
      for (const p of source) {
        if (picks.length >= 6) break
        if (!picks.includes(p)) picks.push(p)
      }
    }
    return picks
  }, [products])

  const [productId, setProductId] = React.useState(featured[0]?.id ?? '')
  const [mode, setMode] = React.useState<Mode>('pickup')
  const [when, setWhen] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const minWhen = React.useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setSeconds(0, 0)
    return toLocalDatetimeValue(d)
  }, [])

  React.useEffect(() => {
    if (!when) setWhen(defaultPickupTime())
  }, [when])

  const selected = products.find((p) => p.id === productId)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) return
    setSubmitting(true)
    const params = new URLSearchParams({ product: productId, mode })
    if (when) params.set('when', new Date(when).toISOString())
    router.push(`/order?${params.toString()}`)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bakery-card p-6 md:p-7 ring-1 ring-cocoa-700/5"
      aria-labelledby="quick-order-heading"
    >
      <div className="flex items-center gap-2.5">
        <span className="h-9 w-9 rounded-full bg-sky/15 inline-flex items-center justify-center">
          <Cake className="h-4.5 w-4.5 text-sky-700" />
        </span>
        <div>
          <p className="eyebrow">Start an order</p>
          <h2 id="quick-order-heading" className="display-h3 text-xl mt-0.5">
            Reserve in 30 seconds
          </h2>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="quick-cake" className="block text-sm font-medium text-cocoa-900">
            What would you like?
          </label>
          <div className="relative mt-1.5">
            <select
              id="quick-cake"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full appearance-none h-12 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 pr-10 text-sm text-cocoa-900 focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25"
            >
              {featured.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {fmtUsd(p.price_cents)}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-900/45">
              ▾
            </span>
          </div>
          {selected?.lead_time_hours ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-cocoa-900/65">
              <Clock className="h-3 w-3" /> Earliest: {leadTimeLabel(selected.lead_time_hours).toLowerCase()}
            </p>
          ) : null}
        </div>

        <div>
          <span className="block text-sm font-medium text-cocoa-900">How would you like it?</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Pickup or delivery">
            {(
              [
                { value: 'pickup' as const, label: 'Pickup', icon: Store, hint: 'Free at our shop' },
                { value: 'delivery' as const, label: 'Delivery', icon: Truck, hint: 'Greater Houston area' },
              ]
            ).map(({ value, label, icon: Icon, hint }) => {
              const active = mode === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={active}
                  className={cn(
                    'group h-auto py-3 px-4 rounded-xl border text-left transition-all duration-150',
                    active
                      ? 'border-sky bg-sky/10 text-cocoa-900 shadow-sm'
                      : 'border-cocoa-700/15 bg-cream-50 text-cocoa-900 hover:border-cocoa-700/30',
                  )}
                >
                  <span className="flex items-center gap-2 font-medium text-sm">
                    <Icon className={cn('h-4 w-4', active ? 'text-sky-700' : 'text-cocoa-700')} />
                    {label}
                  </span>
                  <span className="block mt-0.5 text-[11px] text-cocoa-900/60">{hint}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="quick-when" className="block text-sm font-medium text-cocoa-900">
            When do you need it?
          </label>
          <input
            id="quick-when"
            type="datetime-local"
            min={minWhen}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1.5 w-full h-12 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 text-sm text-cocoa-900 focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !productId}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-cocoa-700 text-cream font-medium h-12 px-6 hover:bg-cocoa-900 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Continue to checkout
        <ArrowRight className="h-4 w-4" />
      </button>

      <div className="mt-4 flex items-center justify-between text-xs text-cocoa-900/65">
        <Link
          href="/menu"
          className="inline-flex items-center gap-1 hover:text-cocoa-900 underline-offset-4 hover:underline"
        >
          See full menu
        </Link>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 hover:text-cocoa-900 underline-offset-4 hover:underline"
        >
          <MessageSquareHeart className="h-3.5 w-3.5" />
          Or chat with us
        </Link>
      </div>
    </form>
  )
}

function defaultPickupTime() {
  // Default to 26h ahead so whole-cake leads (about an hour notice) and
  // custom-cake leads (24h notice) both fit comfortably.
  const d = new Date(Date.now() + 26 * 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  return toLocalDatetimeValue(d)
}

function toLocalDatetimeValue(d: Date) {
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60 * 1000)
  return local.toISOString().slice(0, 16)
}
