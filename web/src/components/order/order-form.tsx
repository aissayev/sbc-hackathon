'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Truck,
  Store,
  ArrowRight,
  ArrowLeft,
  Check,
  Cake,
  Clock,
  UserRound,
  CreditCard,
  Lock,
  Sparkles,
} from 'lucide-react'

import type { Product } from '@/lib/api'
import { fmtUsd } from '@/lib/format'
import { earliestReadyLabel } from '@/lib/hours'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CakePhoto } from '@/components/product/cake-photo'
import { cn } from '@/lib/utils'
import { DELIVERY_CITIES, validateZipForDelivery } from '@/lib/delivery'
import { AddressAutocomplete } from './address-autocomplete'
import { DateTimePicker } from './date-time-picker'

// Browser-side thread id reused across visits so admin can correlate web-form
// orders with prior chat threads from the same browser. Persisted in
// localStorage (best-effort — falls back to per-render id if blocked).
function useWebThreadId(): string {
  return React.useMemo(() => {
    if (typeof window === 'undefined') return `web_${Math.random().toString(36).slice(2, 10)}`
    try {
      const existing = window.localStorage.getItem('hc_thread_id')
      if (existing) return existing
      const fresh = `web_${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem('hc_thread_id', fresh)
      return fresh
    } catch {
      return `web_${Math.random().toString(36).slice(2, 10)}`
    }
  }, [])
}

// Robust JSON parse — Next.js will return HTML for upstream proxy failures
// (e.g. BACKEND_URL unset on the droplet → 404 page → `<!DOC...`). Catch that
// before .json() throws a confusing positional error in the UI.
async function postJson<T>(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? 'Network error.' }
  }
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      reason: "Order system is taking a moment. Try again in a minute, or text us at (281) 979-8320.",
    }
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    return {
      ok: false,
      reason: 'Sorry — couldn\'t read the response. Try again, or message us on WhatsApp.',
    }
  }
  if (!res.ok) {
    const reason =
      (data && typeof data === 'object' && 'reason' in data && typeof (data as { reason: unknown }).reason === 'string'
        ? (data as { reason: string }).reason
        : null) ??
      (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null) ??
      `Order didn't go through (${res.status}).`
    return { ok: false, reason }
  }
  return { ok: true, data: data as T }
}

// Min digit count for any reachable phone — covers US 10-digit numbers
// (with or without +1) and most international formats. We don't enforce
// E.164 because the kitchen calls back via WhatsApp first; a permissive
// check here keeps real customers in and obvious garbage out.
const PHONE_REGEX = /^[+()\d\s\-.]+$/

const baseSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Pick a cake'),
        quantity: z.coerce
          .number({ invalid_type_error: 'Quantity must be a number' })
          .int('Whole numbers only')
          .positive('At least one of each')
          .max(50, 'Max 50 per cake — for bigger orders, talk to us in chat'),
      }),
    )
    .min(1, 'Add at least one cake'),
  scheduled_at_iso: z.string().min(1, 'Pick a pickup or delivery time'),
  pickup_or_delivery: z.enum(['pickup', 'delivery']),
  customer_name: z
    .string()
    .trim()
    .min(2, 'Your name (so we can label the box)')
    .max(80, 'That looks long — is it a typo?'),
  customer_phone: z
    .string()
    .trim()
    .min(7, 'Phone or WhatsApp number')
    .max(20, 'That looks long — is it a typo?')
    .regex(PHONE_REGEX, 'Use digits, spaces, +, -, ( or )')
    .refine((s) => s.replace(/\D/g, '').length >= 7, 'Need at least 7 digits'),
  notes: z.string().max(500, 'Keep notes under 500 characters').optional(),
  // Delivery-only — validated conditionally below.
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
})

const schema = baseSchema.superRefine((v, ctx) => {
  if (v.pickup_or_delivery !== 'delivery') return
  if (!v.street || v.street.trim().length < 4) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['street'], message: 'Street address required for delivery.' })
  }
  if (!v.city || v.city.trim().length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'City required for delivery.' })
  }
  if (!v.state || v.state.trim().length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['state'], message: 'State required.' })
  } else if (v.state.toUpperCase() !== 'TX') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['state'],
      message: 'We deliver in Texas only — try pickup or chat for a custom quote.',
    })
  }
  const zipCheck = validateZipForDelivery(v.zip ?? '')
  if (!zipCheck.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['zip'], message: zipCheck.reason ?? 'Invalid ZIP.' })
  }
})

