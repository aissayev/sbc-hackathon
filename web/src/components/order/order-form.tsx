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
} from 'lucide-react'

import type { Product } from '@/lib/api'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

// Three-step order wizard. Each step validates its own fields before letting
// the customer advance, so they don't get a wall of errors on send. The
// basket sidebar is sticky across all steps.
type StepKey = 'cakes' | 'when' | 'contact'

const STEPS: Array<{ key: StepKey; index: number; label: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'cakes', index: 1, label: 'What would you like?', subtitle: 'Pick the cakes and quantities.', icon: Cake },
  { key: 'when', index: 2, label: 'When + how', subtitle: 'Time, pickup or delivery, address.', icon: Clock },
  { key: 'contact', index: 3, label: 'Your details', subtitle: 'Where to reach you, plus any kitchen notes.', icon: UserRound },
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
  return ['customer_name', 'customer_phone'] as const
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
    const ok = await form.trigger(fields as Parameters<typeof form.trigger>[0])
    if (!ok) return
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))
  }

  function onBack() {
    setStepIdx((i) => Math.max(0, i - 1))
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setError(null)

    // Compose delivery address into a single human-readable string in `notes`
    // until the backend's order schema gains a structured `address` field.
    // This keeps the kitchen-facing ticket honest without changing the API.
    const addressLine =
      values.pickup_or_delivery === 'delivery'
        ? `Deliver to: ${values.street}, ${values.city}, ${values.state ?? 'TX'} ${values.zip}`
        : null
    const composedNotes = [addressLine, values.notes?.trim() || null].filter(Boolean).join('\n')

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
              <ShoppingBag /> {submitting ? 'Sending to kitchen…' : 'Send order'}
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
          We can't reach the kitchen catalog right now. Try refreshing — or message us on{' '}
          <Link href="/chat" className="text-sky-700 underline">chat</Link> and we'll take the
          order by hand.
        </div>
      )}
      {fields.map((field, idx) => {
        const product = products.find((p) => p.id === watchItems[idx]?.product_id)
        return (
          <div key={field.id} className="rounded-lg border border-cocoa-700/15 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <Label htmlFor={`item-${idx}`}>Cake</Label>
                <Controller
                  control={form.control}
                  name={`items.${idx}.product_id`}
                  render={({ field }) => (
                    <Select {...field} id={`item-${idx}`} className="mt-1">
                      <option value="" disabled>
                        Pick a cake from the case…
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {fmtUsd(p.price_cents)}
                        </option>
                      ))}
                    </Select>
                  )}
                />
                {form.formState.errors.items?.[idx]?.product_id && (
                  <p className="mt-1 text-xs text-berry">
                    {form.formState.errors.items[idx]?.product_id?.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Qty</Label>
                <Controller
                  control={form.control}
                  name={`items.${idx}.quantity`}
                  render={({ field }) => (
                    <div className="mt-1 inline-flex items-center rounded-md border border-cocoa-700/20 bg-white">
                      <button
                        type="button"
                        className="h-11 w-10 text-cocoa-700 hover:bg-cream-100 disabled:opacity-30"
                        disabled={Number(field.value) <= 1}
                        onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                        aria-label="Decrease"
                      >
                        <Minus className="h-4 w-4 mx-auto" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                        className="h-11 w-12 text-center bg-transparent border-x border-cocoa-700/15 text-sm"
                      />
                      <button
                        type="button"
                        className="h-11 w-10 text-cocoa-700 hover:bg-cream-100"
                        onClick={() => field.onChange(Number(field.value) + 1)}
                        aria-label="Increase"
                      >
                        <Plus className="h-4 w-4 mx-auto" />
                      </button>
                    </div>
                  )}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fields.length > 1 && remove(idx)}
                disabled={fields.length <= 1}
                aria-label="Remove cake"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {product?.description && (
              <p className="mt-3 text-sm text-cocoa-900/70">{product.description}</p>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-cocoa-900/60">
              <Badge variant="outline" className="text-[11px]">
                {leadTimeLabel(product?.lead_time_hours ?? 0)}
              </Badge>
              {product?.allergens && (
                <span>contains {product.allergens.split(',').map((s) => s.trim()).join(', ')}</span>
              )}
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => append({ product_id: products[0]?.id ?? '', quantity: 1 })}
        className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-cocoa-700/25 bg-cream-50/40 py-4 text-sm font-medium text-cocoa-900/75 hover:border-cocoa-700/50 hover:bg-cream-100 hover:text-cocoa-900 transition-colors"
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
        Step {stepIdx + 1} of {STEPS.length} — Askhat reviews and confirms within an hour during open hours.
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
