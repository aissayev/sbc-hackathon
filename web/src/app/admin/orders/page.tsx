// Admin orders list. Three sections + clear approval rule.
//
// Approval rule (also rendered in the section header so it's visible
// without drilling in): standard catalog items (slices / whole cakes /
// pastries) auto-approve and head straight to the kitchen. Only `custom`
// and `catering` orders wait for owner approval. Each draft row shows
// the categories that triggered the requirement, so the owner sees WHY
// before clicking through.

import Link from 'next/link'
import { listAdminOrders, type OrderStatus } from '@/lib/api'
import { fmtUsd, fmtRelativeDate, displayOrderId } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Sparkles, UtensilsCrossed, Cake } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders()
  const draft = orders.filter((o) => o.status === 'draft')
  const live = orders.filter((o) => !['draft', 'completed', 'rejected', 'cancelled'].includes(o.status))
  const closed = orders.filter((o) => ['completed', 'rejected', 'cancelled'].includes(o.status))

  return (
    <div className="space-y-10">
      <Section
        title="Custom + catering · awaiting your approval"
        subtitle="Standard catalog orders skip this queue and go straight to the kitchen."
        tone="blue"
        empty="Nothing waiting — kitchen breathes."
        orders={draft}
      />
      <Section
        title="Live in the kitchen"
        subtitle="Auto-approved standard orders + custom orders you OK'd."
        empty="No active orders right now."
        orders={live}
      />
      <Section
        title="Closed today"
        empty="Nothing closed yet today."
        orders={closed.slice(0, 12)}
        muted
      />
    </div>
  )
}

function Section({
  title,
  subtitle,
  orders,
  empty,
  tone,
  muted,
}: {
  title: string
  subtitle?: string
  orders: OrderStatus[]
  empty: string
  tone?: 'blue'
  muted?: boolean
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <h2 className="display-h3">{title}</h2>
        {orders.length > 0 && tone === 'blue' && <Badge variant="blue">{orders.length}</Badge>}
      </div>
      {subtitle && <p className="mt-1 text-sm text-cocoa-900/60">{subtitle}</p>}
      {orders.length === 0 ? (
        <div className="mt-3 rounded-md bg-cream-100 p-6 text-sm text-cocoa-900/70">{empty}</div>
      ) : (
        <ul className={`mt-3 divide-y divide-cocoa-700/10 rounded-md border border-cocoa-700/15 bg-white ${muted ? 'opacity-80' : ''}`}>
          {orders.map((o) => (
            <li key={o.id} className="p-4 flex items-center gap-3 justify-between flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-medium text-cocoa-900 hover:text-cocoa-700 tabular-nums text-sm"
                    title={o.id}
                  >
                    {displayOrderId(o, 'short')}
                  </Link>
                  <span className="text-sm text-cocoa-900/70 truncate">{o.customer_name ?? '—'}</span>
                  <ApprovalReasonChips reasons={o.approval_reasons} status={o.status} />
                </div>
              </div>
              <div className="text-sm text-cocoa-900/70 flex items-center gap-3 shrink-0">
                <span>{fmtUsd(o.total_cents)}</span>
                {o.scheduled_at && <span>· {fmtRelativeDate(o.scheduled_at)}</span>}
                <Badge>{o.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Per-row WHY chip. Drafts show what triggered approval; non-draft rows
// in the live section show "Auto-approved" for standard orders so the
// owner can see at a glance which orders went through them vs not.
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
  const meta = reason === 'custom'
    ? { label: 'custom design', Icon: Sparkles, tone: 'bg-pink-100 text-pink-800' }
    : reason === 'catering'
    ? { label: 'catering', Icon: UtensilsCrossed, tone: 'bg-amber-100 text-amber-800' }
    : { label: reason, Icon: Sparkles, tone: 'bg-cocoa-700/10 text-cocoa-900/75' }
  const Icon = meta.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium ${meta.tone}`}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}
