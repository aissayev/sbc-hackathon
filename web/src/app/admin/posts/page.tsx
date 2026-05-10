// Owner approval queue. Anything the marketing or concierge agent
// queued via local__queue_owner_approval shows up here. Approve →
// the channel adapter sends; Reject → noted in the audit trail.

import Link from 'next/link'
import { listApprovals, type ApprovalStatus, type OwnerApproval } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CHANNEL_META } from '@/components/admin/channel-meta'
import { ApprovalActions } from './approval-actions'
import { Inbox, Megaphone, MessageSquareReply, Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TABS: Array<{ id: ApprovalStatus | 'all'; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

interface PageProps { searchParams: Promise<{ status?: string }> }

export default async function PostsQueuePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const status = (TABS.find((t) => t.id === sp.status)?.id ?? 'pending') as ApprovalStatus | 'all'
  const { approvals, counts } = await listApprovals(status)

  return (
    <div>
      <div className="mb-5">
        <h2 className="display-h3">Approval queue</h2>
        <p className="text-sm text-cocoa-900/65 mt-1">
          Drafts, posts, and budget changes the agent wants you to OK before going out.
          Approving sends; rejecting closes the item.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5 border-b border-cocoa-700/10 pb-3">
        {TABS.map((t) => {
          const active = status === t.id
          const n = t.id === 'all' ? counts.pending + counts.approved + counts.rejected : counts[t.id]
          return (
            <Link
              key={t.id}
              href={{ pathname: '/admin/posts', query: { status: t.id } }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm transition-colors',
                active
                  ? 'bg-sky text-white'
                  : 'text-cocoa-900 hover:bg-cream-100 border border-cocoa-700/15',
              )}
            >
              {t.label}
              <span className={cn(
                'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium',
                active ? 'bg-white/25 text-white' : 'bg-cocoa-700/10 text-cocoa-900/75',
              )}>
                {n}
              </span>
            </Link>
          )
        })}
      </div>

      {approvals.length === 0 ? (
        <EmptyState status={status} />
      ) : (
        <ul className="space-y-3">
          {approvals.map((a) => <ApprovalCard key={a.id} approval={a} />)}
        </ul>
      )}
    </div>
  )
}

function ApprovalCard({ approval }: { approval: OwnerApproval }) {
  const Icon = kindIcon(approval.kind)
  const meta = approval.channel ? CHANNEL_META[approval.channel] : undefined
  return (
    <li className="rounded-2xl border border-cocoa-700/12 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0', kindColor(approval.kind))}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-cocoa-900">{approval.summary}</span>
            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium', kindChipColor(approval.kind))}>
              {kindLabel(approval.kind)}
            </span>
            {meta && (
              <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium', meta.chip)}>
                {meta.short}
              </span>
            )}
            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium ml-auto', statusChip(approval.status))}>
              {approval.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-cocoa-900/75 leading-relaxed whitespace-pre-wrap">
            {approval.detail}
          </p>
          <div className="mt-2 text-xs text-cocoa-900/55">
            queued {fmtRelativeTime(approval.createdAt)}
            {approval.decidedAt && <> · decided {fmtRelativeTime(approval.decidedAt)}</>}
            {approval.decisionNote && <> · note: <span className="italic">"{approval.decisionNote}"</span></>}
          </div>
        </div>
      </div>

      {approval.status === 'pending' && (
        <div className="mt-4 pt-4 border-t border-cocoa-700/10">
          <ApprovalActions id={approval.id} />
        </div>
      )}
    </li>
  )
}

function EmptyState({ status }: { status: string }) {
  const msg = status === 'pending'
    ? 'Nothing waiting. The marketing agent will queue items here for you to OK before they go out.'
    : status === 'approved' ? 'No approved items yet.'
    : status === 'rejected' ? 'No rejected items.'
    : 'Queue is empty.'
  return (
    <div className="rounded-lg bg-cream-100 border border-cocoa-700/10 p-10 text-center">
      <Inbox className="h-7 w-7 mx-auto text-cocoa-900/30" />
      <p className="mt-3 text-sm text-cocoa-900/70">{msg}</p>
    </div>
  )
}

function kindIcon(kind: OwnerApproval['kind']) {
  if (kind === 'campaign') return Megaphone
  if (kind === 'budget_change') return Wallet
  if (kind === 'reply') return MessageSquareReply
  return Inbox
}
function kindColor(kind: OwnerApproval['kind']) {
  if (kind === 'campaign') return 'bg-amber-100 text-amber-700'
  if (kind === 'budget_change') return 'bg-emerald-100 text-emerald-700'
  if (kind === 'reply') return 'bg-sky/15 text-sky-700'
  return 'bg-pink-100 text-pink-700'   // creative
}
function kindChipColor(kind: OwnerApproval['kind']) {
  if (kind === 'campaign') return 'bg-amber-100 text-amber-800'
  if (kind === 'budget_change') return 'bg-emerald-100 text-emerald-800'
  if (kind === 'reply') return 'bg-sky/15 text-sky-800'
  return 'bg-pink-100 text-pink-800'
}
function kindLabel(kind: OwnerApproval['kind']) {
  if (kind === 'budget_change') return 'budget'
  return kind
}
function statusChip(status: OwnerApproval['status']) {
  if (status === 'pending') return 'bg-sky/15 text-sky-800'
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800'
  return 'bg-red-100 text-red-800'
}
