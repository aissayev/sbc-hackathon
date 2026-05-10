'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  CalendarDays,
  Cake,
  ChefHat,
  Clock,
  Croissant,
  Gift,
  MessageSquareHeart,
  Minus,
  Plus,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react'

import type { Product } from '@/lib/api'
import { CATALOG, KIND_LABELS, type ProductKind } from '@/lib/catalog'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import {
  combineDateAndTime,
  hoursLabelForDay,
  isOpenDay,
  nextOpenDate,
  timeSlotsForDate,
} from '@/lib/hours'
import { cn } from '@/lib/utils'
import {
  RichSelect as Select,
  RichSelectContent as SelectContent,
  RichSelectItem as SelectItem,
  RichSelectTrigger as SelectTrigger,
  RichSelectValue as SelectValue,
} from '@/components/ui/select-rich'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// Inline lead-capture form that lives in the home hero. Owns:
//   - the order "kind" tab (slice / whole / custom / catering)
//   - a polished cake picker (image thumb + name + price via Radix Select)
//   - quantity stepper (with sane caps per kind)
//   - pickup vs delivery toggle
//   - a calendar popover that disables closed days
//   - a time-slot picker that's gated by BRAND.openingHoursSpec
// On submit it routes to /order with prefilled query params; the existing
// 3-step wizard owns validation, payment, and kitchen routing.

type Mode = 'pickup' | 'delivery'

// `shortLabel` is the single-word version that fits inside the tab pill
// without wrapping; `label` is the longer form used in section headers
// downstream (`Pick your slice`, etc.).
const TAB_DEFS: Array<{
  kind: ProductKind
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { kind: 'slice', label: 'By the slice', shortLabel: 'Slices', icon: Cake },
  { kind: 'whole', label: 'Whole cake', shortLabel: 'Whole', icon: Gift },
  { kind: 'pastry', label: 'Pastries', shortLabel: 'Pastries', icon: Croissant },
  { kind: 'custom', label: 'Custom', shortLabel: 'Custom', icon: ChefHat },
]

// Quantity caps mirror the order-form's intent: slices and pastries can be
// bought in higher quantity than whole cakes (kitchen capacity), and customs
// are always one-off designs.
const QTY_CAPS: Record<ProductKind, number> = {
  slice: 12,
  whole: 3,
  pastry: 12,
  custom: 1,
  catering: 4,
}

