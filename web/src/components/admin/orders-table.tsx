// Responsive orders table for the owner cockpit.
//
// Desktop / tablet: real <table> with <thead>, scannable columns.
// Mobile (< md):    each row stacks into a card — the prior layout but
//                   tightened up. Inside a Telegram Mini App the phone
//                   viewport hits this branch, which is the right read
//                   for thumb-scroll.
//
// Used by /admin/today (last N orders) and /admin/orders (sectioned by
// status). Approval-reason chips are opt-in via `showApprovalReasons`
// since /admin/today doesn't need them and the row is more readable
// without.

import Link from 'next/link'
import type { OrderStatus } from '@/lib/api'
import { fmtUsd, fmtRelativeDate, displayOrderId } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Sparkles, UtensilsCrossed, Cake } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrdersTableProps {
  orders: OrderStatus[]
  showApprovalReasons?: boolean
  /** Render rows at reduced opacity (for "closed" sections). */
  muted?: boolean
}

export function OrdersTable({ orders, showApprovalReasons, muted }: OrdersTableProps) {
  return (
    <div className={cn('rounded-md border border-cocoa-700/15 bg-white overflow-hidden', muted && 'opacity-80')}>
      {/* ── Desktop / tablet: real table ── */}
      <table className="hidden md:table w-full text-sm">
        <thead>
          <tr className="bg-cream-100 text-[11px] uppercase tracking-[0.12em] text-cocoa-900/55">
            <th className="text-left font-medium px-4 py-2.5 w-20">Order</th>
            <th className="text-left font-medium px-4 py-2.5">Customer</th>
            <th className="text-right font-medium px-4 py-2.5 w-24">Total</th>
            <th className="text-left font-medium px-4 py-2.5 w-44">Pickup</th>
            <th className="text-left font-medium px-4 py-2.5 w-32">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cocoa-700/10">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-cream-50/60 transition-colors">
              <td className="px-4 py-3 align-middle">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="font-medium text-cocoa-900 hover:text-cocoa-700 tabular-nums"
                  title={o.id}
                >
                  {displayOrderId(o, 'short')}
                </Link>
              </td>
              <td className="px-4 py-3 align-middle min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-cocoa-900 truncate max-w-[16rem]">{o.customer_name ?? '—'}</span>
                  {showApprovalReasons && (
                    <ApprovalReasonChips reasons={o.approval_reasons} status={o.status} />
                  )}
                </div>
              </td>
              <td className="px-4 py-3 align-middle text-right tabular-nums text-cocoa-900">
                {fmtUsd(o.total_cents)}
              </td>
              <td className="px-4 py-3 align-middle text-cocoa-900/70">
                {o.scheduled_at ? fmtRelativeDate(o.scheduled_at) : <span className="text-cocoa-900/40">—</span>}
              </td>
              <td className="px-4 py-3 align-middle">
                <Badge variant={statusTone(o.status)}>{o.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Mobile: stacked rows (no <thead>; the badge + total carry the meaning) ── */}
      <ul className="md:hidden divide-y divide-cocoa-700/10">
        {orders.map((o) => (
          <li key={o.id} className="p-4 flex items-start gap-3 justify-between flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="font-medium text-cocoa-900 hover:text-cocoa-700 tabular-nums text-sm"
                  title={o.id}
                >
                  {displayOrderId(o, 'short')}
                </Link>
                <span className="text-sm text-cocoa-900/70 truncate">{o.customer_name ?? '—'}</span>
                {showApprovalReasons && (
                  <ApprovalReasonChips reasons={o.approval_reasons} status={o.status} />
                )}
              </div>
              {o.scheduled_at && (
                <p className="mt-0.5 text-xs text-cocoa-900/60">{fmtRelativeDate(o.scheduled_at)}</p>
              )}
            </div>
            <div className="text-sm flex items-center gap-2 shrink-0">
              <span className="tabular-nums text-cocoa-900">{fmtUsd(o.total_cents)}</span>
              <Badge variant={statusTone(o.status)}>{o.status}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function statusTone(status: string): 'default' | 'blue' | 'sage' | 'coral' {
  switch (status) {
    case 'draft':
    case 'refund_pending':
      return 'blue'
    case 'approved':
    case 'in_kitchen':
    case 'ready':
    case 'out_for_delivery':
      return 'default'
    case 'completed':
    case 'picked_up':
      return 'sage'
    case 'rejected':
    case 'cancelled':
    case 'refunded':
      return 'coral'
    default:
      return 'default'
  }
}

// Per-row WHY chip. Drafts show what triggered approval; non-draft rows
// show "auto" for standard orders that bypassed the approval queue.
function ApprovalReasonChips({ reasons, status }: { reasons?: string[]; status: string }) {
  const list = reasons ?? []
  if (status === 'draft' && list.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        {list.map((r) => <ReasonChip key={r} reason={r} />)}
      </span>
    )
  }
  if (status !== 'draft' && list.length === 0 && !['rejected', 'cancelled'].includes(status)) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium bg-emerald-100 text-emerald-800"
        title="Standard catalog item — auto-approved, went straight to kitchen"
      >
        <Cake className="h-2.5 w-2.5" />
        auto
      </span>
    )
  }
  return null
}

function ReasonChip({ reason }: { reason: string }) {
  const meta =
    reason === 'custom'
      ? { label: 'custom design', Icon: Sparkles, tone: 'bg-pink-100 text-pink-800' }
      : reason === 'catering'
      ? { label: 'catering', Icon: UtensilsCrossed, tone: 'bg-amber-100 text-amber-800' }
      : { label: reason, Icon: Sparkles, tone: 'bg-cocoa-700/10 text-cocoa-900/75' }
  const Icon = meta.Icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium',
        meta.tone,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}
