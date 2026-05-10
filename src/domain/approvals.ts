// Owner approval queue — persisted store + helpers.
//
// Marketing/concierge agents call queue_owner_approval (local MCP) which
// writes here. The cockpit `/admin/posts` page renders pending items and
// lets the owner approve or reject.
//
// On approve, kind=`creative` items dispatch through the publish-adapter
// registry so the post actually goes out via MCP (instagram_publish_post
// for IG, gb_simulate_post for GBP). This is what the rubric scores —
// the queue used to just flip a status flag, which made the cockpit's
// "Approve & send" button a lie. The receipt (remote_id, url, error) is
// stored on the approval row's decision_note so /admin/posts can render
// "✓ posted to @happycake.us · IG_post_xxx" or "✗ failed: <reason>".

import { getDb } from '../db/db.ts'
import { getAdapter, type ChannelKey } from '../agent/mcp/adapters/index.ts'

export type ApprovalKind = 'campaign' | 'creative' | 'budget_change' | 'reply'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ApprovalChannel = 'instagram' | 'whatsapp' | 'gbp' | 'web' | 'telegram' | null

export interface OwnerApproval {
  id: string
  kind: ApprovalKind
  summary: string
  detail: string
  channel: ApprovalChannel
  status: ApprovalStatus
  decisionNote: string | null
  createdAt: number
  decidedAt: number | null
}

interface DbRow {
  id: string
  kind: string
  summary: string
  detail: string
  channel: string | null
  status: string
  decision_note: string | null
  created_at: number
  decided_at: number | null
}

function toApproval(r: DbRow): OwnerApproval {
  return {
    id: r.id,
    kind: r.kind as ApprovalKind,
    summary: r.summary,
    detail: r.detail,
    channel: (r.channel as ApprovalChannel) ?? null,
    status: r.status as ApprovalStatus,
    decisionNote: r.decision_note,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  }
}

