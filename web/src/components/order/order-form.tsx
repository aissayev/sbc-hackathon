'use client'

import * as React from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'

import type { Product } from '@/lib/api'
import { fmtUsd, leadTimeLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const schema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Pick a cake'),
        quantity: z.coerce.number().int().positive().max(50),
      }),
    )
    .min(1, 'Add at least one cake'),
  scheduled_at_iso: z.string().min(1, 'When would you like it?'),
  pickup_or_delivery: z.enum(['pickup', 'delivery']),
  customer_name: z.string().min(1, 'Your name'),
  customer_phone: z.string().min(7, 'Phone or WhatsApp number'),
  notes: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function OrderForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seededProduct = searchParams.get('product') ?? products[0]?.id ?? ''
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const minWhen = React.useMemo(() => {
    const minDate = new Date(Date.now() + 60 * 60 * 1000)
    minDate.setSeconds(0, 0)
    return toLocalDatetimeValue(minDate)
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      items: [{ product_id: seededProduct, quantity: 1 }],
      scheduled_at_iso: defaultPickupTime(),
      pickup_or_delivery: 'pickup',
      customer_name: '',
      customer_phone: '',
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchItems = form.watch('items')

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

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        ...values,
        scheduled_at_iso: new Date(values.scheduled_at_iso).toISOString(),
      }
      const res = await fetch('/api/orders/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, channel: 'web' }),
      })
      const data = (await res.json()) as { ok: boolean; order_id?: string; reason?: string }
      if (!data.ok || !data.order_id) {
        setError(data.reason ?? 'Something went wrong on our side. Try again, or chat with us.')
        return
      }
      router.push(`/order/confirm/${data.order_id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <section>
          <h2 className="display-h3">1 · What would you like?</h2>
          <p className="mt-1 text-sm text-cocoa-900/70">
            Add cakes one at a time. Quantities are whole cakes or slices, depending on the item.
          </p>
          <div className="mt-5 space-y-3">
            {fields.map((field, idx) => {
              const product = products.find((p) => p.id === watchItems[idx]?.product_id)
              return (
                <div key={field.id} className="rounded-md border border-cocoa-700/15 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <div>
                      <Label htmlFor={`item-${idx}`}>Cake</Label>
                      <Controller
                        control={form.control}
                        name={`items.${idx}.product_id`}
                        render={({ field }) => (
                          <select
                            {...field}
                            id={`item-${idx}`}
                            className="mt-1 flex h-11 w-full rounded-md border border-cocoa-700/20 bg-white px-3 text-sm"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {fmtUsd(p.price_cents)}
                              </option>
                            ))}
                          </select>
                        )}
                      />
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ product_id: products[0]?.id ?? '', quantity: 1 })}
            >
              <Plus className="h-4 w-4" /> Add another cake
            </Button>
          </div>
        </section>

        <section>
          <h2 className="display-h3">2 · When would you like it?</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="scheduled_at_iso">Pickup / delivery time</Label>
              <Input
                id="scheduled_at_iso"
                type="datetime-local"
                min={minWhen}
                {...form.register('scheduled_at_iso')}
                className="mt-1"
              />
              {form.formState.errors.scheduled_at_iso && (
                <p className="mt-1 text-xs text-berry">
                  {form.formState.errors.scheduled_at_iso.message}
                </p>
              )}
              {maxLead > 0 && (
                <p className="mt-1 text-xs text-cocoa-900/60">
                  Earliest possible: {leadTimeLabel(maxLead).toLowerCase()} from now.
                </p>
              )}
            </div>
            <div>
              <Label>How would you like it?</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['pickup', 'delivery'] as const).map((mode) => {
                  const value = form.watch('pickup_or_delivery')
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => form.setValue('pickup_or_delivery', mode)}
                      className={cn(
                        'h-11 rounded-md border text-sm font-medium capitalize transition-colors',
                        value === mode
                          ? 'border-cocoa-700 bg-cocoa-700 text-cream-50'
                          : 'border-cocoa-700/20 bg-white text-cocoa-900 hover:bg-cream-100',
                      )}
                    >
                      {mode}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-cocoa-900/60">
                Pickup is free. Delivery fee confirmed at order time.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="display-h3">3 · How do we reach you?</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="customer_name">Your name</Label>
              <Input id="customer_name" {...form.register('customer_name')} className="mt-1" />
              {form.formState.errors.customer_name && (
                <p className="mt-1 text-xs text-berry">{form.formState.errors.customer_name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="customer_phone">Phone or WhatsApp</Label>
              <Input
                id="customer_phone"
                placeholder="+1 555 555 1234"
                {...form.register('customer_phone')}
                className="mt-1"
              />
              {form.formState.errors.customer_phone && (
                <p className="mt-1 text-xs text-berry">{form.formState.errors.customer_phone.message}</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="notes">Notes for the kitchen (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Birthday name on top, no walnuts, ring the bell at the side door — anything we should know."
              {...form.register('notes')}
              className="mt-1"
            />
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-28 self-start rounded-lg bg-cream-100 border border-cocoa-700/15 p-6">
        <p className="eyebrow">Order summary</p>
        <h2 className="display-h3 mt-1">Your basket</h2>
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
        <div className="mt-4 border-t border-cocoa-700/15 pt-4 flex items-end justify-between">
          <span className="text-xs uppercase tracking-[0.16em] text-cocoa-900/60">Subtotal</span>
          <span className="text-2xl font-medium text-cocoa-900">{fmtUsd(total)}</span>
        </div>
        <p className="mt-2 text-xs text-cocoa-900/60">
          Tax and delivery (if any) are confirmed at checkout. Payment by card via Square at
          confirmation, cash at pickup, or Zelle.
        </p>
        {error && (
          <p className="mt-3 text-sm text-berry bg-berry/10 rounded-md p-3" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={submitting} className="mt-6 w-full">
          <ShoppingBag /> {submitting ? 'Sending to kitchen…' : 'Send order'}
        </Button>
        <p className="mt-3 text-xs text-cocoa-900/60">
          Askhat reviews and confirms within an hour during open hours.
        </p>
      </aside>
    </form>
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
