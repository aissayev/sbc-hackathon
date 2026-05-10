// Admin /checkouts cockpit. The owner sees, in one screen:
//
//   - Funnel summary: active / abandoned / submitted (and a 7-day
//     completion-rate hero number)
//   - Per-step breakdown — "5 abandoned at cakes, 3 at payment, …"
//     so the owner knows where the friction lives
//   - Filtered list of recent sessions with contact info (so they
//     can follow up on abandoned high-value carts)
//
// Public submission lives at /api/checkout/heartbeat (fired by the
// OrderForm wizard on every step transition).

import {
  listAdminCheckouts,
  type AdminCheckout,
  type AdminCheckoutStep,
  type AdminCheckoutStatus,
} from '@/lib/api'
import { fmtUsd, fmtRelativeDate } from '@/lib/format'
import { Eyebrow } from '@/components/brand/eyebrow'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ status?: string; step?: string }>

const STATUS_FILTERS: Array<{ key: AdminCheckoutStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'abandoned', label: 'Abandoned' },
  { key: 'active', label: 'Active' },
  { key: 'submitted', label: 'Submitted' },
]

const STATUS_TONE: Record<AdminCheckoutStatus, string> = {
  active: 'bg-sky/10 text-sky-700',
  abandoned: 'bg-amber-100 text-amber-800',
  submitted: 'bg-emerald-100 text-emerald-700',
}

const STEP_LABEL: Record<AdminCheckoutStep, string> = {
  cakes: 'Picking cakes',
  when: 'When + how',
  contact: 'Contact',
  payment: 'Payment',
  submitted: 'Submitted',
}

const FUNNEL_STEPS: AdminCheckoutStep[] = ['cakes', 'when', 'contact', 'payment']

function isStatus(v: string | undefined): v is AdminCheckoutStatus | 'all' {
  return v === 'all' || v === 'active' || v === 'abandoned' || v === 'submitted'
}
function isStep(v: string | undefined): v is AdminCheckoutStep | 'all' {
  return (
    v === 'all' ||
    v === 'cakes' ||
    v === 'when' ||
    v === 'contact' ||
    v === 'payment' ||
    v === 'submitted'
  )
}