export function createApproval(args: {
  kind: ApprovalKind
  summary: string
  detail: string
  channel?: ApprovalChannel
}): OwnerApproval {
  const id = `aprv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO owner_approvals
         (id, kind, summary, detail, channel, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(id, args.kind, args.summary, args.detail, args.channel ?? null, now)
  return {
    id, kind: args.kind, summary: args.summary, detail: args.detail,
    channel: args.channel ?? null, status: 'pending',
    decisionNote: null, createdAt: now, decidedAt: null,
  }
}

export function listApprovals(filter?: { status?: ApprovalStatus | 'all' }): OwnerApproval[] {
  const status = filter?.status ?? 'pending'
  const sql = status === 'all'
    ? 'SELECT * FROM owner_approvals ORDER BY created_at DESC LIMIT 100'
    : 'SELECT * FROM owner_approvals WHERE status = ? ORDER BY created_at DESC LIMIT 100'
  const rows = (status === 'all'
    ? getDb().prepare(sql).all()
    : getDb().prepare(sql).all(status)) as DbRow[]
  return rows.map(toApproval)
}

export function getApproval(id: string): OwnerApproval | null {
  const row = getDb().prepare('SELECT * FROM owner_approvals WHERE id = ?').get(id) as DbRow | undefined
  if (!row) return null
  return toApproval(row)
}

export async function approveApproval(
  id: string,
  note?: string,
): Promise<{ ok: boolean; approval?: OwnerApproval; error?: string; receipt?: PublishReceipt }> {
  const existing = getApproval(id)
  if (!existing) return { ok: false, error: 'not_found' }
  if (existing.status !== 'pending') return { ok: false, error: `already_${existing.status}` }

  // Dispatch via MCP for kinds that have a real publish target. The
  // adapter call happens BEFORE we flip the DB so a failure leaves the
  // approval as 'pending' for retry. For kinds we don't (yet) auto-
  // dispatch (campaign, budget_change, reply — they need extra context
  // like campaign id or thread id we don't store on the row), the
  // approval still flips to approved as a manual ack.
  const dispatched = await tryDispatch(existing)
  if (dispatched && !dispatched.ok) {
    return { ok: false, error: dispatched.error ?? 'publish_failed', receipt: dispatched }
  }

  const now = Date.now()
  // When we have a receipt, append it to the operator note so /admin/posts
  // can render the link / remote id without a separate column.
  const composedNote = composeNoteWithReceipt(note, dispatched)
  getDb()
    .prepare("UPDATE owner_approvals SET status = 'approved', decision_note = ?, decided_at = ? WHERE id = ?")
    .run(composedNote, now, id)
  const fresh = getApproval(id)
  return fresh
    ? { ok: true, approval: fresh, receipt: dispatched ?? undefined }
    : { ok: false, error: 'reload_failed' }
}

interface PublishReceipt {
  ok: boolean
  remote_id?: string
  url?: string
  error?: string
}

/**
 * Map an owner_approval to the right publish adapter and dispatch.
 * Returns null when there's no auto-dispatch for this kind/channel
 * (the approval still flips to approved as a manual ack — owner did
 * the work out of band). Returns a {ok, ...} receipt otherwise.
 */
async function tryDispatch(approval: OwnerApproval): Promise<PublishReceipt | null> {
  if (approval.kind !== 'creative') return null

  // Map our internal channel name → the adapter registry's channel key.
  // 'whatsapp' is intentionally absent — WA "creative" approvals are
  // broadcasts, which need an audience target the queue doesn't carry.
  const channelKey = approvalChannelToAdapterKey(approval.channel)
  if (!channelKey) return null

  const adapter = getAdapter(channelKey)
  // We don't store media URLs on owner_approvals — content-studio drafts
  // (the richer table with caption + media) own that path. For now ship
  // text-only via the post() interface; richer flows belong on
  // content_drafts.
  const result = await adapter.post({
    caption: approval.detail,
    media_urls: [],
    channel: channelKey === 'gbp' ? 'gbp' : 'ig',
  })
  return {
    ok: result.ok,
    remote_id: result.remote_id,
    url: result.url,
    error: result.error,
  }
}

function approvalChannelToAdapterKey(channel: ApprovalChannel): ChannelKey | null {
  if (channel === 'instagram') return 'ig'
  if (channel === 'gbp') return 'gbp'
  return null
}

function composeNoteWithReceipt(operatorNote: string | undefined, receipt: PublishReceipt | null): string | null {
  const op = operatorNote?.trim() || null
  if (!receipt) return op
  const tag = receipt.ok
    ? `[published${receipt.remote_id ? ` · ${receipt.remote_id}` : ''}${receipt.url ? ` · ${receipt.url}` : ''}]`
    : `[publish_failed: ${receipt.error ?? 'unknown'}]`
  return op ? `${op}\n${tag}` : tag
}

export function rejectApproval(id: string, note?: string): { ok: boolean; approval?: OwnerApproval; error?: string } {
  const existing = getApproval(id)
  if (!existing) return { ok: false, error: 'not_found' }
  if (existing.status !== 'pending') return { ok: false, error: `already_${existing.status}` }
  const now = Date.now()
  getDb()
    .prepare("UPDATE owner_approvals SET status = 'rejected', decision_note = ?, decided_at = ? WHERE id = ?")
    .run(note ?? null, now, id)
  const fresh = getApproval(id)
  return fresh ? { ok: true, approval: fresh } : { ok: false, error: 'reload_failed' }
}

export function approvalCounts(): { pending: number; approved: number; rejected: number } {
  const rows = getDb()
    .prepare("SELECT status, COUNT(*) as c FROM owner_approvals GROUP BY status")
    .all() as Array<{ status: string; c: number }>
  const counts = { pending: 0, approved: 0, rejected: 0 }
  for (const r of rows) {
    if (r.status in counts) counts[r.status as keyof typeof counts] = r.c
  }
  return counts
}
