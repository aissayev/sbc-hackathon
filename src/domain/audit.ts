// Owner audit log. Anything the owner does through the cockpit lands
// here so the Settings page can show "what did I do, when, on what".
//
// Append-only. We never edit or delete rows; if a fact turns out to be
// wrong, log a correcting event rather than rewriting history.
//
// Calls are wrapped in try/catch so a logging failure never breaks the
// underlying action — the audit trail is best-effort.

import { getDb } from '../db/db.ts'

export type AuditAction =
  | 'approval_approve' | 'approval_reject'
  | 'thread_reply'
  | 'channel_register' | 'channel_test'
  | 'campaign_pause' | 'campaign_resume' | 'campaign_adjust'
  | 'order_approve' | 'order_reject'

export interface AuditEvent {
  id: string
  action: AuditAction
  targetId: string | null
  channel: string | null
  result: string | null
  outcome: 'ok' | 'error'
  createdAt: number
}

interface Row {
  id: string
  action: string
  target_id: string | null
  channel: string | null
  result: string | null
  outcome: string
  created_at: number
}

function toEvent(r: Row): AuditEvent {
  return {
    id: r.id,
    action: r.action as AuditAction,
    targetId: r.target_id,
    channel: r.channel,
    result: r.result,
    outcome: r.outcome as 'ok' | 'error',
    createdAt: r.created_at,
  }
}

export function recordAuditEvent(args: {
  action: AuditAction
  targetId?: string | null
  channel?: string | null
  result?: string | null
  outcome?: 'ok' | 'error'
}): void {
  try {
    const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    getDb()
      .prepare(
        `INSERT INTO audit_log (id, action, target_id, channel, result, outcome, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, args.action,
        args.targetId ?? null,
        args.channel ?? null,
        args.result ?? null,
        args.outcome ?? 'ok',
        Date.now(),
      )
  } catch (err) {
    // Audit logging is best-effort. Don't surface a logging failure to the caller.
    console.warn('[audit] failed to record event', (err as Error).message)
  }
}

export function listAuditEvents(opts?: { limit?: number; action?: AuditAction }): AuditEvent[] {
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100))
  const rows = (opts?.action
    ? getDb().prepare('SELECT * FROM audit_log WHERE action = ? ORDER BY created_at DESC LIMIT ?').all(opts.action, limit)
    : getDb().prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit)) as Row[]
  return rows.map(toEvent)
}

export function auditCounts(): { total: number; today: number; errors: number } {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const total = (getDb().prepare('SELECT COUNT(*) as c FROM audit_log').get() as { c: number }).c
  const today = (getDb().prepare('SELECT COUNT(*) as c FROM audit_log WHERE created_at >= ?').get(startOfToday.getTime()) as { c: number }).c
  const errors = (getDb().prepare("SELECT COUNT(*) as c FROM audit_log WHERE outcome = 'error'").get() as { c: number }).c
  return { total, today, errors }
}