type FormValues = z.infer<typeof schema>

interface DraftOrderResponse {
  order_id: string
  total_cents: number
  status: string
}

interface PaymentState {
  cardholder: string
  number: string
  expiry: string
  cvc: string
  saveForNext: boolean
}

// Stripe test cards we accept in placeholder mode. Anything matching one of
// these is treated as a successful tokenisation; anything else fails fast.
// (`4242 4242 4242 4242` is Stripe's universal demo card.)
const TEST_CARDS = new Set(['4242424242424242', '4111111111111111', '5555555555554444'])

// Four-step order wizard. Each step validates its own fields before letting
// the customer advance, so they don't get a wall of errors on send. The
// basket sidebar is sticky across all steps.
//
// The `payment` step is a placeholder Stripe-test-card UI in this build —
// the actual capture happens via Square once Askhat approves the draft, so
// this screen only collects card details to *demonstrate* the checkout
// pattern. The submit POSTs the order to /api/orders/draft as before; the
// owner-side Telegram card carries a "card on file" hint.
type StepKey = 'cakes' | 'when' | 'contact' | 'payment'

const STEPS: Array<{ key: StepKey; index: number; label: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'cakes', index: 1, label: 'What would you like?', subtitle: 'Pick the cakes and quantities.', icon: Cake },
  { key: 'when', index: 2, label: 'When + how', subtitle: 'Time, pickup or delivery, address.', icon: Clock },
  { key: 'contact', index: 3, label: 'Your details', subtitle: 'Where to reach you, plus any kitchen notes.', icon: UserRound },
  { key: 'payment', index: 4, label: 'Payment', subtitle: 'Card on file — we charge after Askhat approves.', icon: CreditCard },
]

type StepFields = ReadonlyArray<keyof FormValues | `items.${number}.${'product_id' | 'quantity'}`>

function fieldsForStep(stepKey: StepKey, deliveryMode: boolean, itemsCount: number): StepFields {
  if (stepKey === 'cakes') {
    const fields: Array<`items.${number}.${'product_id' | 'quantity'}`> = []
    for (let i = 0; i < itemsCount; i++) {
      fields.push(`items.${i}.product_id`, `items.${i}.quantity`)
    }
    return fields
  }
  if (stepKey === 'when') {
    return deliveryMode
      ? (['scheduled_at_iso', 'pickup_or_delivery', 'street', 'city', 'state', 'zip'] as const)
      : (['scheduled_at_iso', 'pickup_or_delivery'] as const)
  }
  if (stepKey === 'contact') {
    return ['customer_name', 'customer_phone'] as const
  }
  // Payment step is local-state-only (not part of the zod schema). It does
  // its own client-side validation in PaymentStep before allowing submit.
  return [] as const
}

