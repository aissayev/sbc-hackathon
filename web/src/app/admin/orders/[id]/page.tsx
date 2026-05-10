import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrder } from '@/lib/api'
import { fmtUsd, fmtRelativeDate, formatOrderId } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { OrderActions } from './actions'

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
        <h2 className="display-h2 mt-2 break-all">Order {formatOrderId(order.id)}</h2>
        <div className="mt-2 flex items-center gap-3">
          <Badge variant={order.status === 'draft' ? 'blue' : 'default'}>{order.status}</Badge>
          {order.scheduled_at && (
            <span className="text-sm text-cocoa-900/70">scheduled {fmtRelativeDate(order.scheduled_at)}</span>
          )}
        </div>

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
        <div className="rounded-md border border-cocoa-700/15 bg-cream-100 p-5">
          <p className="eyebrow">Customer</p>
          <p className="mt-1 font-medium text-cocoa-900">{order.customer_name ?? '—'}</p>
          <p className="mt-1 text-sm text-cocoa-900/70 capitalize">{order.pickup_or_delivery}</p>
        </div>
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
