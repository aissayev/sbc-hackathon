// Checkout session / abandoned-cart tracking.
//
// The /order wizard fires a heartbeat to /api/checkout/heartbeat on
// step entry (cakes → when → contact → payment) and once more on
// successful submission (last_step='submitted', order_id set). We
// upsert a row keyed by the browser-generated session id; "abandoned"
// is computed at read time as `last_step != 'submitted' AND
// last_seen_at < now - ABANDON_AFTER_MS`.
//
// Storage is the SQLite `checkout_sessions` table (see db/schema.sql).
// HTTP layer in src/routes/checkouts.ts is the only caller for writes;
// admin reads go through src/routes/admin.ts.

import { z } from 'zod'
import { getDb } from '../db/db.ts'

// 30-min idle window before we treat a session as abandoned. Matches
// what most cart-tracking tools default to. Tunable if we find legit
// long-tab customers showing up as abandoned.
const ABANDON_AFTER_MS = 30 * 60_000

const STEPS = ['cakes', 'when', 'contact', 'payment', 'submitted'] as const
export type CheckoutStep = (typeof STEPS)[number]

// Funnel order: cakes < when < contact < payment < submitted. Used by
// upsert to clamp the step to "highest reached" so an out-of-order
// heartbeat (e.g. user navigating back) doesn't regress the row.
const STEP_RANK: Record<CheckoutStep, number> = {
  cakes: 1,
  when: 2,
  contact: 3,
  payment: 4,
  submitted: 5,
}

// What the FE sends on each heartbeat. session_id is the canonical key —
// same for the entire wizard session (sessionStorage, regenerated per
// new visit). thread_id is the cross-session browser id (localStorage)
// so we can correlate a customer's abandoned cart with later orders.
export const heartbeatSchema = z.object({
  session_id: z
    .string()
    .min(6)
    .max(64)
    .regex(/^co_[\w]+$/, 'invalid session_id'),
  thread_id: z.string().min(1).max(64),
  step: z.enum(STEPS),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1).max(80),
        quantity: z.number().int().nonnegative().max(50),
        name: z.string().min(1).max(120),
        price_cents: z.number().int().nonnegative().max(1_000_000),
      }),
    )
    .max(20),
  total_cents: z.number().int().nonnegative().max(1_000_000),
  customer_name: z.string().trim().max(80).optional(),
  customer_email: z.string().trim().max(120).optional(),
  customer_phone: z.string().trim().max(40).optional(),
  pickup_or_delivery: z.enum(['pickup', 'delivery']).optional(),
  scheduled_at: z.string().max(40).optional(),
  referral_source: z.string().trim().max(64).optional(),
  order_id: z.string().max(64).optional(),
})

export type HeartbeatInput = z.infer<typeof heartbeatSchema>

export interface CheckoutRow {
  id: string
  thread_id: string
  channel: string
  last_step: CheckoutStep
  items_json: string | null
  total_cents: number
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  pickup_or_delivery: string | null
  scheduled_at: string | null
  referral_source: string | null
  order_id: string | null
  started_at: number
  last_seen_at: number
  notes: string | null
}

