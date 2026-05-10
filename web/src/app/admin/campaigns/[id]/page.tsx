// Campaign detail page. Shows live metrics if running, planned rollout
// if it's a strategy from the local plan. Action buttons (Pause/Resume/
// Adjust) live in <CampaignActions/> client component.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCampaignDetail, type CampaignDetail } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ChevronLeft, Megaphone } from 'lucide-react'
import { CampaignActions } from './campaign-actions'

export const dynamic = 'force-dynamic'

interface PageProps { params: Promise<{ id: string }> }

export default async function CampaignDetailPage(props: PageProps) {
  const { id } = await props.params
  const c = await getCampaignDetail(decodeURIComponent(id))
  if (!c) notFound()

  return (
    <div className="max-w-3xl">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-sm text-cocoa-700 hover:text-sky transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Campaigns
      </Link>

      <div className="mt-4 flex items-start gap-4 pb-5 border-b border-cocoa-700/10">
        <div className="h-14 w-14 rounded-full inline-flex items-center justify-center bg-amber-100 text-amber-700 shrink-0">
          <Megaphone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="display-h3 leading-tight">{c.name ?? c.id}</h2>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs text-cocoa-900/65">
            <span className="uppercase tracking-[0.14em]">{c.source === 'sandbox' ? 'Live in sandbox' : 'Planned strategy'}</span>
            {c.channel && (<><span>·</span><span className="uppercase tracking-[0.14em]">{c.channel}</span></>)}
            <StatusPill status={c.status} />
            {c.startedAt && (<><span>·</span><span>started {fmtRelativeTime(c.startedAt)}</span></>)}
          </div>
          {c.thesis && (
            <p className="mt-3 text-sm text-cocoa-900/70 leading-relaxed italic">{c.thesis}</p>
          )}
          {c.notes && !c.thesis && (
            <p className="mt-2 text-xs text-cocoa-900/55 italic">{c.notes}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mt-6">
        <Stat label="Budget" value={c.budgetUsd != null ? `$${c.budgetUsd.toFixed(0)}` : '—'} />
        <Stat label="Spent" value={`$${(c.spendUsd ?? 0).toFixed(2)}`} />
        <Stat label="Leads" value={String(c.leads ?? 0)} />
        {(c.impressions != null || c.clicks != null || c.conversions != null) && (
          <>
            <Stat label="Impressions" value={String(c.impressions ?? '—')} />
            <Stat label="Clicks" value={String(c.clicks ?? '—')} />
            <Stat label="Conversions" value={String(c.conversions ?? '—')} />
          </>
        )}
      </div>

      {c.rolloutMonths && Object.keys(c.rolloutMonths).length > 0 && (
        <section className="mt-8">
          <h3 className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50">Rollout plan</h3>
          <ol className="mt-3 space-y-3">
            {Object.entries(c.rolloutMonths).map(([month, phase]) => (
              <li key={month} className="rounded-xl border border-cocoa-700/12 bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-cocoa-900">{month.replace('month', 'Month ')} · {phase.phase}</span>
                  {phase.spendUsd != null && <span className="text-sm text-cocoa-900/60">${phase.spendUsd}</span>}
                </div>
                {phase.expectedOutcomes && (
                  <ul className="mt-2 text-xs text-cocoa-900/65 grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(phase.expectedOutcomes).map(([k, v]) => (
                      <li key={k}><span className="text-cocoa-900/50">{k}</span> {String(v)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8 pt-6 border-t border-cocoa-700/10">
        <h3 className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50">Actions</h3>
        <CampaignActions campaignId={c.id} status={c.status} source={c.source} />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white border border-cocoa-700/12 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-cocoa-900/55">{label}</div>
      <div className="mt-1 font-display text-2xl text-cocoa-900">{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: CampaignDetail['status'] }) {
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
