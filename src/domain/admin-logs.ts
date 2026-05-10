// Admin logs feed — combined view of agent invocations + audit actions,
// filterable by channel (whatsapp / instagram / web / telegram). Powers
// the /admin/logs Mini App page so the owner can see every WA + IG +
// web event without dropping to SQLite.
//
// Two source tables:
//   - agent_invocations: every `claude -p` call, thread-scoped + costed
//   - audit_log: deterministic actions (approve, reject, channel_test,
//                campaign_pause, etc.) with outcome + result text
//
// agent_invocations doesn't carry the channel directly — we derive it
// by joining against `threads.channel`. For thread ids that don't have
// a row in `threads` (e.g. one-off `smoke_…` test threads, owner
// `<digits>` Telegram chat ids that don't get persisted), we fall back
// to a thread_id-prefix heuristic.

import { getDb } from '../db/db.ts'

export type LogChannel = 'whatsapp' | 'instagram' | 'web' | 'telegram' | 'unknown'
export type LogKind = 'agent_call' | 'audit'

export interface LogRow {
  id: string
  kind: LogKind
  at: number // unix ms
  channel: LogChannel
  /** Thread id for agent calls; target id (order id, approval id, etc.) for audit rows. */
  scope_id: string | null
  role: string | null // agent role for agent_call rows
  action: string | null // audit action for audit rows
  outcome: 'ok' | 'error' | 'partial'
  duration_ms: number | null
  cost_usd: number | null
  summary: string
}

export interface ListLogsOpts {
  channel?: LogChannel | 'all'
  since?: number
  limit?: number
}

export interface ListLogsResult {
  rows: LogRow[]
  total_recent: number // approx count in the last 7 days (used by the page header)
  by_channel: Record<LogChannel, number> // last-7-days breakdown
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function classifyByThreadId(threadId: string | null): LogChannel {
  if (!threadId) return 'unknown'
  if (threadId.startsWith('+')) return 'whatsapp'
  if (threadId.startsWith('@')) return 'instagram'
  if (threadId.startsWith('web_')) return 'web'
  if (/^\d+$/.test(threadId)) return 'telegram'
  return 'unknown'
}

function normalizeChannel(raw: string | null | undefined, threadId: string | null): LogChannel {
  if (raw === 'whatsapp' || raw === 'instagram' || raw === 'web' || raw === 'telegram') {
    return raw
  }
  return classifyByThreadId(threadId)
}

interface AgentRow {
  id: string
  role: string
  thread_id: string | null
  duration_ms: number | null
  cost_usd: number | null
  exit_code: number | null
  error: string | null
  response_chars: number | null
  created_at: number
  thread_channel: string | null
}

interface AuditRow {
  id: string
  action: string
  target_id: string | null
  channel: string | null
  result: string | null
  outcome: string
  created_at: number
}

export function listAdminLogs(opts: ListLogsOpts = {}): ListLogsResult {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100))
  const since = opts.since ?? Date.now() - SEVEN_DAYS_MS
  const wantChannel = opts.channel && opts.channel !== 'all' ? opts.channel : null

  const db = getDb()

  // Agent invocations + thread channel (LEFT JOIN so test threads still surface).
  const agentSql = `
    SELECT
      ai.id, ai.role, ai.thread_id, ai.duration_ms, ai.cost_usd,
      ai.exit_code, ai.error, ai.response_chars, ai.created_at,
      t.channel AS thread_channel
    FROM agent_invocations ai
    LEFT JOIN threads t ON t.thread_id = ai.thread_id
    WHERE ai.created_at >= ?
    ORDER BY ai.created_at DESC
    LIMIT ?
  `
  const agentRows = db.prepare(agentSql).all(since, limit * 2) as AgentRow[]

  const auditSql = `
    SELECT id, action, target_id, channel, result, outcome, created_at
    FROM audit_log
    WHERE created_at >= ?
    ORDER BY created_at DESC
    LIMIT ?
  `
  const auditRows = db.prepare(auditSql).all(since, limit * 2) as AuditRow[]

  const agentLogs: LogRow[] = agentRows.map((r) => {
    const channel = normalizeChannel(r.thread_channel, r.thread_id)
    const ok = (r.exit_code ?? -1) === 0
    return {
      id: r.id,
      kind: 'agent_call',
      at: r.created_at,
      channel,
      scope_id: r.thread_id,
      role: r.role,
      action: null,
      outcome: ok ? 'ok' : 'error',
      duration_ms: r.duration_ms,
      cost_usd: r.cost_usd,
      summary: ok
        ? `${r.role} replied (${r.response_chars ?? 0} chars)`
        : `${r.role} failed${r.error ? `: ${r.error.slice(0, 80)}` : ''}`,
    }
  })

  const auditLogs: LogRow[] = auditRows.map((r) => {
    const channel = normalizeChannel(r.channel, r.target_id)
    return {
      id: r.id,
      kind: 'audit',
      at: r.created_at,
      channel,
      scope_id: r.target_id,
      role: null,
      action: r.action,
      outcome: (r.outcome === 'error' ? 'error' : 'ok') as 'ok' | 'error',
      duration_ms: null,
      cost_usd: null,
      summary: r.result ?? r.action,
    }
  })

  // Merge + filter + cap at limit.
  const merged = [...agentLogs, ...auditLogs]
    .filter((row) => (wantChannel ? row.channel === wantChannel : true))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)

  // Channel breakdown (last 7 days, unfiltered) for the page header.
  const breakdown: Record<LogChannel, number> = {
    whatsapp: 0,
    instagram: 0,
    web: 0,
    telegram: 0,
    unknown: 0,
  }
  let totalRecent = 0
  for (const row of [...agentLogs, ...auditLogs]) {
    breakdown[row.channel]++
    totalRecent++
  }

  return { rows: merged, total_recent: totalRecent, by_channel: breakdown }
}