export function recordHeartbeat(args: HeartbeatInput): { ok: true; session_id: string } {
  const db = getDb()
  const now = Date.now()
  const itemsJson = args.items.length > 0 ? JSON.stringify(args.items) : null
  const existing = db
    .prepare('SELECT id, last_step FROM checkout_sessions WHERE id = ?')
    .get(args.session_id) as { id: string; last_step: CheckoutStep } | undefined

  if (!existing) {
    db.prepare(
      `INSERT INTO checkout_sessions
       (id, thread_id, channel, last_step, items_json, total_cents,
        customer_name, customer_email, customer_phone, pickup_or_delivery,
        scheduled_at, referral_source, order_id, started_at, last_seen_at)
       VALUES (?, ?, 'web', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      args.session_id,
      args.thread_id,
      args.step,
      itemsJson,
      args.total_cents,
      args.customer_name ?? null,
      args.customer_email ?? null,
      args.customer_phone ?? null,
      args.pickup_or_delivery ?? null,
      args.scheduled_at ?? null,
      args.referral_source ? args.referral_source.toLowerCase().slice(0, 64) : null,
      args.order_id ?? null,
      now,
      now,
    )
    return { ok: true, session_id: args.session_id }
  }

  // Clamp the step to "highest reached so far" so stepping back in the
  // wizard doesn't make the row look like a fresh cart.
  const nextStep =
    STEP_RANK[args.step] > STEP_RANK[existing.last_step] ? args.step : existing.last_step

  db.prepare(
    `UPDATE checkout_sessions SET
       last_step = ?, items_json = ?, total_cents = ?,
       customer_name = COALESCE(?, customer_name),
       customer_email = COALESCE(?, customer_email),
       customer_phone = COALESCE(?, customer_phone),
       pickup_or_delivery = COALESCE(?, pickup_or_delivery),
       scheduled_at = COALESCE(?, scheduled_at),
       referral_source = COALESCE(?, referral_source),
       order_id = COALESCE(?, order_id),
       last_seen_at = ?
     WHERE id = ?`,
  ).run(
    nextStep,
    itemsJson,
    args.total_cents,
    args.customer_name ?? null,
    args.customer_email ?? null,
    args.customer_phone ?? null,
    args.pickup_or_delivery ?? null,
    args.scheduled_at ?? null,
    args.referral_source ? args.referral_source.toLowerCase().slice(0, 64) : null,
    args.order_id ?? null,
    now,
    args.session_id,
  )
  return { ok: true, session_id: args.session_id }
}

// "Logical" status surfaces three buckets to the admin UI; the rows
// themselves only carry the funnel step.
export type CheckoutStatus = 'active' | 'abandoned' | 'submitted'

export interface CheckoutRowWithStatus extends CheckoutRow {
  status: CheckoutStatus
}

function classify(row: CheckoutRow, now: number): CheckoutStatus {
  if (row.last_step === 'submitted') return 'submitted'
  if (now - row.last_seen_at > ABANDON_AFTER_MS) return 'abandoned'
  return 'active'
}

export interface ListFilter {
  status?: CheckoutStatus | 'all'
  step?: CheckoutStep | 'all'
  limit?: number
}

export function listCheckouts(filter: ListFilter = {}): CheckoutRowWithStatus[] {
  const limit = filter.limit ?? 100
  // Pull a wide window then filter in memory — checkout_sessions is small
  // (one bakery's traffic) and we want the abandoned/active classification
  // to use a single `now` snapshot. A WHERE-on-step still narrows the SQL
  // when the user asked for one.
  const where: string[] = []
  const params: Array<string | number> = []
  if (filter.step && filter.step !== 'all') {
    where.push('last_step = ?')
    params.push(filter.step)
  }
  const sql = `SELECT * FROM checkout_sessions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY last_seen_at DESC LIMIT ?`
  const rows = getDb()
    .prepare(sql)
    .all(...params, limit * 3) as CheckoutRow[] // pull 3× to compensate for status filter

  const now = Date.now()
  const enriched = rows.map((r) => ({ ...r, status: classify(r, now) }))
  if (filter.status && filter.status !== 'all') {
    return enriched.filter((r) => r.status === filter.status).slice(0, limit)
  }
  return enriched.slice(0, limit)
}

// Funnel breakdown: counts per step, split by status. Drives the
// admin cockpit's "5 abandoned at cakes / 3 at when / …" headline.
export interface CheckoutCounts {
  total: number
  active: number
  abandoned: number
  submitted: number
  by_step: Record<CheckoutStep, { active: number; abandoned: number; submitted: number }>
  // Funnel completion rate for the past 7 days (or "—" when no signal).
  // Surfaces "of the carts that started in the last week, what fraction
  // submitted." Useful as a single big-number health metric.
  recent_completion_rate: number | null
}

export function checkoutCounts(): CheckoutCounts {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM checkout_sessions').all() as CheckoutRow[]
  const now = Date.now()
  const out: CheckoutCounts = {
    total: rows.length,
    active: 0,
    abandoned: 0,
    submitted: 0,
    by_step: {
      cakes: { active: 0, abandoned: 0, submitted: 0 },
      when: { active: 0, abandoned: 0, submitted: 0 },
      contact: { active: 0, abandoned: 0, submitted: 0 },
      payment: { active: 0, abandoned: 0, submitted: 0 },
      submitted: { active: 0, abandoned: 0, submitted: 0 },
    },
    recent_completion_rate: null,
  }
  let recentTotal = 0
  let recentSubmitted = 0
  const SEVEN_DAYS = 7 * 24 * 3600_000
  for (const r of rows) {
    const status = classify(r, now)
    out[status] += 1
    out.by_step[r.last_step][status] += 1
    if (now - r.started_at <= SEVEN_DAYS) {
      recentTotal += 1
      if (status === 'submitted') recentSubmitted += 1
    }
  }
  if (recentTotal > 0) {
    out.recent_completion_rate = recentSubmitted / recentTotal
  }
  return out
}

export function getCheckout(id: string): CheckoutRowWithStatus | null {
  const row = getDb()
    .prepare('SELECT * FROM checkout_sessions WHERE id = ?')
    .get(id) as CheckoutRow | undefined
  if (!row) return null
  return { ...row, status: classify(row, Date.now()) }
}
