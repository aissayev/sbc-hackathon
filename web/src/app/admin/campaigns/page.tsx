// Campaigns dashboard. Top strip: monthly budget, spend MTD, leads, target effect.
// Below: row per active campaign (sandbox metrics) + row per planned strategy
// (local plan, status='draft'). Click a row → /admin/campaigns/<id>.

import Link from 'next/link'
import { getCampaignsCockpit, type CampaignSummary } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Megaphone, ChevronRight, TrendingUp, Wallet, Users, Target } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const c = await getCampaignsCockpit()
  const pct = c.monthlyBudgetUsd > 0 ? Math.min(100, (c.spendUsd / c.monthlyBudgetUsd) * 100) : 0
  const cpl = c.leadsTotal > 0 ? c.spendUsd / c.leadsTotal : 0

  return (
    <div>
      <div className="mb-5">
        <h2 className="display-h3">Campaigns</h2>
        <p className="text-sm text-cocoa-900/65 mt-1">
          What's running, what it's costing, what it's bringing in. Adjust or pause from
          the detail page.
        </p>
      </div>

      {c.errors.length > 0 && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Couldn't reach: {c.errors.join(', ')}. Showing local plan only.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat icon={Wallet} label="Monthly budget" value={`$${c.monthlyBudgetUsd}`} hint={`Target: $${c.targetEffectUsd} effect`} />
        <Stat
          icon={TrendingUp}
          label="Spent MTD"
          value={`$${c.spendUsd.toFixed(2)}`}
          hint={`${pct.toFixed(0)}% of budget`}
          progress={pct}
        />
        <Stat icon={Users} label="Leads MTD" value={String(c.leadsTotal)} hint={cpl > 0 ? `$${cpl.toFixed(2)} CPL` : '—'} />
        <Stat icon={Target} label="Remaining" value={`$${c.remainingUsd.toFixed(2)}`} hint="Until next budget refill" highlight={c.remainingUsd < 50} />
      </div>

      {c.campaigns.length === 0 ? (
        <EmptyState recommended={c.recommendedStrategyId} />
      ) : (
        <ul className="divide-y divide-cocoa-700/10 rounded-lg border border-cocoa-700/15 bg-white">
          {c.campaigns.map((row) => <CampaignRow key={row.id} row={row} />)}
        </ul>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, hint, progress, highlight }: {
  icon: React.ComponentType<{ className?: string }>
  label: string; value: string; hint?: string
  progress?: number; highlight?: boolean
}) {
  return (
    <div className={cn(
      'rounded-2xl bg-white border p-4',
      highlight ? 'border-amber-300 shadow-sm' : 'border-cocoa-700/12',
    )}>
      <div className="flex items-center gap-2 text-cocoa-900/55">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="mt-1 font-display text-2xl text-cocoa-900">{value}</div>
      {hint && <div className="text-xs text-cocoa-900/55 mt-1">{hint}</div>}
      {typeof progress === 'number' && (
        <div className="mt-2 h-1.5 rounded-full bg-cream-100 overflow-hidden">
          <div className={cn('h-full rounded-full', progress > 90 ? 'bg-amber-500' : 'bg-sky')} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function CampaignRow({ row }: { row: CampaignSummary }) {
  return (
    <li>
      <Link
        href={`/admin/campaigns/${encodeURIComponent(row.id)}`}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 hover:bg-cream-100/60 transition-colors"
      >
        <div className="h-10 w-10 rounded-full inline-flex items-center justify-center bg-amber-100 text-amber-700 shrink-0">
          <Megaphone className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-cocoa-900 truncate">
              {row.name ?? row.id}
            </span>
            {row.channel && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium bg-cocoa-700/10 text-cocoa-900/75">
                {row.channel}
              </span>
            )}
            <StatusPill status={row.status} />
          </div>
          <div className="text-xs text-cocoa-900/65 mt-0.5">
            {row.budgetUsd != null && <>budget ${row.budgetUsd.toFixed(0)} · </>}
            spent ${(row.spendUsd ?? 0).toFixed(2)} · {row.leads ?? 0} leads
            {row.startedAt && <> · started {fmtRelativeTime(row.startedAt)}</>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-cocoa-900/30 shrink-0" />
      </Link>
    </li>
  )
}

function StatusPill({ status }: { status: CampaignSummary['status'] }) {
  const tone = {
    running: 'bg-emerald-100 text-emerald-800',
    paused: 'bg-amber-100 text-amber-800',
    closed: 'bg-cocoa-700/10 text-cocoa-900/65',
    draft: 'bg-sky/15 text-sky-800',
    queued: 'bg-blue-100 text-blue-800',
    unknown: 'bg-cocoa-700/8 text-cocoa-900/55',
  }[status ?? 'unknown']
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium', tone)}>
      {status ?? 'unknown'}
    </span>
  )
}

function EmptyState({ recommended }: { recommended?: string }) {
  return (
    <div className="rounded-lg bg-cream-100 border border-cocoa-700/10 p-8 text-center">
      <Megaphone className="h-7 w-7 mx-auto text-cocoa-900/30" />
      <p className="mt-3 text-sm text-cocoa-900/70">
        No campaigns running. {recommended && <>The recommended strategy is <code className="px-1 rounded bg-white text-xs">{recommended}</code>.</>}
      </p>
      <p className="mt-1 text-xs text-cocoa-900/50">
        The marketing agent can draft one with <code className="px-1 rounded bg-white text-[11px]">marketing_create_campaign</code>.
      </p>
    </div>
  )
}
