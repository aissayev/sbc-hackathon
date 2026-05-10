// Pure domain operations. No HTTP, no MCP wire concerns. The local MCP server
// in src/agent/mcp/local-server.ts wraps these; HTTP routes call them too.
//
// The sandbox MCP is the source of truth at runtime for: real catalog, kitchen
// capacity, marketing campaigns. These local versions are fallbacks for the
// website (always-on) and for thread/order state we own.

import { z } from 'zod'
import { getDb } from '../db/db.ts'
import type { Channel } from '../channels/types.ts'

// ─── Products / catalog ──────────────────────────────────────────────────

export const listProductsSchema = z.object({
  category: z.string().optional(),
  in_stock_only: z.boolean().default(true),
})

export type ListProductsArgs = z.infer<typeof listProductsSchema>

export interface Product {
  id: string
  name: string
  category: string
  price_cents: number
  lead_time_hours: number
  allergens: string | null
  description: string | null
  photo_url: string | null
  in_stock: number
  daily_capacity: number | null
}

export function listProducts(args: ListProductsArgs): Product[] {
  const where: string[] = []
  const params: string[] = []
  if (args.category) {
    where.push('category = ?')
    params.push(args.category)
  }
  if (args.in_stock_only) where.push('in_stock = 1')
  const sql = `SELECT id, name, category, price_cents, lead_time_hours, allergens, description, photo_url, in_stock, daily_capacity
              FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
              ORDER BY category, name`
  return getDb().prepare(sql).all(...params) as Product[]
}

export function getProduct(id: string): Product | null {
  return (
    (getDb()
      .prepare(
        'SELECT id, name, category, price_cents, lead_time_hours, allergens, description, photo_url, in_stock, daily_capacity FROM products WHERE id = ?',
      )
      .get(id) as Product | undefined) ?? null
  )
}

// ─── Constraints check ──────────────────────────────────────────────────

export const checkConstraintsSchema = z.object({
  product_id: z.string(),
  scheduled_at_iso: z.string(),
})

export function checkConstraints(args: z.infer<typeof checkConstraintsSchema>) {
  const product = getProduct(args.product_id)
  if (!product) return { ok: false, reason: 'product not found' }
  if (!product.in_stock) return { ok: false, reason: 'out of stock' }
  const scheduled = new Date(args.scheduled_at_iso).getTime()
  if (Number.isNaN(scheduled)) return { ok: false, reason: 'invalid scheduled_at_iso' }
  const minimumStart = Date.now() + product.lead_time_hours * 3600_000
  if (scheduled < minimumStart) {
    return {
      ok: false,
      reason: `lead time is ${product.lead_time_hours}h`,
      earliest_iso: new Date(minimumStart).toISOString(),
    }
  }
  return { ok: true }
}

// ─── Orders ──────────────────────────────────────────────────────────────

export const createDraftOrderSchema = z.object({
  thread_id: z.string(),
  channel: z.enum(['whatsapp', 'instagram', 'web', 'telegram']),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  items: z.array(z.object({ product_id: z.string(), quantity: z.number().int().positive() })).min(1),
  scheduled_at_iso: z.string().optional(),
  pickup_or_delivery: z.enum(['pickup', 'delivery']).default('pickup'),
  notes: z.string().optional(),
  // Attribution. Comes from `?ref=<token>` on the campaign URL the customer
  // landed on. Free-form short slug — `ig`, `gbp`, `email-2026-05`, partner
  // codes — capped at 64 chars and normalized to lowercase. Logged so the
  // owner can answer "where did this customer come from".
  referral_source: z.string().min(1).max(64).optional(),
})

export type CreateDraftOrderResult =
  | { ok: false; reason: string }
  | {
      ok: true
      order_id: string
      // Short customer-facing alias — digits only, e.g. "1042". Stable
      // per order (derived from SQLite ROWID). Surface this anywhere a
      // human would read the id back over the phone or write it down on
      // a sticky note. UI prefixes a `#` for display.
      friendly_id: string
      total_cents: number
      items: Array<{ sku: string; qty: number; unit_cents: number; line_total_cents: number; name: string }>
      status: 'draft'
    }

