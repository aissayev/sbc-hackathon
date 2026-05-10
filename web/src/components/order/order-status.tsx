'use client'

import * as React from 'react'
import type { OrderStatus } from '@/lib/api'
import { fmtUsd, fmtRelativeDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Package,
  XCircle,
  Copy,
  Check,
  Cake,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Cake-themed status copy. Two flows fan out from here:
//
//   - Standard catalog (slices, whole cakes, pastries): auto-approves on
//     submit, so the customer never sees a "draft / awaiting Askhat" state
//     in normal conditions. The tracker shows 3 steps:
//     Order received → In the kitchen → Ready.
//
//   - Custom designs / catering: needs Askhat to approve before the
//     kitchen starts. Tracker shows the full 4-step rail with the
//     explicit "Approved" gate. Status copy on the badge changes
//     accordingly.
//
// The split is driven by `order.requires_approval` from the backend.
type StatusTone = 'default' | 'blue' | 'sage' | 'coral'

function statusLabel(status: string, requiresApproval: boolean): { label: string; tone: StatusTone } {
  switch (status) {
    case 'draft':
      return requiresApproval
        ? { label: 'Sent · awaiting Askhat', tone: 'blue' }
        : { label: 'Order received · queueing kitchen', tone: 'blue' }
    case 'approved':
      return requiresApproval
        ? { label: 'Approved · queued for the kitchen', tone: 'blue' }
        : { label: 'Order received · queued for the kitchen', tone: 'blue' }
    case 'in_kitchen':
      return { label: 'Hands on the bench — baking now', tone: 'blue' }
    case 'ready':
      return { label: 'Ready · come grab it', tone: 'sage' }
    case 'out_for_delivery':
      return { label: 'On its way to you', tone: 'sage' }
    case 'picked_up':
      return { label: 'Picked up · enjoy', tone: 'sage' }
    case 'completed':
      return { label: 'Completed · thank you', tone: 'sage' }
    case 'rejected':
      return { label: "Couldn't fulfill", tone: 'coral' }
    case 'cancelled':
      return { label: 'Cancelled', tone: 'coral' }
    default:
      return { label: status, tone: 'default' }
  }
}

interface Step {
  key: string
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}

// 4-step rail for orders that need Askhat to approve first.
const STEPS_WITH_APPROVAL: Step[] = [
  { key: 'draft', label: 'Order received', hint: 'Askhat will look within the hour', icon: Clock },
  { key: 'approved', label: 'Approved', hint: 'Confirmed by phone or WhatsApp', icon: CheckCircle2 },
  { key: 'in_kitchen', label: 'In the kitchen', hint: 'Layered, custarded, decorated', icon: ChefHat },
  { key: 'ready', label: 'Ready', hint: 'Pick up at Promenade Way', icon: Package },
]

// 3-step rail for the auto-approved standard catalog. We collapse "draft"
// and "approved" into a single "Order received" step that's marked done
// the moment the kitchen has the ticket — which is approximately instant
// since /api/orders/draft promotes in the background.
const STEPS_AUTO: Step[] = [
  { key: 'received', label: 'Order received', hint: 'Confirmed and queued for the kitchen', icon: CheckCircle2 },
  { key: 'in_kitchen', label: 'In the kitchen', hint: 'Layered, custarded, decorated', icon: ChefHat },
  { key: 'ready', label: 'Ready', hint: 'Pick up at Promenade Way', icon: Package },
]

// Status → step index, computed per rail.
function stepIndexFor(status: string, requiresApproval: boolean): number {
  if (requiresApproval) {
    switch (status) {
      case 'draft':
        return 0
      case 'approved':
        return 1
      case 'in_kitchen':
        return 2
      case 'ready':
      case 'out_for_delivery':
      case 'picked_up':
      case 'completed':
        return 3
      default:
        return 0
    }
  }
  // Auto-approve rail (3 steps).
  switch (status) {
    case 'draft':
    case 'approved':
      // Both states show the first step as "active" — for standard orders
      // 'draft' is fleeting (auto-promotes within seconds) and 'approved'
      // means the kitchen has the ticket but hasn't accepted yet.
      return 0
    case 'in_kitchen':
      return 1
    case 'ready':
    case 'out_for_delivery':
    case 'picked_up':
    case 'completed':
      return 2
    default:
      return 0
  }
}

export function OrderStatusView({ initial }: { initial: OrderStatus }) {
  const [order, setOrder] = React.useState(initial)
  const [polling, setPolling] = React.useState(true)

  React.useEffect(() => {
    if (!polling) return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return
        // Same proxy/rewrite-misconfig defense as the chat widget — bail
        // quietly if the response isn't JSON, so polling doesn't trip on
        // an HTML 200 from the SPA shell.
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('application/json')) return
        const next = (await res.json()) as OrderStatus
        if (next.status !== order.status) setOrder(next)
        if (['completed', 'picked_up', 'rejected', 'cancelled'].includes(next.status)) setPolling(false)
      } catch {}
    }, 6000)
    return () => clearInterval(id)
  }, [order.id, order.status, polling])

  // requires_approval comes from the backend (derived from item categories).
  // Default to false — i.e. the simpler 3-step rail — if the field is
  // missing, since legacy orders pre-dating this flag were the standard
  // catalog and effectively auto-approve in retrospect.
  const requiresApproval = order.requires_approval ?? false
  const status = statusLabel(order.status, requiresApproval)
  const steps = requiresApproval ? STEPS_WITH_APPROVAL : STEPS_AUTO
  const stepIdx = stepIndexFor(order.status, requiresApproval)
  const failed = order.status === 'rejected' || order.status === 'cancelled'

  return (
    <div className="rounded-2xl border border-cocoa-700/15 bg-white p-6 md:p-8 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">Order received</p>
          <h2 className="display-h2 mt-1">
            {order.status === 'ready'
              ? 'Ready for pickup'
              : order.status === 'completed' || order.status === 'picked_up'
              ? 'Thank you'
              : requiresApproval && order.status === 'draft'
              ? 'Order received!'
              : 'Order in the kitchen'}
          </h2>
        </div>
        <div className="inline-flex items-center gap-2">
          <Badge variant={status.tone}>{status.label}</Badge>
          <ShareButton orderId={order.id} />
        </div>
      </div>
      {/* Customer-facing id. Friendly alias (`HC-1042`) is the headline
          since that's what people read aloud over the phone; the full
          `ord_<ms>_<rand>` is shown as a secondary copy-able reference
          for support / chat-agent lookup. The backend's `getOrderStatus`
          accepts both forms so either resolves correctly. */}
      <OrderIdRef order={order} />

      {!failed && (
        <>
          {/* Horizontal step rail — like Domino's pizza tracker. Each step
              shows: icon (filled/glowing when done, current step pulses),
              label, hint copy. The connector line between steps fills sky
              when crossed. */}
          <ol
            className={cn(
              'mt-8 grid gap-2 sm:gap-3',
              steps.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
            )}
            aria-label="Order progress"
          >
            {steps.map((s, i) => {
              const done = i < stepIdx
              const current = i === stepIdx
              const Icon = s.icon
              return (
                <li key={s.key} className="relative">
                  <div
                    className={cn(
                      'rounded-2xl p-4 text-center border transition-colors',
                      done && 'border-emerald-300 bg-emerald-50',
                      current && 'border-sky-400 bg-sky/8 ring-2 ring-sky/20',
                      !done && !current && 'border-cocoa-700/12 bg-cream-50',
                    )}
                  >
                    <span
                      className={cn(
                        'mx-auto h-9 w-9 rounded-full inline-flex items-center justify-center transition-colors',
                        done && 'bg-emerald-500 text-white',
                        current && 'bg-sky text-white animate-pulse',
                        !done && !current && 'bg-cream-200 text-cocoa-900/40',
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <div
                      className={cn(
                        'mt-2 text-sm font-medium leading-tight',
                        current ? 'text-cocoa-900' : done ? 'text-emerald-800' : 'text-cocoa-900/55',
                      )}
                    >
                      {s.label}
                    </div>
                    <div
                      className={cn(
                        'mt-1 text-[11px] leading-snug',
                        current ? 'text-cocoa-900/75' : 'text-cocoa-900/45',
                      )}
                    >
                      {s.hint}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {/* Live ETA / scheduled-time hint immediately below the rail. */}
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-cocoa-900/70">
            <Cake className="h-4 w-4 text-sky-700" />
            {order.scheduled_at
              ? `Ready around ${fmtRelativeDate(order.scheduled_at)}`
              : requiresApproval
              ? 'Askhat reviews custom and catering orders within an hour during open hours.'
              : "We're queueing the kitchen now — we'll text you when it's ready."}
          </p>
        </>
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

// Reference / copy widget for the full order id. Customers paste this
// back into chat or the /track form; the input must be the *exact* id
// for an unambiguous lookup, so we make it impossible to mis-truncate.
function OrderIdRef({ order }: { order: { id: string; friendly_id?: string } }) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  // Copy whichever id is most useful: the long canonical one when no
  // friendly alias exists; otherwise the friendly alias (which the
  // backend lookup also accepts). Customers paste this back into chat /
  // the tracker and we want either form to resolve.
  const copyValue = order.friendly_id ?? order.id
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue)
      setCopied(true)
    } catch {
      const el = document.getElementById('order-id-ref')
      if (el && 'select' in el && typeof (el as HTMLInputElement).select === 'function') {
        (el as HTMLInputElement).select()
      }
    }
  }
  return (
    <div className="mt-3 space-y-1">
      {order.friendly_id && (
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-cocoa-900/55">Your order</span>
          <span className="font-display text-lg text-cocoa-900 font-semibold tracking-tight">
            {order.friendly_id}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-cocoa-900/55">{order.friendly_id ? 'Reference' : 'Order id'}</span>
        <input
          id="order-id-ref"
          readOnly
          value={order.id}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-md border border-cocoa-700/15 bg-cream-50 px-2.5 py-1 font-mono text-[12px] text-cocoa-900/85"
        />
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy order id'}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors shrink-0',
            copied
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-cocoa-700/20 bg-white text-cocoa-900 hover:bg-cream-100',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

// Share button — uses Web Share API on mobile (the native share sheet),
// falls back to clipboard copy on desktop. Targets the short /track/<id>
// route so the recipient gets a clean tracker, not the full confirmation
// page.
function ShareButton({ orderId }: { orderId: string }) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  async function share() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/track/${orderId}` : ''
    const text = `Tracking my Happy Cake order — ${url}`
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Happy Cake order tracker', text, url })
        return
      } catch {
        // User cancelled or browser declined; fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard blocked too — last resort: open the URL so the user can
      // copy from the address bar.
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? 'Tracker link copied' : 'Share tracker link'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-cocoa-700/20 bg-white text-cocoa-900 hover:bg-cream-100',
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  )
}
