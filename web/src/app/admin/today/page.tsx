import { getDailyReport, listAdminOrders } from '@/lib/api'
import { fmtUsd } from '@/lib/format'
import { OrdersTable } from '@/components/admin/orders-table'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminTodayPage() {
  const [report, orders] = await Promise.all([getDailyReport(), listAdminOrders()])
  const fallbackReport = report ?? {
    date: new Date().toISOString().slice(0, 10),
    orders_count: 0,
    revenue_cents: 0,
    pending_approval: 0,
    escalations_open: 0,
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders today" value={String(fallbackReport.orders_count)} />
        <Stat label="Revenue today" value={fmtUsd(fallbackReport.revenue_cents)} />
        <Stat label="Pending approval" value={String(fallbackReport.pending_approval)} highlight={fallbackReport.pending_approval > 0} />
        <Stat label="Open escalations" value={String(fallbackReport.escalations_open)} highlight={fallbackReport.escalations_open > 0} />
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between mb-3">
          <h2 className="display-h3">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm text-cocoa-700 hover:underline">
            See all →
          </Link>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-md bg-cream-100 p-6 text-sm text-cocoa-900/70">
            No orders yet today. As soon as one comes in through chat, web, WhatsApp, or Instagram,
            it'll show up here for approval.
          </div>
        ) : (
          <OrdersTable orders={orders.slice(0, 8)} />
        )}
      </section>

      {!report && (
        <p className="mt-8 text-xs text-cocoa-900/60">
          Backend admin endpoints aren't wired yet — showing zeroes. The bot in Telegram has the
          live data. <code className="bg-cream-100 rounded px-1">GET /api/admin/today</code> needs
          to be added in <code className="bg-cream-100 rounded px-1">src/routes/api.ts</code>.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md p-5 border ${highlight ? 'bg-sky-100 border-cocoa-700/30' : 'bg-cream-100 border-cocoa-700/10'}`}>
      <div className="text-xs uppercase tracking-[0.16em] text-cocoa-900/60">{label}</div>
      <div className="text-3xl font-display text-cocoa-900 mt-1">{value}</div>
    </div>
  )
}