export default async function AdminCheckoutsPage(props: { searchParams?: SearchParams }) {
  const params = (await props.searchParams) ?? {}
  // Default landing view = abandoned carts: that's the only state the
  // owner can act on. Active sessions might still convert; submitted
  // ones are already orders.
  const status = isStatus(params.status) ? params.status : 'abandoned'
  const step = isStep(params.step) ? params.step : 'all'
  const { checkouts, counts } = await listAdminCheckouts({ status, step, limit: 200 })

  const completionPct =
    counts.recent_completion_rate !== null ? Math.round(counts.recent_completion_rate * 100) : null

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Checkouts</Eyebrow>
          <h2 className="display-h2 mt-2">Funnel & abandoned carts</h2>
          <p className="mt-1 text-sm text-cocoa-900/70">
            {counts.total === 0
              ? 'No checkout sessions yet — they appear here as customers move through /order.'
              : `${counts.total} session${counts.total === 1 ? '' : 's'} tracked.`}
          </p>
        </div>
        {completionPct !== null && (
          <div className="rounded-2xl bg-cream-100 border border-cocoa-700/10 px-5 py-3 text-right">
            <div className="text-[11px] uppercase tracking-[0.16em] text-cocoa-900/55">
              7-day completion
            </div>
            <div className="font-display text-3xl text-cocoa-900 tabular-nums">
              {completionPct}%
            </div>
          </div>
        )}
      </div>

      {/* Funnel-step breakdown — which step is leaking. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FUNNEL_STEPS.map((s) => {
          const c = counts.by_step[s]
          const total = c.active + c.abandoned + c.submitted
          // Visual emphasis = abandoned count: this is the bar the owner
          // wants to drive down. Sky border for the step label, cocoa
          // for the abandoned number.
          return (
            <Link
              key={s}
              href={buildUrl({ status: 'abandoned', step: s })}
              className={cn(
                'group rounded-2xl border bg-white p-4 hover:-translate-y-0.5 transition-transform',
                c.abandoned > 0 ? 'border-amber-300/70' : 'border-cocoa-700/15',
              )}
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-cocoa-900/55">
                {STEP_LABEL[s]}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl text-cocoa-900 tabular-nums">
                  {c.abandoned}
                </span>
                <span className="text-xs text-cocoa-900/55">abandoned</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-cocoa-900/55">
                <span>{c.active} active</span>
                <span aria-hidden>·</span>
                <span>{c.submitted} submitted</span>
                {total > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{total} total</span>
                  </>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Status pills */}
      <div className="mt-8 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.key === 'all' ? counts.total : counts[f.key]
          const active = f.key === status
          return (
            <Link
              key={f.key}
              href={buildUrl({ status: f.key === 'all' ? undefined : f.key, step: step === 'all' ? undefined : step })}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3.5 h-8 text-sm border transition-colors',
                active
                  ? 'bg-cocoa-900 text-cream border-cocoa-900'
                  : 'border-cocoa-700/15 text-cocoa-900 hover:bg-cream-100',
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  'tabular-nums text-[11px] px-1.5 rounded-md',
                  active ? 'bg-white/15' : 'bg-cocoa-700/8',
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}
        {step !== 'all' && (
          <Link
            href={buildUrl({ status: status === 'all' ? undefined : status })}
            className="inline-flex items-center gap-1 rounded-full px-3 h-8 text-xs border border-cocoa-700/15 text-cocoa-900/70 hover:bg-cream-100"
          >
            <span>step: {STEP_LABEL[step as AdminCheckoutStep]}</span>
            <span aria-hidden className="text-cocoa-900/40 ml-1">×</span>
          </Link>
        )}
      </div>

      {checkouts.length === 0 ? (
        <div className="mt-8 rounded-md bg-cream-100 border border-cocoa-700/15 p-6 text-sm text-cocoa-900/70">
          No checkouts match this filter.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-cocoa-700/15 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-cocoa-900/65 text-left text-[11px] uppercase tracking-[0.16em]">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Cart</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Step</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cocoa-700/10">
              {checkouts.map((c) => (
                <CheckoutRow key={c.id} checkout={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-cocoa-900/55 leading-relaxed max-w-2xl">
        A session is marked <span className="font-medium">abandoned</span> when the customer hasn't
        moved through the wizard for ~30 minutes. Submitted sessions link back to the order
        they became.
      </p>
    </div>
  )
}

function CheckoutRow({ checkout }: { checkout: AdminCheckout }) {
  const items = parseItems(checkout.items_json)
  const itemSummary = items.length === 0
    ? '—'
    : items.length === 1
      ? `${items[0].name} × ${items[0].quantity}`
      : `${items[0].name} × ${items[0].quantity} +${items.length - 1}`
  const tone = STATUS_TONE[checkout.status]
  const stepLabel = STEP_LABEL[checkout.last_step]
  return (
    <tr className="hover:bg-cream-50">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-cocoa-900">
          {checkout.customer_name ?? <span className="text-cocoa-900/45 italic">(no name yet)</span>}
        </div>
        <div className="text-xs text-cocoa-900/65">
          {checkout.customer_email ?? checkout.customer_phone ?? <span className="text-cocoa-900/40">no contact</span>}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-cocoa-900/85" title={items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}>
        {itemSummary}
      </td>
      <td className="px-4 py-3 align-top text-right tabular-nums font-medium">
        {fmtUsd(checkout.total_cents)}
      </td>
      <td className="px-4 py-3 align-top text-cocoa-900/85">{stepLabel}</td>
      <td className="px-4 py-3 align-top">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em]', tone)}>
          {checkout.status}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-cocoa-900/70">
        {fmtRelativeDate(new Date(checkout.last_seen_at).toISOString())}
      </td>
    </tr>
  )
}

function parseItems(json: string | null): Array<{ product_id: string; quantity: number; name: string; price_cents: number }> {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function buildUrl(opts: { status?: string; step?: string }): string {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.step) params.set('step', opts.step)
  const qs = params.toString()
  return qs ? `/admin/checkouts?${qs}` : '/admin/checkouts'
}
