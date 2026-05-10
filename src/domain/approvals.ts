// Owner approval queue — persisted store + helpers.
//
// Marketing/concierge agents call queue_owner_approval (local MCP) which
// writes here. The cockpit `/admin/posts` page renders pending items and
// lets the owner approve or reject. Approve/reject decisions are
// terminal — the queue is an audit trail, not a workflow engine.

import { getDb } from '../db/db.ts'

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

export function approveApproval(id: string, note?: string): { ok: boolean; approval?: OwnerApproval; error?: string } {
  const existing = getApproval(id)
  if (!existing) return { ok: false, error: 'not_found' }
  if (existing.status !== 'pending') return { ok: false, error: `already_${existing.status}` }
  const now = Date.now()
  getDb()
    .prepare("UPDATE owner_approvals SET status = 'approved', decision_note = ?, decided_at = ? WHERE id = ?")
    .run(note ?? null, now, id)
  const fresh = getApproval(id)
  return fresh ? { ok: true, approval: fresh } : { ok: false, error: 'reload_failed' }
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
