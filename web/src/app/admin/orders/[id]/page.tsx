import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrder, getAdminCustomer, type OrderStatus } from '@/lib/api'
import { fmtUsd, fmtRelativeDate, displayOrderId } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { OrderActions } from './actions'
import { Sparkles, UtensilsCrossed, ShieldCheck, Phone, Mail, Repeat, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function AdminOrderDetailPage(props: { params: Params }) {
  const { id } = await props.params
  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <Link href="/admin/orders" className="text-sm text-cocoa-700 hover:underline">
          ← All orders
        </Link>
        <h2 className="display-h2 mt-2 break-all">
          Order {displayOrderId(order)}
          {order.friendly_id && (
            <span className="ml-3 text-base font-normal text-cocoa-900/55 font-mono break-all">
              · {order.id}
            </span>
          )}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <Badge variant={order.status === 'draft' ? 'blue' : 'default'}>{order.status}</Badge>
          {order.scheduled_at && (
            <span className="text-sm text-cocoa-900/70">scheduled {fmtRelativeDate(order.scheduled_at)}</span>
          )}
        </div>

        <ApprovalBanner order={order} />

        <section className="mt-8">
          <h3 className="display-h3">Items</h3>
          {order.items?.length ? (
            <ul className="mt-3 divide-y divide-cocoa-700/10 rounded-md border border-cocoa-700/15 bg-white">
              {order.items.map((it) => (
                <li key={it.sku} className="p-4 flex items-center justify-between">
                  <span>
                    {it.name}
                    <span className="text-cocoa-900/60"> × {it.qty}</span>
                  </span>
                  <span className="font-medium">{fmtUsd(it.line_total_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-cocoa-900/70">Items will appear once the backend exposes order details.</p>
          )}
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-cocoa-900/60">Total</span>
            <span className="text-2xl font-medium">{fmtUsd(order.total_cents)}</span>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <CustomerPanel order={order} />
        <div className="rounded-md border border-cocoa-700/15 bg-white p-5">
          <p className="eyebrow">Actions</p>
          <OrderActions orderId={order.id} status={order.status} />
        </div>
        {order.kitchen_ticket_id && (
          <div className="rounded-md border border-cocoa-700/15 bg-white p-5">
            <p className="eyebrow">Kitchen ticket</p>
            <code className="mt-2 block text-sm text-cocoa-700">{order.kitchen_ticket_id}</code>
          </div>
        )}
      </aside>
    </div>
  )
}

// CRM panel — replaces the old name-only block. Two states:
//
//  - Order linked to a customer (customer_id present) → server-fetches the
//    full record and shows lifetime + repeat badge + contact links + a
//    deep-link to /admin/customers/[id] for full history.
//  - Anonymous order (no customer_id) → falls back to the embedded
//    customer_name from the order row, no lifetime stats.
async function CustomerPanel({ order }: { order: OrderStatus }) {
  const detail = order.customer_id ? await getAdminCustomer(order.customer_id) : null
  const c = detail?.customer

  return (
    <div className="rounded-md border border-cocoa-700/15 bg-cream-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">Customer</p>
        {c && (
          <Link
            href={`/admin/customers/${c.id}`}
            className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
          >
            View record <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <p className="mt-2 font-medium text-cocoa-900">
        {c?.name ?? order.customer_name ?? <span className="text-cocoa-900/55 italic">no name</span>}
      </p>

      {c ? (
        <>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-sky-800 font-medium">
            <Repeat className="h-3 w-3" />
            {c.order_count <= 1
              ? 'First-time customer'
              : `${c.order_count}× orders · ${fmtUsd(c.total_spent_cents)} lifetime`}
          </p>
          <div className="mt-3 space-y-1.5 text-sm">
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 text-cocoa-900 hover:text-sky-700">
                <Phone className="h-3.5 w-3.5 text-cocoa-900/55" />
                <span className="font-mono text-xs">{c.phone}</span>
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="block text-cocoa-900 hover:text-sky-700 inline-flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-cocoa-900/55" />
                <span className="text-xs">{c.email}</span>
              </a>
            )}
          </div>
        </>
      ) : null}

      <p className="mt-3 text-xs text-cocoa-900/65 capitalize">{order.pickup_or_delivery}</p>
    </div>
  )
}

// Top-of-detail banner. Three states:
//   - draft + reasons → loud sky banner: "needs approval because <reasons>"
//   - non-draft + reasons present → quiet sage: "you approved this · <reasons>"
//   - non-draft + no reasons → quiet sage: "auto-approved (standard catalog)"
// Hidden on rejected/cancelled — those orders don't carry an approval story.
function ApprovalBanner({ order }: { order: OrderStatus }) {
  if (['rejected', 'cancelled'].includes(order.status)) return null
  const reasons = order.approval_reasons ?? []
  const isDraft = order.status === 'draft'

  if (isDraft && reasons.length > 0) {
    return (
      <div className="mt-4 rounded-xl border-2 border-sky/35 bg-sky/5 p-4 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-sky shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-cocoa-900">Needs your approval</div>
          <p className="mt-0.5 text-sm text-cocoa-900/75 leading-relaxed">
            This order has{' '}
            {reasons.map((r, i) => (
              <span key={r}>
                {i > 0 && (i === reasons.length - 1 ? ' and ' : ', ')}
                <ReasonInline reason={r} />
              </span>
            ))}{' '}
            items, so it's waiting for you. Standard catalog orders skip this queue.
          </p>
        </div>
      </div>
    )
  }
  if (reasons.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
        <span className="text-sm text-emerald-900">
          Auto-approved — standard catalog item, went straight to the kitchen.
        </span>
      </div>
    )
  }
  // Approved (custom/catering, owner OK'd at some point)
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center gap-2">
      <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
      <span className="text-sm text-emerald-900">
        You approved this · contains{' '}
        {reasons.map((r, i) => (
          <span key={r}>
            {i > 0 && (i === reasons.length - 1 ? ' and ' : ', ')}
            <ReasonInline reason={r} />
          </span>
        ))}.
      </span>
    </div>
  )
}

function ReasonInline({ reason }: { reason: string }) {
  if (reason === 'custom') return (
    <span className="inline-flex items-center gap-1 font-medium text-pink-800">
      <Sparkles className="h-3 w-3" />custom design
    </span>
  )
  if (reason === 'catering') return (
    <span className="inline-flex items-center gap-1 font-medium text-amber-800">
      <UtensilsCrossed className="h-3 w-3" />catering
    </span>
  )
  return <span className="font-medium text-cocoa-900">{reason}</span>
}