export function QuickOrderForm({ products }: { products: Product[] }) {
  const router = useRouter()

  // Backend's stale seed sometimes returns products without `kind` or
  // `in_stock`; the home page filters to in_stock then passes here. If
  // we still got nothing, fall back to the canonical catalog so the
  // hero never ships empty.
  const source = products.length > 0 ? products : (CATALOG as Product[])

  // Group products by kind so each tab has its own list and the dropdown
  // can show grouped sections.
  const byKind = React.useMemo(() => {
    const map = new Map<ProductKind, Product[]>()
    for (const p of source) {
      const arr = map.get(p.kind) ?? []
      arr.push(p)
      map.set(p.kind, arr)
    }
    return map
  }, [source])

  // Show only tabs that actually have products. Custom is always available
  // because the wizard handles it specially even if the kind is empty.
  const tabs = React.useMemo(
    () => TAB_DEFS.filter((t) => byKind.get(t.kind)?.length || t.kind === 'custom'),
    [byKind],
  )

  const [kind, setKind] = React.useState<ProductKind>(tabs[0]?.kind ?? 'slice')
  const optionsForKind = byKind.get(kind) ?? []
  const [productId, setProductId] = React.useState<string>(optionsForKind[0]?.id ?? '')
  const [qty, setQty] = React.useState(1)
  const [mode, setMode] = React.useState<Mode>('pickup')

  // Default the date to the first open day at or after tomorrow morning,
  // so we don't seed Monday (closed) or a past time when bakery is shut.
  const [date, setDate] = React.useState<Date>(() => {
    const start = new Date()
    start.setHours(11, 0, 0, 0)
    start.setDate(start.getDate() + 1)
    return nextOpenDate(start) ?? start
  })
  const [time, setTime] = React.useState<string>('')
  const [calOpen, setCalOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Re-pick the product when the tab changes. If the current product is
  // still in the new tab's list (rare), keep it; otherwise grab the first.
  React.useEffect(() => {
    if (!optionsForKind.find((p) => p.id === productId)) {
      setProductId(optionsForKind[0]?.id ?? '')
      setQty(1)
    }
  }, [kind, optionsForKind, productId])

  const selected = optionsForKind.find((p) => p.id === productId)
  const slots = React.useMemo(
    () =>
      timeSlotsForDate(date, {
        minLeadHours: selected?.lead_time_hours ?? 1,
      }),
    [date, selected?.lead_time_hours],
  )

  // Reset time whenever the available slots change so we never submit a
  // stale value (e.g. user picked 6 PM yesterday, switches to today, 6 PM
  // already passed — drop it and let them re-pick).
  React.useEffect(() => {
    if (slots.length === 0) {
      setTime('')
      return
    }
    if (!slots.find((s) => s.value === time)) {
      setTime(slots[Math.min(2, slots.length - 1)]?.value ?? slots[0].value)
    }
  }, [slots, time])

  const qtyMax = QTY_CAPS[kind]
  const isCustom = kind === 'custom'
  // For non-custom orders we need a product + a chosen time. Custom skips
  // the catalog entirely (the design funnel collects flavor/headcount/etc)
  // so the only requirement here is the date.
  const canSubmit = isCustom ? !submitting : !!productId && !!time && !submitting

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    if (isCustom) {
      // Custom orders go through the dedicated 5-step design funnel —
      // we just hand off the chosen pickup-or-delivery and the calendar
      // date as defaults. The funnel re-asks for time + everything else.
      const params = new URLSearchParams({
        mode,
        date: date.toISOString().slice(0, 10),
      })
      router.push(`/order/custom?${params.toString()}`)
      return
    }
    const when = combineDateAndTime(date, time)
    const params = new URLSearchParams({
      product: productId,
      mode,
      qty: String(qty),
      when: when.toISOString(),
    })
    router.push(`/order?${params.toString()}`)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl bg-white shadow-lift ring-1 ring-cocoa-700/5 p-6 md:p-7"
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

      {/* Kind tabs — pill row that scrolls horizontally on tight viewports
          rather than wrapping the labels onto two lines. Labels use the
          short / single-word display names from KIND_LABELS, NOT
          KIND_LABELS.singular (which would say "Whole cake" → wraps). */}
      <div className="mt-5 -mx-1 px-1 overflow-x-auto scrollbar-none">
        <div className="inline-flex gap-1 p-1 rounded-full bg-cream-100 border border-cocoa-700/10 whitespace-nowrap">
          {tabs.map((t) => {
            const active = t.kind === kind
            const Icon = t.icon
            return (
              <button
                key={t.kind}
                type="button"
                onClick={() => setKind(t.kind)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0',
                  active
                    ? 'bg-cocoa-700 text-cream shadow-sm'
                    : 'text-cocoa-900/70 hover:text-cocoa-900',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.shortLabel}
              </button>
            )
          })}
        </div>
      </div>

      {isCustom ? (
        <CustomCakeBrief />
      ) : (
        <CakePicker
          options={optionsForKind}
          productId={productId}
          onChange={setProductId}
          selected={selected}
          qty={qty}
          qtyMax={qtyMax}
          onQtyChange={setQty}
          kind={kind}
        />
      )}

      <div className="mt-5">
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
                  'h-auto py-3 px-4 rounded-xl border text-left transition-all duration-150',
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

      <div className={cn('mt-5 grid gap-3', isCustom ? 'grid-cols-1' : 'grid-cols-2')}>
        <div>
          <label htmlFor="quick-date" className="block text-sm font-medium text-cocoa-900">
            {isCustom ? 'Need it by' : 'Date'}
          </label>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger
              id="quick-date"
              className="mt-1.5 w-full h-12 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 text-left text-sm text-cocoa-900 inline-flex items-center justify-between gap-2 focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25"
            >
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-cocoa-700" />
                {format(date, 'EEE, MMM d')}
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (!d) return
                  setDate(d)
                  setCalOpen(false)
                }}
                disabled={(d) => {
                  if (!isOpenDay(d)) return true
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return d < today
                }}
              />
              <div className="px-4 pb-3 pt-1 text-[11px] text-cocoa-900/60 border-t border-cocoa-700/10">
                Closed Mondays · Tue–Sat 11–7 · Sun 12–6
              </div>
            </PopoverContent>
          </Popover>
          {isCustom && (
            <p className="mt-1.5 text-[11px] text-cocoa-900/60">
              Custom cakes need 24h notice (36h for vegan / gluten-free).
            </p>
          )}
        </div>

        {!isCustom && (
          <div>
            <label htmlFor="quick-time" className="block text-sm font-medium text-cocoa-900">
              Time
            </label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger id="quick-time" className="mt-1.5">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cocoa-700" />
                  <SelectValue placeholder={slots.length === 0 ? 'Closed this day' : 'Pick a time'} />
                </span>
              </SelectTrigger>
              <SelectContent>
                {slots.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-cocoa-900/60">
                    We&apos;re closed on {format(date, 'EEEE')}.
                  </div>
                ) : (
                  slots.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[11px] text-cocoa-900/60">
              {hoursLabelForDay(date)}
              {selected?.lead_time_hours
                ? ` · earliest ${leadTimeLabel(selected.lead_time_hours).toLowerCase()}`
                : ''}
            </p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-cocoa-700 text-cream font-medium h-12 px-6 hover:bg-cocoa-900 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {isCustom ? 'Start the design' : 'Continue to checkout'}
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

function CakePicker({
  options,
  productId,
  onChange,
  selected,
  qty,
  qtyMax,
  onQtyChange,
  kind,
}: {
  options: Product[]
  productId: string
  onChange: (id: string) => void
  selected: Product | undefined
  qty: number
  qtyMax: number
  onQtyChange: (qty: number) => void
  kind: ProductKind
}) {
  const label = KIND_LABELS[kind]
  return (
    <div className="mt-5">
      <label htmlFor="quick-cake" className="block text-sm font-medium text-cocoa-900">
        {options.length > 1 ? `Pick your ${label.singular.toLowerCase()}` : label.singular}
      </label>
      <Select value={productId} onValueChange={onChange}>
        <SelectTrigger id="quick-cake" className="mt-1.5 h-auto py-2.5">
          {selected ? (
            <CakeOptionRow product={selected} compact />
          ) : (
            <SelectValue placeholder="Pick a cake" />
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id} className="py-2 pl-2 pr-8">
              <CakeOptionRow product={p} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {qtyMax > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-cocoa-900/70">How many?</span>
          <div className="inline-flex items-center rounded-full border border-cocoa-700/15 bg-cream-50">
            <button
              type="button"
              onClick={() => onQtyChange(Math.max(1, qty - 1))}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
              className="h-9 w-10 inline-flex items-center justify-center text-cocoa-700 disabled:opacity-30 hover:bg-cream-100 rounded-l-full"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-9 text-center text-sm font-medium text-cocoa-900" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => onQtyChange(Math.min(qtyMax, qty + 1))}
              disabled={qty >= qtyMax}
              aria-label="Increase quantity"
              className="h-9 w-10 inline-flex items-center justify-center text-cocoa-700 disabled:opacity-30 hover:bg-cream-100 rounded-r-full"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CakeOptionRow({ product, compact = false }: { product: Product; compact?: boolean }) {
  return (
    <span className="flex items-center gap-3 w-full text-left">
      <span
        className={cn(
          'relative shrink-0 overflow-hidden rounded-lg bg-cream-100',
          compact ? 'h-9 w-9' : 'h-11 w-11',
        )}
      >
        {product.photo_url && (
          <Image
            src={product.photo_url}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
            unoptimized
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-cocoa-900 truncate">{product.name}</span>
        {!compact && product.allergens && (
          <span className="block text-[11px] text-cocoa-900/55 truncate">
            contains {product.allergens.split(',').map((s) => s.trim()).join(', ')}
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm font-medium text-cocoa-900 tabular-nums">
        {fmtUsd(product.price_cents)}
      </span>
    </span>
  )
}

// Custom cake briefing surface — shown when the Custom tab is active.
// We deliberately don't try to recreate the 5-step funnel here; the
// hero stays compact and the user is handed off to /order/custom with
// the date pre-seeded. This component is content / explanation only —
// the form's submit button drives the actual hand-off.
function CustomCakeBrief() {
  const items: Array<{ label: string; example: string }> = [
    { label: 'Occasion', example: 'birthday, baby shower, wedding…' },
    { label: 'Headcount', example: 'serves 8 / 16 / 30+' },
    { label: 'Flavor + design', example: 'honey, pistachio, fondant, photo' },
    { label: 'Allergens', example: 'gluten-free, vegan, no nuts' },
  ]
  return (
    <div className="mt-5 rounded-2xl border border-sky/30 bg-sky/5 p-4">
      <div className="flex items-start gap-3">
        <span className="h-8 w-8 rounded-full bg-sky/15 inline-flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-sky-700" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-cocoa-900">Designed with Askhat, our owner</p>
          <p className="mt-0.5 text-xs text-cocoa-900/65 leading-relaxed">
            Quick brief next, then a phone call to lock the price and timing. Most quotes back
            within the hour during open hours.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky shrink-0 mt-1.5" />
            <span className="min-w-0">
              <span className="block font-medium text-cocoa-900">{item.label}</span>
              <span className="block text-cocoa-900/55 truncate">{item.example}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