export function OrderForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seededProduct = searchParams.get('product') ?? products[0]?.id ?? ''
  // Quantity from the hero quick-form. Cap at 50 to mirror the schema; fall
  // back to 1 if missing or invalid.
  const seededQty = (() => {
    const raw = searchParams.get('qty')
    if (!raw) return 1
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) return 1
    return Math.min(50, n)
  })()
  const seededMode = (searchParams.get('mode') === 'delivery' ? 'delivery' : 'pickup') as
    | 'pickup'
    | 'delivery'
  // The hero quick-form posts an ISO string; honour it if the timestamp is
  // still in the future (an hour-old link shouldn't reseed a past date).
  const seededWhen = (() => {
    const raw = searchParams.get('when')
    if (!raw) return defaultPickupTime()
    const t = Date.parse(raw)
    if (Number.isNaN(t) || t < Date.now() + 30 * 60 * 1000) return defaultPickupTime()
    return toLocalDatetimeValue(new Date(t))
  })()
  const threadId = useWebThreadId()
  const [stepIdx, setStepIdx] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Payment is local-state-only (not part of the zod schema). The owner
  // captures via Square after approving the draft, so this screen demos
  // the checkout pattern + collects a "card on file" hint for Askhat.
  const [payment, setPayment] = React.useState<PaymentState>({
    cardholder: '',
    number: '',
    expiry: '',
    cvc: '',
    saveForNext: true,
  })
  const [paymentError, setPaymentError] = React.useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      items: [{ product_id: seededProduct, quantity: seededQty }],
      scheduled_at_iso: seededWhen,
      pickup_or_delivery: seededMode,
      customer_name: '',
      customer_phone: '',
      notes: '',
      street: '',
      city: 'Sugar Land',
      state: 'TX',
      zip: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchItems = form.watch('items')
  const mode = form.watch('pickup_or_delivery')
  const step = STEPS[stepIdx]

  const total = React.useMemo(() => {
    return watchItems.reduce((acc, it) => {
      const p = products.find((x) => x.id === it.product_id)
      return acc + (p?.price_cents ?? 0) * (Number(it.quantity) || 0)
    }, 0)
  }, [watchItems, products])

  const maxLead = React.useMemo(() => {
    return watchItems.reduce((acc, it) => {
      const p = products.find((x) => x.id === it.product_id)
      return Math.max(acc, p?.lead_time_hours ?? 0)
    }, 0)
  }, [watchItems, products])

  // No auto-scroll on step change. Earlier `nudgeFormIntoView()` snapped
  // the page when the form's top moved off-screen by more than ~80px,
  // which felt like a bounce the moment the user scrolled even slightly.
  // The new step's content lives in the same form box anyway, so the
  // visible viewport already reads the right thing. Validation errors
  // still get focus via react-hook-form, so blocked steps focus the
  // first invalid field automatically.
  async function onNext() {
    const fields = fieldsForStep(step.key, mode === 'delivery', watchItems.length)
    if (fields.length > 0) {
      const ok = await form.trigger(fields as Parameters<typeof form.trigger>[0])
      if (!ok) return
    }
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))
  }

  function validatePayment(): string | null {
    const digits = payment.number.replace(/\s/g, '')
    if (!payment.cardholder.trim()) return 'Cardholder name required.'
    if (digits.length < 13) return 'Card number looks too short.'
    if (!TEST_CARDS.has(digits)) {
      return 'Use a Stripe test card — 4242 4242 4242 4242 always works in this build.'
    }
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(payment.expiry.trim())) return 'Expiry as MM / YY.'
    if (!/^\d{3,4}$/.test(payment.cvc.trim())) return 'CVC is 3 or 4 digits.'
    return null
  }

  function onBack() {
    setStepIdx((i) => Math.max(0, i - 1))
  }

  async function onSubmit(values: FormValues) {
    // Final gate: validate the payment placeholder before sending the
    // order. Stripe-test-mode for now; real Square capture happens after
    // Askhat approves the draft.
    const paymentIssue = validatePayment()
    if (paymentIssue) {
      setPaymentError(paymentIssue)
      // Jump back to payment step so the customer can fix it.
      setStepIdx(STEPS.findIndex((s) => s.key === 'payment'))
      return
    }
    setPaymentError(null)
    setSubmitting(true)
    setError(null)

    // Compose delivery address + payment hint into the notes field. The
    // owner's TG card surfaces "Card on file: ••4242, expires 12/27" so
    // Askhat knows the customer reached the end of the funnel; we never
    // log the full PAN.
    const addressLine =
      values.pickup_or_delivery === 'delivery'
        ? `Deliver to: ${values.street}, ${values.city}, ${values.state ?? 'TX'} ${values.zip}`
        : null
    const cardLast4 = payment.number.replace(/\s/g, '').slice(-4)
    const paymentLine = `Card on file: •• ${cardLast4} · ${payment.cardholder} · exp ${payment.expiry.trim()}`
    const composedNotes = [addressLine, paymentLine, values.notes?.trim() || null]
      .filter(Boolean)
      .join('\n')

    // Pull captured `?ref=` (sessionStorage, set by ReferralCapture in
    // providers.tsx). Lazy-import keeps SSR clean.
    const { getReferral } = await import('@/lib/referral')
    const referral_source = getReferral() ?? undefined

    const payload = {
      thread_id: threadId,
      channel: 'web' as const,
      customer_name: values.customer_name,
      customer_phone: values.customer_phone,
      items: values.items.map((it) => ({ product_id: it.product_id, quantity: Number(it.quantity) })),
      scheduled_at_iso: new Date(values.scheduled_at_iso).toISOString(),
      pickup_or_delivery: values.pickup_or_delivery,
      notes: composedNotes || undefined,
      referral_source,
    }

    const result = await postJson<DraftOrderResponse>('/api/orders/draft', payload)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    router.push(`/order/confirm/${result.data.order_id}`)
  }

  const isLast = stepIdx === STEPS.length - 1

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <ProgressRail stepIdx={stepIdx} />

        <div className="mt-8">
          <h2 className="display-h2 text-3xl">{step.label}</h2>
          <p className="mt-1 text-cocoa-900/70">{step.subtitle}</p>
        </div>

        {step.key === 'cakes' && (
          <CakesStep
            fields={fields}
            watchItems={watchItems}
            products={products}
            form={form}
            append={append}
            remove={remove}
          />
        )}

        {step.key === 'when' && (
          <WhenStep form={form} maxLead={maxLead} mode={mode} />
        )}

        {step.key === 'contact' && (
          <ContactStep form={form} />
        )}

        {step.key === 'payment' && (
          <PaymentStep
            payment={payment}
            setPayment={(p) => {
              setPayment(p)
              if (paymentError) setPaymentError(null)
            }}
            error={paymentError}
            total={total}
          />
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onBack} disabled={stepIdx === 0}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {!isLast ? (
            <Button type="button" size="lg" onClick={onNext}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={submitting}>
              <Lock className="h-4 w-4" />
              {submitting ? 'Sending to kitchen…' : `Place order · ${fmtUsd(total)}`}
            </Button>
          )}
        </div>
        {error && (
          <p className="mt-4 text-sm text-berry bg-berry/10 rounded-md p-3" role="alert">
            {error}
          </p>
        )}
      </div>

      <BasketAside
        watchItems={watchItems}
        products={products}
        mode={mode}
        total={total}
        stepIdx={stepIdx}
        onAddMore={() => setStepIdx(0)}
      />
    </form>
  )
}