export function createDraftOrder(args: z.infer<typeof createDraftOrderSchema>): CreateDraftOrderResult {
  let total = 0
  const itemsResolved: Array<{ sku: string; qty: number; unit_cents: number; line_total_cents: number; name: string }> = []
  for (const it of args.items) {
    const p = getProduct(it.product_id)
    if (!p) return { ok: false, reason: `unknown product ${it.product_id}` }
    const lineTotal = p.price_cents * it.quantity
    total += lineTotal
    itemsResolved.push({
      sku: p.id,
      qty: it.quantity,
      unit_cents: p.price_cents,
      line_total_cents: lineTotal,
      name: p.name,
    })
  }
  const id = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  const result = getDb()
    .prepare(
      `INSERT INTO orders
       (id, thread_id, channel, status, customer_name, customer_phone, items_json, total_cents, scheduled_at, pickup_or_delivery, notes, referral_source, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      args.thread_id,
      args.channel,
      args.customer_name ?? null,
      args.customer_phone ?? null,
      JSON.stringify(itemsResolved),
      total,
      args.scheduled_at_iso ?? null,
      args.pickup_or_delivery,
      args.notes ?? null,
      args.referral_source ? args.referral_source.toLowerCase().slice(0, 64) : null,
      now,
      now,
    )
  // better-sqlite3's `run` returns lastInsertRowid as a bigint or number
  // depending on the driver build; coerce to number for our offset math.
  // The orders table's rowid is monotonically increasing, never reused.
  const rowid = Number(result.lastInsertRowid)
  return {
    ok: true,
    order_id: id,
    friendly_id: friendlyOrderId(rowid),
    total_cents: total,
    items: itemsResolved,
    status: 'draft' as const,
  }
}

export const getOrderStatusSchema = z.object({
  order_id: z.string(),
})

// Categories that REQUIRE explicit owner approval before going to the
// kitchen. Standard SKUs (slices, whole cakes, pastries) auto-approve so
// the customer sees "in the kitchen" immediately on the tracker. Custom
// designs and catering volume need Askhat to eyeball date / quantity /
// allergen requests first.
const APPROVAL_REQUIRED_CATEGORIES = new Set(['custom', 'catering'])

interface OrderRowFull {
  // SQLite's auto-assigned ROWID. Used to derive a short customer-friendly
  // alias (`<rowid+offset>`, e.g. "1042") so people can read order numbers
  // over the phone without spelling out a 24-char `ord_<ms>_<rand>` ID.
  // The full `id` remains the canonical primary key for internal references.
  rowid: number
  id: string
  status: string
  total_cents: number
  scheduled_at: string | null
  customer_name: string | null
  pickup_or_delivery: string
  kitchen_ticket_id: string | null
  items_json: string | null
}

// Customer-facing alias for an order. Derived from SQLite ROWID so it's
// stable, sequential, and trivially short. We start at 1001 (offset 1000
// + rowid 1) so the smallest alias is four digits — feels like a real
// order number, not "order 1 of all time".
//
// We deliberately store/return digits-only ("1042"). The UI prefixes a `#`
// for display, the agent reads it aloud as "ten-forty-two". A grandma or
// kid can write down `1042` and call back; nobody has to spell out
// "ord_1778…UG4G4J" any more.
const FRIENDLY_ID_OFFSET = 1000

export function friendlyOrderId(rowid: number): string {
  return String(rowid + FRIENDLY_ID_OFFSET)
}

// Resolve a customer-typed friendly id back to its rowid. Accepts every
// shape we've ever shown a customer, plus the obvious typo'd variants:
//   "1042"     · canonical (digits only)
//   "#1042"    · with leading hash
//   "HC-1042"  · legacy prefix from the first cut of this feature
//   "hc 1042"  · case-insensitive, separator-tolerant
// Returns null if the input doesn't look like a friendly id, or if the
// derived rowid is below 1 (offset is the floor).
export function parseFriendlyOrderId(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/^#+/, '')
    .replace(/^hc[\s_-]*/i, '')
  if (!/^\d+$/.test(cleaned)) return null
  const n = Number.parseInt(cleaned, 10)
  if (n <= FRIENDLY_ID_OFFSET) return null
  return n - FRIENDLY_ID_OFFSET
}

interface StoredItem {
  sku: string
  qty: number
  unit_cents: number
  line_total_cents: number
  name: string
}

/**
 * True when ANY of the order's items is in a category that needs the owner
 * to approve before the kitchen starts (custom designs, catering volume).
 * Standard slices / whole cakes / pastries return false → auto-approve.
 */
export function orderRequiresApproval(items: StoredItem[]): boolean {
  for (const it of items) {
    const product = getProduct(it.sku)
    if (product && APPROVAL_REQUIRED_CATEGORIES.has(product.category)) return true
  }
  return false
}

function shapeOrderStatus(row: OrderRowFull) {
  const items: StoredItem[] = row.items_json ? (JSON.parse(row.items_json) as StoredItem[]) : []
  return {
    id: row.id,
    // Short customer-facing alias. Stable per-order — derived from the
    // immutable SQLite ROWID — so "1042" prints the same in chat,
    // confirmation page, tracker, and the owner's TG card. UI surfaces
    // it as `#1042`; we store digits-only so the value round-trips
    // through URL paths (`/track/1042`) without escaping.
    friendly_id: friendlyOrderId(row.rowid),
    status: row.status,
    total_cents: row.total_cents,
    scheduled_at: row.scheduled_at,
    customer_name: row.customer_name,
    pickup_or_delivery: row.pickup_or_delivery,
    kitchen_ticket_id: row.kitchen_ticket_id,
    items,
    // Derived flag the customer-facing tracker uses to decide whether to
    // render the 4-step timeline (with "Approved") or the 3-step one
    // (Order received → In the kitchen → Ready). Stable across status
    // transitions — depends only on the items, not the current status.
    requires_approval: orderRequiresApproval(items),
  }
}

// Customer-facing surfaces show only the trailing chunk of the order id
// (e.g. "#4_UG4G4J" — the last 8 chars of "ord_<ms>_UG4G4J"). When that's
// the value the customer pastes back into chat or the /track form, the
// strict `WHERE id = ?` lookup misses. Try the exact match first; if
// nothing comes back AND the input looks like a partial code, retry with
// a suffix LIKE. We require at least 6 chars to keep collisions extremely
// improbable (the random suffix alone is base36-6 ≈ 2 billion).
export function getOrderStatus(args: z.infer<typeof getOrderStatusSchema>) {
  const db = getDb()
  // Pull rowid alongside the row so shapeOrderStatus can derive the
  // friendly alias without a second round-trip.
  const select =
    'SELECT rowid, id, status, total_cents, scheduled_at, customer_name, pickup_or_delivery, kitchen_ticket_id, items_json FROM orders'

  // Customers often paste the displayed code with a leading `#` and
  // surrounding whitespace; strip both before matching.
  const cleaned = args.order_id.trim().replace(/^#+/, '')

  // 1. Try the canonical full id first — the value our internal callers
  //    always pass and what `formatOrderId(..., 'full')` prints.
  const exact = db.prepare(`${select} WHERE id = ?`).get(cleaned) as OrderRowFull | undefined
  if (exact) return shapeOrderStatus(exact)

  // 2. Try the friendly alias ("1042", "#1042", or legacy "HC-1042").
  //    Customers naturally quote this back over the phone or paste it from
  //    the confirmation page. Resolves through SQLite's stable ROWID.
  const friendlyRowid = parseFriendlyOrderId(cleaned)
  if (friendlyRowid !== null) {
    const byRowid = db.prepare(`${select} WHERE rowid = ?`).get(friendlyRowid) as OrderRowFull | undefined
    if (byRowid) return shapeOrderStatus(byRowid)
  }

  // 3. Fall back to suffix match for partial codes ("UG4G4J"). Only
  //    triggers when the input doesn't already look like a full id and
  //    is at least 6 chars (random suffix is base36-6 ≈ 2 billion → no
  //    collisions for any realistic catalog).
  if (cleaned.length >= 6 && !cleaned.startsWith('ord_') && friendlyRowid === null) {
    const candidates = db
      .prepare(`${select} WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2`)
      .all(`%${cleaned}`) as OrderRowFull[]
    if (candidates.length === 1) return shapeOrderStatus(candidates[0])
    if (candidates.length > 1) {
      return { ok: false, reason: 'short code matches multiple orders — use the full id starting with `ord_`' }
    }
  }

  return { ok: false, reason: 'order not found' }
}

interface OrderListRow {
  rowid: number
  id: string
  status: string
  total_cents: number
  customer_name: string | null
  scheduled_at: string | null
  created_at: number
}

interface ListedOrder {
  id: string
  friendly_id: string
  status: string
  total_cents: number
  customer_name: string | null
  scheduled_at: string | null
  created_at: number
}

function shapeListed(row: OrderListRow): ListedOrder {
  return {
    id: row.id,
    friendly_id: friendlyOrderId(row.rowid),
    status: row.status,
    total_cents: row.total_cents,
    customer_name: row.customer_name,
    scheduled_at: row.scheduled_at,
    created_at: row.created_at,
  }
}

export function listOrders(filter?: { status?: string; limit?: number }): ListedOrder[] {
  const limit = filter?.limit ?? 50
  const rows = filter?.status
    ? (getDb()
        .prepare(
          `SELECT rowid, id, status, total_cents, customer_name, scheduled_at, created_at FROM orders
           WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .all(filter.status, limit) as OrderListRow[])
    : (getDb()
        .prepare(
          `SELECT rowid, id, status, total_cents, customer_name, scheduled_at, created_at FROM orders
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(limit) as OrderListRow[])
  return rows.map(shapeListed)
}

export function updateOrderStatus(orderId: string, status: string, note?: string) {
  const now = Date.now()
  const result = getDb()
    .prepare('UPDATE orders SET status = ?, updated_at = ?, notes = COALESCE(?, notes) WHERE id = ?')
    .run(status, now, note ?? null, orderId)
  return { ok: result.changes > 0 }
}

// ─── Leads (B2B inquiries, custom-cake design requests) ─────────────────
//
// Leads are inbound interest the owner wants triaged: B2B catering / gifting,
// custom-cake design with photo references, etc. They land in the `leads`
// table and the owner-side TG bot picks them up off `getRecentLeads`.

export const createLeadSchema = z.object({
  source: z.enum(['b2b', 'custom-cake', 'newsletter', 'press']),
  contact: z.string().min(1),
  thread_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
})

export function createLead(args: z.infer<typeof createLeadSchema>) {
  const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  getDb()
    .prepare(
      `INSERT INTO leads (id, source, source_ref, campaign_id, thread_id, contact, status, meta_json, created_at)
       VALUES (?, ?, NULL, NULL, ?, ?, 'new', ?, ?)`,
    )
    .run(id, args.source, args.thread_id ?? null, args.contact, args.meta ? JSON.stringify(args.meta) : null, Date.now())
  return { ok: true, lead_id: id }
}

export function listLeads(filter?: { source?: string; status?: string; limit?: number }) {
  const where: string[] = []
  const params: Array<string | number> = []
  if (filter?.source) { where.push('source = ?'); params.push(filter.source) }
  if (filter?.status) { where.push('status = ?'); params.push(filter.status) }
  const limit = filter?.limit ?? 100
  const sql = `SELECT id, source, contact, thread_id, status, meta_json, created_at FROM leads
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC LIMIT ?`
  params.push(limit)
  return getDb().prepare(sql).all(...params)
}

// ─── Escalations ─────────────────────────────────────────────────────────

export const escalateSchema = z.object({
  thread_id: z.string(),
  channel: z.enum(['whatsapp', 'instagram', 'web', 'telegram']),
  reason: z.string(),
  context: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).default('low'),
})

// Within this window, a duplicate escalation for the same (thread_id, reason)
// returns the existing id instead of creating a new row. Stops a retry-happy
// agent from flooding the owner inbox with the same hand-off after a tool
// hiccup, while still letting genuinely new escalations through.
const ESCALATION_DEDUP_WINDOW_MS = 60_000

export function escalate(args: z.infer<typeof escalateSchema>) {
  const now = Date.now()
  const existing = getDb()
    .prepare(
      `SELECT id FROM escalations
       WHERE thread_id = ? AND reason = ? AND status = 'open' AND created_at >= ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(args.thread_id, args.reason, now - ESCALATION_DEDUP_WINDOW_MS) as { id: string } | undefined
  if (existing) {
    return { ok: true, escalation_id: existing.id, deduplicated: true as const }
  }
  const id = `esc_${now}_${Math.random().toString(36).slice(2, 8)}`
  getDb()
    .prepare(
      `INSERT INTO escalations (id, thread_id, channel, reason, severity, context_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(id, args.thread_id, args.channel, args.reason, args.severity, args.context ?? null, now)
  return { ok: true, escalation_id: id }
}

export function listEscalations(filter?: { status?: string }) {
  if (filter?.status) {
    return getDb()
      .prepare(
        `SELECT id, thread_id, channel, reason, severity, status, created_at FROM escalations
         WHERE status = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .all(filter.status)
  }
  return getDb()
    .prepare(
      `SELECT id, thread_id, channel, reason, severity, status, created_at FROM escalations
       ORDER BY created_at DESC LIMIT 100`,
    )
    .all()
}

// ─── Reporting ───────────────────────────────────────────────────────────

export function dailyReport(): {
  date: string
  orders_count: number
  revenue_cents: number
  pending_approval: number
  escalations_open: number
} {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const since = startOfDay.getTime()
  const db = getDb()
  const orders = db
    .prepare("SELECT COUNT(*) as n, COALESCE(SUM(total_cents), 0) as rev FROM orders WHERE created_at >= ? AND status NOT IN ('rejected','cancelled')")
    .get(since) as { n: number; rev: number }
  const pending = db
    .prepare("SELECT COUNT(*) as n FROM orders WHERE status = 'draft'")
    .get() as { n: number }
  const escs = db
    .prepare("SELECT COUNT(*) as n FROM escalations WHERE status = 'open'")
    .get() as { n: number }
  return {
    date: new Date(since).toISOString().slice(0, 10),
    orders_count: orders.n,
    revenue_cents: orders.rev,
    pending_approval: pending.n,
    escalations_open: escs.n,
  }
}

// ─── Referral attribution ────────────────────────────────────────────────
//
// Reads `?ref=<token>` tags off the orders table (set on draft creation) and
// rolls them up so the owner can see which campaigns / partners are landing
// real revenue. Window defaults to month-to-date but is callable for any
// time range (`since` ms epoch).

export interface ReferralRow {
  source: string
  orders: number
  revenue_cents: number
}

export function referralSummary(opts?: { since?: number; limit?: number }): {
  rows: ReferralRow[]
  total_orders: number
  total_revenue_cents: number
  attributed_orders: number
  attributed_revenue_cents: number
} {
  const limit = opts?.limit ?? 10
  // Default: month-to-date.
  const since = opts?.since ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const db = getDb()
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS rev
       FROM orders
       WHERE created_at >= ? AND status NOT IN ('rejected','cancelled')`,
    )
    .get(since) as { n: number; rev: number }
  const attributed = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS rev
       FROM orders
       WHERE created_at >= ? AND status NOT IN ('rejected','cancelled')
         AND referral_source IS NOT NULL`,
    )
    .get(since) as { n: number; rev: number }
  const rows = db
    .prepare(
      `SELECT referral_source AS source, COUNT(*) AS orders, COALESCE(SUM(total_cents), 0) AS revenue_cents
       FROM orders
       WHERE created_at >= ? AND referral_source IS NOT NULL
         AND status NOT IN ('rejected','cancelled')
       GROUP BY referral_source
       ORDER BY revenue_cents DESC, orders DESC
       LIMIT ?`,
    )
    .all(since, limit) as ReferralRow[]
  return {
    rows,
    total_orders: totals.n,
    total_revenue_cents: totals.rev,
    attributed_orders: attributed.n,
    attributed_revenue_cents: attributed.rev,
  }
}

// ─── Channel types re-export for MCP server's convenience ────────────────

export type { Channel }
