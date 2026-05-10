import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminCustomer } from '@/lib/api'
import { fmtUsd, fmtRelativeDate } from '@/lib/format'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Badge } from '@/components/ui/badge'
import { CustomerNotesEditor } from './notes-editor'
import { Phone, Mail, Sparkles, Repeat } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function AdminCustomerDetailPage(props: { params: Params }) {
  const { id } = await props.params
  const detail = await getAdminCustomer(id)
  if (!detail) notFound()
  const { customer, recent_orders } = detail

  // Match the Telegram badge wording so the two surfaces tell the same story.
  const isFirstTime = customer.order_count <= 1
  const badgeIcon = isFirstTime ? Sparkles : Repeat
  const badgeText = isFirstTime
    ? 'First-time customer'
    : `${ordinal(customer.order_count)} order · ${fmtUsd(customer.total_spent_cents)} lifetime`

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <Link href="/admin/customers" className="text-sm text-cocoa-700 hover:underline">
          ← All customers
        </Link>
        <h2 className="display-h2 mt-2">
          {customer.name ?? <span className="text-cocoa-900/55 italic">no name on file</span>}
        </h2>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky/10 text-sky-800 px-3 py-1.5 text-sm font-medium">
          {(() => {
            const Icon = badgeIcon
            return <Icon className="h-4 w-4" />
          })()}
          {badgeText}
        </div>

        <section className="mt-8">
          <h3 className="display-h3">Order history</h3>
          {recent_orders.length === 0 ? (
            <p className="mt-3 text-sm text-cocoa-900/70">No orders linked to this customer yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-cocoa-700/15 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-cream-100 text-cocoa-900/65 text-left text-[11px] uppercase tracking-[0.16em]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3" aria-label="Open" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cocoa-700/10">
                  {recent_orders.map((o) => (
                    <tr key={o.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3 text-cocoa-900/80 whitespace-nowrap">
                        {fmtRelativeDate(new Date(o.created_at).toISOString())}
                      </td>
                      <td className="px-4 py-3 text-cocoa-900/85">{o.items_summary || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={o.status === 'draft' ? 'blue' : 'default'}>{o.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {fmtUsd(o.total_cents)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-xs text-sky-700 hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-md border border-cocoa-700/15 bg-cream-100 p-5">
          <p className="eyebrow">Contact</p>
          {customer.phone ? (
            <a
              href={`tel:${customer.phone}`}
              className="mt-2 inline-flex items-center gap-2 text-cocoa-900 hover:text-sky-700"
            >
              <Phone className="h-4 w-4 text-cocoa-900/55" />
              <span className="font-mono">{customer.phone}</span>
            </a>
          ) : (
            <p className="mt-2 text-sm text-cocoa-900/55">No phone on file</p>
          )}
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              className="mt-2 inline-flex items-center gap-2 text-cocoa-900 hover:text-sky-700"
            >
              <Mail className="h-4 w-4 text-cocoa-900/55" />
              {customer.email}
            </a>
          )}
        </div>

        <div className="rounded-md border border-cocoa-700/15 bg-white p-5 text-sm">
          <p className="eyebrow">Activity</p>
          <dl className="mt-3 space-y-2 text-cocoa-900/85">
            <div className="flex justify-between">
              <dt className="text-cocoa-900/65">First seen</dt>
              <dd>{fmtRelativeDate(new Date(customer.first_seen_at).toISOString())}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cocoa-900/65">Last seen</dt>
              <dd>{fmtRelativeDate(new Date(customer.last_seen_at).toISOString())}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cocoa-900/65">Orders</dt>
              <dd className="tabular-nums">{customer.order_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cocoa-900/65">Lifetime</dt>
              <dd className="tabular-nums font-medium">{fmtUsd(customer.total_spent_cents)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-cocoa-700/15 bg-white p-5">
          <p className="eyebrow">Square POS</p>
          {customer.square_customer_id ? (
            <code className="mt-2 block text-xs text-cocoa-700 break-all">
              {customer.square_customer_id}
            </code>
          ) : (
            <p className="mt-2 text-sm text-cocoa-900/55">
              Not synced yet. Pushed automatically on next order when SQUARE_LIVE_TOKEN is set.
            </p>
          )}
        </div>

        <CustomerNotesEditor customerId={customer.id} initialValue={customer.notes ?? ''} />

        <p className="text-xs text-cocoa-900/55 leading-relaxed">
          Customer record id <code className="font-mono">{customer.id}</code>. Updated by the
          backend whenever a new order arrives — name/phone/email are auto-managed; notes are owner-editable.
        </p>
      </aside>
    </div>
  )
}

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11–13 → "11th". Mirrors
// the same helper in the Telegram bot so badges read identically.
function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}
