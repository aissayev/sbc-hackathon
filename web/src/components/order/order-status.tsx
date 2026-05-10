'use client'

import * as React from 'react'
import type { OrderStatus } from '@/lib/api'
import { fmtUsd, fmtRelativeDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, ChefHat, Package, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<string, { label: string; tone: 'default' | 'blue' | 'sage' | 'coral' }> = {
  draft: { label: 'Sent · awaiting Askhat', tone: 'blue' },
  approved: { label: 'Approved · in the kitchen', tone: 'blue' },
  in_kitchen: { label: 'Baking', tone: 'blue' },
  ready: { label: 'Ready for pickup', tone: 'sage' },
  out_for_delivery: { label: 'On the way', tone: 'sage' },
  picked_up: { label: 'Picked up', tone: 'sage' },
  completed: { label: 'Completed', tone: 'sage' },
  rejected: { label: 'Cannot fulfill', tone: 'coral' },
  cancelled: { label: 'Cancelled', tone: 'coral' },
}

const STEPS: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'draft', label: 'Sent', icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'in_kitchen', label: 'In the kitchen', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: Package },
]

const STEP_INDEX: Record<string, number> = {
  draft: 0,
  approved: 1,
  in_kitchen: 2,
  ready: 3,
  out_for_delivery: 3,
  picked_up: 3,
  completed: 3,
}

export function OrderStatusView({ initial }: { initial: OrderStatus }) {
  const [order, setOrder] = React.useState(initial)
  const [polling, setPolling] = React.useState(true)

  React.useEffect(() => {
    if (!polling) return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' })
        if (!res.ok) return
        const next = (await res.json()) as OrderStatus
        if (next.status !== order.status) setOrder(next)
        if (['completed', 'picked_up', 'rejected', 'cancelled'].includes(next.status)) setPolling(false)
      } catch {}
    }, 6000)
    return () => clearInterval(id)
  }, [order.id, order.status, polling])

  const status = STATUS_LABEL[order.status] ?? { label: order.status, tone: 'default' as const }
  const stepIdx = STEP_INDEX[order.status] ?? 0
  const failed = order.status === 'rejected' || order.status === 'cancelled'

  return (
    <div className="rounded-lg border border-cocoa-700/15 bg-white p-6 md:p-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">Order #{order.id.slice(-8)}</p>
          <h2 className="display-h2 mt-1">
            {order.status === 'draft'
              ? 'Order received!'
              : order.status === 'ready'
              ? 'Ready for pickup'
              : order.status === 'completed'
              ? 'Thank you'
              : 'Order on the way'}
          </h2>
        </div>
        <Badge variant={status.tone}>{status.label}</Badge>
      </div>

      {!failed && (
        <ol className="mt-8 grid grid-cols-4 gap-3">
          {STEPS.map((s, i) => {
            const done = i <= stepIdx
            const Icon = s.icon
            return (
              <li
                key={s.key}
                className={cn(
                  'rounded-md p-3 text-center text-xs border',
                  done
                    ? 'border-cocoa-700 bg-cocoa-700/5 text-cocoa-900'
                    : 'border-cocoa-700/15 bg-cream-50 text-cocoa-900/40',
                )}
              >
                <Icon className={cn('h-5 w-5 mx-auto', done ? 'text-cocoa-700' : 'text-cocoa-900/30')} />
                <span className="mt-1 block">{s.label}</span>
              </li>
            )
          })}
        </ol>
      )}

      {failed && (
        <div className="mt-6 rounded-md bg-berry/10 p-4 text-berry flex items-start gap-2">
          <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{status.label}</p>
            <p className="text-sm mt-1">
              We sent you a message with the reason. If anything's unclear, reply on WhatsApp and
              we'll make it right.
            </p>
          </div>
        </div>
      )}

      <dl className="mt-8 grid sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
        <div className="flex justify-between border-b border-cocoa-700/10 pb-2">
          <dt className="text-cocoa-900/60">Total</dt>
          <dd className="font-medium">{fmtUsd(order.total_cents)}</dd>
        </div>
        <div className="flex justify-between border-b border-cocoa-700/10 pb-2">
          <dt className="text-cocoa-900/60">Method</dt>
          <dd className="capitalize">{order.pickup_or_delivery}</dd>
        </div>
        {order.scheduled_at && (
          <div className="flex justify-between border-b border-cocoa-700/10 pb-2">
            <dt className="text-cocoa-900/60">Scheduled</dt>
            <dd>{fmtRelativeDate(order.scheduled_at)}</dd>
          </div>
        )}
        {order.customer_name && (
          <div className="flex justify-between border-b border-cocoa-700/10 pb-2">
            <dt className="text-cocoa-900/60">Name</dt>
            <dd>{order.customer_name}</dd>
          </div>
        )}
      </dl>

      {order.items?.length ? (
        <div className="mt-6">
          <p className="eyebrow">In the box</p>
          <ul className="mt-2 divide-y divide-cocoa-700/10">
            {order.items.map((it) => (
              <li key={it.sku} className="py-2 flex justify-between text-sm">
                <span>
                  {it.name}
                  <span className="text-cocoa-900/60"> × {it.qty}</span>
                </span>
                <span className="font-medium">{fmtUsd(it.line_total_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {polling && !failed && (
        <p className="mt-6 text-xs text-cocoa-900/60">
          Live status — this page refreshes every few seconds.
        </p>
      )}
    </div>
  )
}
