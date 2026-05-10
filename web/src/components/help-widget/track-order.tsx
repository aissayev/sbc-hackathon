'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { OrderStatus } from '@/lib/api'
import { ORDER_STATUS_LABEL } from '@/lib/widget'
import { fmtUsd, fmtRelativeDate, displayOrderId } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

// Fetch order status — TanStack Query polls every 8s while we have an id and
// the order isn't terminal (not completed/rejected/cancelled). Stops on
// terminal states so we don't keep hitting the backend forever.
//
// Defensive: guard against the proxy returning HTML on a 200 (e.g. when
// `BACKEND_URL` is misconfigured at deploy time and Next.js falls through
// to the SPA shell). Without the content-type check the user saw
// `Unexpected token '<', "<!DOCTYPE..."` — opaque and scary. Now they get
// a real explanation.
async function fetchOrder(id: string): Promise<OrderStatus | null> {
  if (!id) return null
  const res = await fetch(`/api/orders/${encodeURIComponent(id.trim())}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Couldn't fetch order — server returned ${res.status}.`)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    // Proxy / rewrite returned HTML (or text). Surface a useful error
    // instead of the JSON.parse blowup.
    throw new Error("We can't reach the order service right now. Try again in a moment.")
  }
  try {
    return (await res.json()) as OrderStatus
  } catch {
    throw new Error('Order service returned an unexpected response. Try again in a moment.')
  }
}

const TERMINAL = ['completed', 'picked_up', 'rejected', 'cancelled']

export function TrackOrder() {
  const [orderId, setOrderId] = React.useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('hc_track_id') ?? ''
  })
  const [submitted, setSubmitted] = React.useState(orderId)

  const query = useQuery({
    queryKey: ['order', submitted],
    queryFn: () => fetchOrder(submitted),
    enabled: submitted.length > 3,
    refetchInterval: (q) => {
      const status = (q.state.data as OrderStatus | null | undefined)?.status
      if (!status) return false
      return TERMINAL.includes(status) ? false : 8_000
    },
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(orderId.trim())
    try { localStorage.setItem('hc_track_id', orderId.trim()) } catch {}
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Order number (e.g. 1042)"
          inputMode="numeric"
          className="bg-bakery"
        />
        <Button type="submit" variant="sky" size="default" shape="pill" className="px-4 shrink-0">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Track</span>
        </Button>
      </form>

      {!submitted && (
        <p className="text-sm text-cocoa-900/65 leading-relaxed">
          Type the short order number from your confirmation — usually four digits like
          {' '}<span className="font-mono">1042</span>. We'll show the status live and update as
          the kitchen moves it through.
        </p>
      )}

      {submitted && query.isLoading && (
        <div className="rounded-2xl bg-cream-100 p-5 text-sm text-cocoa-900/70">Looking it up…</div>
      )}

      {submitted && query.error && (
        <div className="rounded-2xl bg-berry-100 p-4 text-sm text-berry">
          {(query.error as Error).message}
        </div>
      )}

      {submitted && !query.isLoading && query.data === null && (
        <div className="rounded-2xl bg-cream-100 p-5 text-sm text-cocoa-900/75">
          We couldn't find that order. Double-check the number, or message us in chat — we'll
          find it.
        </div>
      )}

      {query.data && <OrderCard order={query.data} />}
    </div>
  )
}

function OrderCard({ order }: { order: OrderStatus }) {
  const status = ORDER_STATUS_LABEL[order.status] ?? { label: order.status, tone: 'cocoa' as const }
  return (
    <div className="rounded-2xl border border-cocoa-700/15 bg-bakery p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-cocoa-700 text-cream inline-flex items-center justify-center">
          <Package className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-base text-cocoa-900 font-semibold tabular-nums truncate" title={order.id}>
            {displayOrderId(order)}
          </div>
          <div className="text-[12px] text-cocoa-900/70 truncate">{order.customer_name ?? '—'}</div>
        </div>
        <Badge variant={status.tone}>{status.label}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Row label="Total" value={fmtUsd(order.total_cents)} />
        <Row label="Method" value={order.pickup_or_delivery} cap />
        {order.scheduled_at && <Row label="Scheduled" value={fmtRelativeDate(order.scheduled_at)} />}
      </dl>
      {!TERMINAL.includes(order.status) && (
        <p className="mt-4 text-[11px] text-cocoa-900/55">Live — refreshes every few seconds.</p>
      )}
    </div>
  )
}

function Row({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <>
      <dt className="text-cocoa-900/55">{label}</dt>
      <dd className={cn('text-cocoa-900 text-right font-medium', cap && 'capitalize')}>{value}</dd>
    </>
  )
}
