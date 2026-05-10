// Admin orders list. Three sections + clear approval rule.
//
// Approval rule (also rendered in the section header so it's visible
// without drilling in): standard catalog items (slices / whole cakes /
// pastries) auto-approve and head straight to the kitchen. Only `custom`
// and `catering` orders wait for owner approval. Each draft row shows
// the categories that triggered the requirement, so the owner sees WHY
// before clicking through.

import { listAdminOrders, type OrderStatus } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { OrdersTable } from '@/components/admin/orders-table'

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
        <div className="mt-3">
          <OrdersTable orders={orders} showApprovalReasons muted={muted} />
        </div>
      )}
    </section>
  )
}
