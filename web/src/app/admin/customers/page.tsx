import Link from 'next/link'
import { Suspense } from 'react'
import { listAdminCustomers, type AdminCustomer } from '@/lib/api'
import { fmtUsd, fmtRelativeDate } from '@/lib/format'
import { Eyebrow } from '@/components/brand/eyebrow'
import { CustomersSearch } from './search'

// Renders dynamically — search is URL-driven so we re-fetch the list on
// every request rather than caching. The list is small (one bakery's
// customer base); SSR is fine.
export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ q?: string }>

export default async function AdminCustomersPage(props: { searchParams?: SearchParams }) {
  const params = (await props.searchParams) ?? {}
  const q = (params.q ?? '').trim()
  const { customers, total } = await listAdminCustomers({ q: q || undefined, limit: 100 })

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>CRM</Eyebrow>
          <h2 className="display-h2 mt-2">Customers</h2>
          <p className="mt-1 text-sm text-cocoa-900/70">
            {total === 0
              ? 'No customers yet — they appear here after their first order.'
              : `${total} customer${total === 1 ? '' : 's'} · sorted by most recent activity.`}
          </p>
        </div>
        <Suspense
          fallback={<div className="h-10 w-72 rounded-md bg-cream-100 border border-cocoa-700/15" aria-hidden />}
        >
          <CustomersSearch defaultValue={q} />
        </Suspense>
      </div>

      {customers.length === 0 ? (
        q ? (
          <div className="mt-8 rounded-md bg-cream-100 border border-cocoa-700/15 p-6 text-sm text-cocoa-900/70">
            No customers match <code className="font-mono">&ldquo;{q}&rdquo;</code>.
          </div>
        ) : null
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-cocoa-700/15 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-cocoa-900/65 text-left text-[11px] uppercase tracking-[0.16em]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium text-right">Orders</th>
                <th className="px-4 py-3 font-medium text-right">Lifetime</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cocoa-700/10">
              {customers.map((c) => (
                <CustomerRow key={c.id} customer={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CustomerRow({ customer }: { customer: AdminCustomer }) {
  return (
    <tr className="hover:bg-cream-50">
      <td className="px-4 py-3">
        <Link href={`/admin/customers/${customer.id}`} className="font-medium text-cocoa-900 hover:text-sky-700">
          {customer.name ?? <span className="text-cocoa-900/55 italic">no name</span>}
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-cocoa-900/80">
        {customer.phone ?? <span className="text-cocoa-900/40">—</span>}
      </td>
      <td className="px-4 py-3 text-cocoa-900/80">
        {customer.email ?? <span className="text-cocoa-900/40">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{customer.order_count}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium">
        {fmtUsd(customer.total_spent_cents)}
      </td>
      <td className="px-4 py-3 text-cocoa-900/70">
        {fmtRelativeDate(new Date(customer.last_seen_at).toISOString())}
      </td>
    </tr>
  )
}