function ProgressRail({ stepIdx }: { stepIdx: number }) {
  return (
    <ol className="flex items-center gap-3 md:gap-4 text-sm" aria-label="Order steps">
      {STEPS.map((s, i) => {
        const status: 'done' | 'current' | 'todo' = i < stepIdx ? 'done' : i === stepIdx ? 'current' : 'todo'
        return (
          <li key={s.key} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  'h-8 w-8 rounded-full inline-flex items-center justify-center text-xs font-medium shrink-0 border',
                  status === 'done' && 'bg-emerald-100 text-emerald-700 border-emerald-300',
                  status === 'current' && 'bg-cocoa-700 text-cream border-cocoa-700',
                  status === 'todo' && 'bg-white text-cocoa-900/45 border-cocoa-700/20',
                )}
              >
                {status === 'done' ? <Check className="h-4 w-4" /> : s.index}
              </span>
              <span
                className={cn(
                  'truncate text-sm font-medium',
                  status === 'current' ? 'text-cocoa-900' : 'text-cocoa-900/55',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'flex-1 h-px',
                  i < stepIdx ? 'bg-emerald-300' : 'bg-cocoa-700/15',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// Amazon-cart-style item rows. Each row is a card with the cake photo
// thumbnail on the left, name + tradition + price + lead-time chips in
// the middle, and a quantity stepper + remove on the right. Each row
// has a clear visual hierarchy: the photo grounds the row so customers
// can scan a multi-item basket without re-reading every line.
function CakesStep({
  fields,
  watchItems,
  products,
  form,
  append,
  remove,
}: {
  fields: ReturnType<typeof useFieldArray<FormValues, 'items'>>['fields']
  watchItems: FormValues['items']
  products: Product[]
  form: ReturnType<typeof useForm<FormValues>>
  append: ReturnType<typeof useFieldArray<FormValues, 'items'>>['append']
  remove: ReturnType<typeof useFieldArray<FormValues, 'items'>>['remove']
}) {
  return (
    <div className="mt-6 space-y-3">
      {products.length === 0 && (
        <div className="rounded-lg border border-berry/30 bg-berry/5 p-4 text-sm text-cocoa-900">
          We can&apos;t reach the kitchen catalog right now. Try refreshing — or message us on{' '}
          <Link href="/chat" className="text-sky-700 underline">chat</Link> and we&apos;ll take the
          order by hand.
        </div>
      )}
      {fields.map((field, idx) => {
        const product = products.find((p) => p.id === watchItems[idx]?.product_id)
        const lineTotal = (product?.price_cents ?? 0) * Number(watchItems[idx]?.quantity ?? 0)
        const oos = product && !product.in_stock
        const allergens = product?.allergens?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
        return (
          <div
            key={field.id}
            className="rounded-2xl border border-cocoa-700/15 bg-white p-4 shadow-sm hover:border-cocoa-700/25 transition-colors"
          >
            <div className="grid gap-4 sm:grid-cols-[88px_1fr] sm:items-start">
              {/* Photo thumbnail (left). Always 88x88; falls back to the
                  brand pattern via CakePhoto. Dim when out of stock. */}
              <div
                className={cn(
                  'relative h-22 w-full sm:w-22 sm:h-22 overflow-hidden rounded-xl bg-cream-100',
                  oos && 'opacity-60 saturate-[0.6]',
                )}
                style={{ width: 88, height: 88 }}
              >
                {product ? (
                  <CakePhoto
                    productId={product.id}
                    name={product.name}
                    src={product.photo_url}
                    aspect="square"
                    className="!aspect-square !rounded-none h-full w-full"
                  />
                ) : (
                  <div className="h-full w-full bg-cream-100" aria-hidden />
                )}
              </div>

              <div className="min-w-0">
                {/* Header row: title-area select + price + remove. The
                    Select carries the cake name, the price floats right
                    so totals scan vertically across rows. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`item-${idx}`} className="sr-only">
                      Cake
                    </Label>
                    <Controller
                      control={form.control}
                      name={`items.${idx}.product_id`}
                      render={({ field }) => (
                        <Select {...field} id={`item-${idx}`} className="font-medium">
                          <option value="" disabled>
                            Pick a cake from the case…
                          </option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id} disabled={!p.in_stock}>
                              {p.name} · {fmtUsd(p.price_cents)}
                              {!p.in_stock ? ' (out today)' : ''}
                            </option>
                          ))}
                        </Select>
                      )}
                    />
                  </div>
                  <div className="text-right shrink-0 pt-1">
                    <div className="text-sm font-semibold text-cocoa-900 tabular-nums">
                      {fmtUsd(lineTotal)}
                    </div>
                    {Number(watchItems[idx]?.quantity ?? 0) > 1 && product && (
                      <div className="text-[11px] text-cocoa-900/55 tabular-nums">
                        {fmtUsd(product.price_cents)} each
                      </div>
                    )}
                  </div>
                </div>

                {form.formState.errors.items?.[idx]?.product_id && (
                  <p className="mt-1 text-xs text-berry">
                    {form.formState.errors.items[idx]?.product_id?.message}
                  </p>
                )}

                {/* Meta row: lead-time badge + allergen note + OOS hint.
                    The badge respects store hours via `earliestReadyLabel`,
                    so a 1h-lead product on a Saturday at midnight reads
                    "Sunday at 12:00 PM" instead of the misleading
                    "About an hour". */}
                {product && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-cocoa-900/65 flex-wrap">
                    <Badge variant="outline" className="text-[11px]">
                      {oos ? 'Out today · back tomorrow' : earliestReadyLabel(product.lead_time_hours)}
                    </Badge>
                    {allergens.length > 0 && (
                      <span className="text-[11px]">contains {allergens.join(' · ')}</span>
                    )}
                  </div>
                )}

                {/* Action row: qty stepper + remove. Lives below so the row
                    works at narrow widths (basket on a phone). */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Controller
                    control={form.control}
                    name={`items.${idx}.quantity`}
                    render={({ field }) => (
                      <div className="inline-flex items-center rounded-full border border-cocoa-700/20 bg-cream-50">
                        <button
                          type="button"
                          className="h-9 w-9 text-cocoa-700 hover:bg-cream-100 rounded-l-full disabled:opacity-30 inline-flex items-center justify-center transition-colors"
                          disabled={Number(field.value) <= 1}
                          onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                          className="h-9 w-10 text-center bg-transparent text-sm font-medium tabular-nums focus:outline-none"
                          aria-label="Quantity"
                        />
                        <button
                          type="button"
                          className="h-9 w-9 text-cocoa-700 hover:bg-cream-100 rounded-r-full inline-flex items-center justify-center transition-colors"
                          onClick={() => field.onChange(Number(field.value) + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => fields.length > 1 && remove(idx)}
                    disabled={fields.length <= 1}
                    aria-label="Remove cake"
                    className="inline-flex items-center gap-1 text-xs text-cocoa-900/55 hover:text-berry disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1.5 rounded-md hover:bg-berry/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => append({ product_id: products.find((p) => p.in_stock)?.id ?? products[0]?.id ?? '', quantity: 1 })}
        className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cocoa-700/25 bg-cream-50/40 py-4 text-sm font-medium text-cocoa-900/75 hover:border-sky/50 hover:bg-sky/5 hover:text-sky-700 transition-colors"
      >
        <Plus className="h-4 w-4" /> Add another cake to this order
      </button>
    </div>
  )
}

function WhenStep({
  form,
  maxLead,
  mode,
}: {
  form: ReturnType<typeof useForm<FormValues>>
  maxLead: number
  mode: 'pickup' | 'delivery'
}) {
  // Hour-aware date+time picker — same widget the home hero uses, so the
  // /order step doesn't suddenly drop into the OS native datetime control.
  // Round-trips a single ISO string via react-hook-form's setValue.
  const scheduledAt = form.watch('scheduled_at_iso')
  return (
    <div className="mt-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label htmlFor="scheduled_at_iso">Pickup / delivery time</Label>
          <div className="mt-1.5">
            <DateTimePicker
              id="scheduled_at_iso"
              value={scheduledAt}
              onChange={(iso) => form.setValue('scheduled_at_iso', iso, { shouldValidate: true })}
              minLeadHours={maxLead || undefined}
            />
          </div>
          {form.formState.errors.scheduled_at_iso && (
            <p className="mt-1 text-xs text-berry">
              {form.formState.errors.scheduled_at_iso.message}
            </p>
          )}
        </div>
        <div>
          <Label>How would you like it?</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(
              [
                { mode: 'pickup', label: 'Pickup', icon: Store, hint: 'Free at our shop' },
                { mode: 'delivery', label: 'Delivery', icon: Truck, hint: 'Greater Houston' },
              ] as const
            ).map(({ mode: m, label, icon: Icon, hint }) => {
              const value = form.watch('pickup_or_delivery')
              const active = value === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => form.setValue('pickup_or_delivery', m)}
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
          <p className="mt-1.5 text-xs text-cocoa-900/60">
            {mode === 'delivery'
              ? 'Delivery in Sugar Land + Greater Houston only. Fee confirmed at order time.'
              : 'Pickup is free at our Promenade Way location.'}
          </p>
        </div>
      </div>

      {mode === 'delivery' && (
        <div className="mt-5 rounded-lg border border-cocoa-700/15 bg-cream-100 p-5">
          <p className="text-sm font-medium text-cocoa-900">Delivery address</p>
          <p className="mt-1 text-xs text-cocoa-900/65">
            We deliver to {DELIVERY_CITIES.slice(0, 5).join(', ')}, and Greater Houston (ZIPs starting 770–777).
            Outside that? <a href="/chat" className="text-sky-700 underline">Message us</a> for a custom quote.
          </p>
          <div className="mt-4">
            <AddressAutocomplete
              value={{
                street: form.watch('street') ?? '',
                city: form.watch('city') ?? '',
                state: form.watch('state') ?? '',
                zip: form.watch('zip') ?? '',
              }}
              onChange={(next) => {
                form.setValue('street', next.street, { shouldDirty: true, shouldValidate: false })
                form.setValue('city', next.city, { shouldDirty: true, shouldValidate: false })
                form.setValue('state', next.state, { shouldDirty: true, shouldValidate: false })
                form.setValue('zip', next.zip, { shouldDirty: true, shouldValidate: false })
              }}
              errors={{
                street: form.formState.errors.street?.message as string | undefined,
                city: form.formState.errors.city?.message as string | undefined,
                state: form.formState.errors.state?.message as string | undefined,
                zip: form.formState.errors.zip?.message as string | undefined,
              }}
              cityHints={DELIVERY_CITIES}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ContactStep({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customer_name">Your name</Label>
          <Input id="customer_name" autoComplete="name" {...form.register('customer_name')} className="mt-1" />
          {form.formState.errors.customer_name && (
            <p className="mt-1 text-xs text-berry">{form.formState.errors.customer_name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="customer_phone">Phone or WhatsApp</Label>
          <Input
            id="customer_phone"
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 555 1234"
            {...form.register('customer_phone')}
            className="mt-1"
          />
          {form.formState.errors.customer_phone && (
            <p className="mt-1 text-xs text-berry">{form.formState.errors.customer_phone.message}</p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes for the kitchen (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Birthday name on top, no walnuts, ring the bell at the side door — anything we should know."
          {...form.register('notes')}
          className="mt-1"
        />
      </div>
    </div>
  )
}

// Stripe-Elements-style placeholder. Visual only — no token round-trip.
// Square does the real capture after Askhat approves the draft (the
// owner-side TG card already carries a "card on file" hint from the
// composedNotes line). The visible copy is honest: "test mode, capture
// after approval, no charge yet".
function PaymentStep({
  payment,
  setPayment,
  error,
  total,
}: {
  payment: PaymentState
  setPayment: (p: PaymentState) => void
  error: string | null
  total: number
}) {
  function autofillTestCard() {
    setPayment({
      ...payment,
      cardholder: payment.cardholder || 'Test Customer',
      number: '4242 4242 4242 4242',
      expiry: '12 / 27',
      cvc: '123',
    })
  }
  function formatCardNumber(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 19)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }
  function formatExpiry(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)} / ${digits.slice(2)}`
  }
  return (
    <div className="mt-6 space-y-5">
      {/* Test-mode banner — explicit so customers (and reviewers) know
          this isn't a live charge surface in the hackathon build. */}
      <div className="rounded-2xl border border-sky/30 bg-sky/5 p-4 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="text-sm text-cocoa-900/85 leading-relaxed">
          <p className="font-medium text-cocoa-900">Test mode · no charge yet</p>
          <p className="mt-1 text-cocoa-900/70">
            Card details are captured here so Askhat sees them with the order. The actual
            charge happens via Square <strong>after</strong> he approves the draft and confirms
            the cake by phone — never before.
          </p>
          <button
            type="button"
            onClick={autofillTestCard}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 underline-offset-4 hover:underline"
          >
            Autofill Stripe test card (4242 4242 4242 4242)
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-cocoa-700/15 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-cocoa-900">
            <CreditCard className="h-5 w-5 text-sky-700" />
            <span className="font-medium">Pay by card</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-cocoa-900/45">
            <Lock className="h-3 w-3" />
            secured
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="cardholder">Name on card</Label>
            <Input
              id="cardholder"
              value={payment.cardholder}
              autoComplete="cc-name"
              onChange={(e) => setPayment({ ...payment, cardholder: e.target.value })}
              placeholder="As it appears on the card"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="card-number">Card number</Label>
            <Input
              id="card-number"
              value={payment.number}
              autoComplete="cc-number"
              inputMode="numeric"
              onChange={(e) => setPayment({ ...payment, number: formatCardNumber(e.target.value) })}
              placeholder="4242 4242 4242 4242"
              className="mt-1 font-mono tracking-wider"
            />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <Label htmlFor="card-exp">Expires</Label>
              <Input
                id="card-exp"
                value={payment.expiry}
                autoComplete="cc-exp"
                inputMode="numeric"
                onChange={(e) => setPayment({ ...payment, expiry: formatExpiry(e.target.value) })}
                placeholder="MM / YY"
                className="mt-1 font-mono tracking-wider"
              />
            </div>
            <div>
              <Label htmlFor="card-cvc">CVC</Label>
              <Input
                id="card-cvc"
                value={payment.cvc}
                autoComplete="cc-csc"
                inputMode="numeric"
                maxLength={4}
                onChange={(e) =>
                  setPayment({ ...payment, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
                placeholder="123"
                className="mt-1 font-mono tracking-wider"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm text-cocoa-900/80 cursor-pointer">
            <input
              type="checkbox"
              checked={payment.saveForNext}
              onChange={(e) => setPayment({ ...payment, saveForNext: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-cocoa-700/30 text-sky-700 focus:ring-sky/40"
            />
            <span>
              Save my card for next time, securely via Square. Easy to remove from your
              <Link href="/policies" className="underline ml-1">profile</Link>.
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-4 text-sm text-berry bg-berry/10 rounded-lg p-3" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Subtotal echo + payment policy. Mirrors the basket sidebar so a
          customer on a small viewport (basket below the form) still sees
          the total before they submit. */}
      <div className="rounded-2xl bg-cream-100 border border-cocoa-700/10 p-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-cocoa-900/70">Authorising today</span>
          <span className="text-2xl font-medium text-cocoa-900 tabular-nums">{fmtUsd(total)}</span>
        </div>
        <p className="mt-2 text-xs text-cocoa-900/60 leading-relaxed">
          Authorisation only. Captured after Askhat approves and confirms by phone — usually
          within the hour during open hours. Cancel free until capture.
        </p>
      </div>
    </div>
  )
}

function BasketAside({
  watchItems,
  products,
  mode,
  total,
  stepIdx,
  onAddMore,
}: {
  watchItems: FormValues['items']
  products: Product[]
  mode: 'pickup' | 'delivery'
  total: number
  stepIdx: number
  onAddMore: () => void
}) {
  // Custom designs and catering volume need Askhat to approve before the
  // kitchen sees the order; standard catalog auto-approves and goes
  // straight to the kitchen (matches the backend split in PR #101). The
  // step subtext below mirrors that so we don't promise a manual review
  // when there isn't one.
  const requiresApproval = watchItems.some((it) => {
    const p = products.find((x) => x.id === it.product_id)
    return p?.kind === 'custom' || p?.kind === 'catering'
  })
  return (
    <aside className="lg:sticky lg:top-28 self-start rounded-lg bg-cream-100 border border-cocoa-700/15 p-6">
      <p className="eyebrow">Order summary</p>
      <h2 className="display-h3 mt-1">Your basket</h2>
      {/* Surface the carried-over pickup/delivery choice prominently so the
          customer sees the home-form selection persisted into the wizard. */}
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white border border-cocoa-700/15 px-3 h-7 text-xs font-medium text-cocoa-900">
        {mode === 'delivery' ? (
          <>
            <Truck className="h-3.5 w-3.5 text-sky-700" /> Delivery
          </>
        ) : (
          <>
            <Store className="h-3.5 w-3.5 text-sky-700" /> Pickup
          </>
        )}
      </div>
      <ul className="mt-4 divide-y divide-cocoa-700/15">
        {watchItems.map((it, i) => {
          const p = products.find((x) => x.id === it.product_id)
          if (!p) return null
          return (
            <li key={i} className="py-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-cocoa-900">
                {p.name}
                <span className="text-cocoa-900/60"> × {it.quantity}</span>
              </span>
              <span className="font-medium text-cocoa-900">
                {fmtUsd(p.price_cents * Number(it.quantity || 0))}
              </span>
            </li>
          )
        })}
      </ul>
      {/* Always-on shortcut back to step 1. From later steps it's the only
          way to add another cake without losing the address / contact
          inputs the user already filled in. */}
      <button
        type="button"
        onClick={onAddMore}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-cocoa-700/30 py-2 text-xs font-medium text-cocoa-900/75 hover:border-cocoa-700/60 hover:bg-white hover:text-cocoa-900 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add another cake
      </button>
      <div className="mt-4 border-t border-cocoa-700/15 pt-4 flex items-end justify-between">
        <span className="text-xs uppercase tracking-[0.16em] text-cocoa-900/60">Subtotal</span>
        <span className="text-2xl font-medium text-cocoa-900">{fmtUsd(total)}</span>
      </div>
      <p className="mt-2 text-xs text-cocoa-900/60">
        Tax and {mode === 'delivery' ? 'delivery fee' : 'any extras'} confirmed at checkout. Payment by card via
        Square at confirmation, cash at pickup, or Zelle.
      </p>
      <p className="mt-4 text-xs text-cocoa-900/55">
        Step {stepIdx + 1} of {STEPS.length} —{' '}
        {requiresApproval
          ? 'Askhat reviews custom and catering orders within an hour during open hours.'
          : "We'll queue the kitchen as soon as we open — no need to wait for an approval."}
      </p>
    </aside>
  )
}

function defaultPickupTime() {
  const d = new Date(Date.now() + 26 * 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  return toLocalDatetimeValue(d)
}

function toLocalDatetimeValue(d: Date) {
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60 * 1000)
  return local.toISOString().slice(0, 16)
}
