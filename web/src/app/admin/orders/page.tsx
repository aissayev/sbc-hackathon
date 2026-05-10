import Link from 'next/link'
import { listAdminOrders } from '@/lib/api'
import { fmtUsd, fmtRelativeDate, displayOrderId } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders()
  const draft = orders.filter((o) => o.status === 'draft')
  const live = orders.filter((o) => !['draft', 'completed', 'rejected', 'cancelled'].includes(o.status))
  const closed = orders.filter((o) => ['completed', 'rejected', 'cancelled'].includes(o.status))

  return (
    <div className="space-y-10">
      <Section title="Awaiting your approval" tone="blue" empty="Nothing waiting — kitchen breathes." orders={draft} />
      <Section title="Live in the kitchen" empty="No active orders right now." orders={live} />
      <Section title="Closed today" empty="Nothing closed yet today." orders={closed.slice(0, 12)} muted />
    </div>
  )
}

function Section({
  title,
  orders,
  empty,
  tone,
  muted,
}: {
  title: string
  orders: Awaited<ReturnType<typeof listAdminOrders>>
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
      {orders.length === 0 ? (
        <div className="mt-3 rounded-md bg-cream-100 p-6 text-sm text-cocoa-900/70">{empty}</div>
      ) : (
        <ul className={`mt-3 divide-y divide-cocoa-700/10 rounded-md border border-cocoa-700/15 bg-white ${muted ? 'opacity-80' : ''}`}>
          {orders.map((o) => (
            <li key={o.id} className="p-4 flex items-center gap-3 justify-between flex-wrap">
              <div>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="font-medium text-cocoa-900 hover:text-cocoa-700 tabular-nums text-sm"
                  title={o.id}
                >
                  {displayOrderId(o, 'short')}
                </Link>
                <span className="ml-3 text-sm text-cocoa-900/70">{o.customer_name ?? '—'}</span>
              </div>
              <div className="text-sm text-cocoa-900/70 flex items-center gap-3">
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
