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
})

export type CreateDraftOrderResult =
  | { ok: false; reason: string }
  | {
      ok: true
      order_id: string
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
  getDb()
    .prepare(
      `INSERT INTO orders
       (id, thread_id, channel, status, customer_name, customer_phone, items_json, total_cents, scheduled_at, pickup_or_delivery, notes, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      now,
      now,
    )
  return { ok: true, order_id: id, total_cents: total, items: itemsResolved, status: 'draft' as const }
}

export const getOrderStatusSchema = z.object({
  order_id: z.string(),
})

// Customer-facing surfaces show only the trailing chunk of the order id
// (e.g. "#4_UG4G4J" — the last 8 chars of "ord_<ms>_UG4G4J"). When that's
// the value the customer pastes back into chat or the /track form, the
// strict `WHERE id = ?` lookup misses. Try the exact match first; if
// nothing comes back AND the input looks like a partial code, retry with
// a suffix LIKE. We require at least 6 chars to keep collisions extremely
// improbable (the random suffix alone is base36-6 ≈ 2 billion).
export function getOrderStatus(args: z.infer<typeof getOrderStatusSchema>) {
  const db = getDb()
  const select =
    'SELECT id, status, total_cents, scheduled_at, customer_name, pickup_or_delivery, kitchen_ticket_id FROM orders'

  // Customers often paste the displayed code with a leading `#` and
  // surrounding whitespace; strip both before matching.
  const cleaned = args.order_id.trim().replace(/^#+/, '')
  const exact = db.prepare(`${select} WHERE id = ?`).get(cleaned)
  if (exact) return exact

  if (cleaned.length >= 6 && !cleaned.startsWith('ord_')) {
    const candidates = db
      .prepare(`${select} WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2`)
      .all(`%${cleaned}`) as Array<{ id: string }>
    if (candidates.length === 1) return candidates[0]
    // Ambiguous: the same suffix matches multiple orders. Force the
    // customer (or agent) to use the full id rather than guess.
    if (candidates.length > 1) {
      return { ok: false, reason: 'short code matches multiple orders — use the full id starting with `ord_`' }
    }
  }

  return { ok: false, reason: 'order not found' }
}

export function listOrders(filter?: { status?: string; limit?: number }) {
  const limit = filter?.limit ?? 50
  if (filter?.status) {
    return getDb()
      .prepare(
        `SELECT id, status, total_cents, customer_name, scheduled_at, created_at FROM orders
         WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(filter.status, limit)
  }
  return getDb()
    .prepare(
      `SELECT id, status, total_cents, customer_name, scheduled_at, created_at FROM orders
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)
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

// ─── Channel types re-export for MCP server's convenience ────────────────

export type { Channel }
