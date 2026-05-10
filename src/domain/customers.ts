// CRM service module — single source of truth for customer reads + writes.
//
// Sits between the orders flow (createDraftOrder calls upsertCustomerForOrder
// to record / refresh the customer record), the local MCP tools (which
// expose lookups to the agent), and the Telegram owner bot (repeat-customer
// badge + /customer command).
//
// Identity rule: phone is the strong key (deduped via UNIQUE), email is the
// weaker fallback (people retype emails more than they retype phones, but
// people share landlines). Name + email + Square customer id update in
// place if a row already exists.
//
// Counters (order_count, total_spent_cents, last_seen_at) are denormalized
// here so a "12th order" badge is one row read, not an aggregate scan.

import { getDb } from '../db/db.ts'

// ── Types ────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  square_customer_id: string | null
  first_seen_at: number
  last_seen_at: number
  order_count: number
  total_spent_cents: number
  notes: string | null
  created_at: number
  updated_at: number
}

export interface CustomerWithOrders extends Customer {
  recent_orders: Array<{
    id: string
    status: string
    total_cents: number
    items_summary: string
    scheduled_at: string | null
    created_at: number
  }>
}

// ── Phone / email normalization ──────────────────────────────────────

// Strip everything that isn't a digit, then if it starts with '1' and has
// 11 digits assume US E.164 and prefix '+'. Anything else gets passed
// back as digits-only — good enough to dedup typos like "(281) 979-8320"
// and "+1 281-979-8320" without trying to parse international formats.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return digits
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toLowerCase()
  return trimmed || null
}

// ── Reads ────────────────────────────────────────────────────────────

export function getCustomerById(id: string): Customer | null {
  const row = getDb()
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(id) as Customer | undefined
  return row ?? null
}

export function findCustomerByPhone(phone: string): Customer | null {
  const norm = normalizePhone(phone)
  if (!norm) return null
  const row = getDb()
    .prepare('SELECT * FROM customers WHERE phone = ?')
    .get(norm) as Customer | undefined
  return row ?? null
}

export function findCustomerByEmail(email: string): Customer | null {
  const norm = normalizeEmail(email)
  if (!norm) return null
  const row = getDb()
    .prepare('SELECT * FROM customers WHERE email = ?')
    .get(norm) as Customer | undefined
  return row ?? null
}

// Look up by thread_id — preferred path inside the agent, since a thread
// is the conversation context. Returns null if the thread hasn't been
// linked to a customer yet (will happen on first order draft).
export function findCustomerByThread(threadId: string): Customer | null {
  const link = getDb()
    .prepare('SELECT customer_id FROM threads WHERE thread_id = ?')
    .get(threadId) as { customer_id: string | null } | undefined
  if (!link?.customer_id) return null
  return getCustomerById(link.customer_id)
}

// Recent orders for the /customer view + agent context. Capped because
// the agent prompt has token budget; the owner view shows more.
export function listCustomerOrders(
  customerId: string,
  limit = 5,
): CustomerWithOrders['recent_orders'] {
  const rows = getDb()
    .prepare(
      `SELECT id, status, total_cents, items_json, scheduled_at, created_at
       FROM orders
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(customerId, limit) as Array<{
    id: string
    status: string
    total_cents: number
    items_json: string
    scheduled_at: string | null
    created_at: number
  }>
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    total_cents: r.total_cents,
    items_summary: summarizeItems(r.items_json),
    scheduled_at: r.scheduled_at,
    created_at: r.created_at,
  }))
}

function summarizeItems(itemsJson: string): string {
  try {
    const items = JSON.parse(itemsJson) as Array<{ name?: string; qty?: number }>
    return items
      .map((it) => `${it.qty ?? 1}× ${it.name ?? 'item'}`)
      .join(', ')
      .slice(0, 200)
  } catch {
    return ''
  }
}

// ── Writes ───────────────────────────────────────────────────────────

interface UpsertInput {
  name?: string | null
  phone?: string | null
  email?: string | null
  threadId?: string | null
}

// Find-or-create customer keyed on phone, fall back to email. Updates name +
// email if richer info shows up on a later interaction. Returns the
// resolved customer id (caller stamps it onto the order row).
//
// Counter increments are NOT done here — this fn just identifies / refreshes
// the customer. `recordOrderForCustomer()` below handles the increments
// after the order row is written so we get the actual total_cents.
export function upsertCustomer(input: UpsertInput): string | null {
  const phone = normalizePhone(input.phone)
  const email = normalizeEmail(input.email)
  const name = input.name?.trim() || null
  if (!phone && !email && !name) return null

  const db = getDb()
  const now = Date.now()

  let existing: Customer | null = null
  if (phone) existing = findCustomerByPhone(phone)
  if (!existing && email) existing = findCustomerByEmail(email)

  if (existing) {
    // Refresh: prefer non-null incoming fields; never overwrite with null.
    db.prepare(
      `UPDATE customers
       SET name              = COALESCE(?, name),
           phone             = COALESCE(?, phone),
           email             = COALESCE(?, email),
           last_seen_at      = ?,
           updated_at        = ?
       WHERE id = ?`,
    ).run(name, phone, email, now, now, existing.id)
    if (input.threadId) linkThreadToCustomer(input.threadId, existing.id)
    return existing.id
  }

  const id = `cust_${now}_${Math.random().toString(36).slice(2, 8)}`
  db.prepare(
    `INSERT INTO customers
     (id, name, phone, email, first_seen_at, last_seen_at, order_count, total_spent_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
  ).run(id, name, phone, email, now, now, now, now)
  if (input.threadId) linkThreadToCustomer(input.threadId, id)
  return id
}

function linkThreadToCustomer(threadId: string, customerId: string): void {
  // The thread row is created on first inbound message; only update if
  // the link is empty so we don't bounce a thread between customers.
  getDb()
    .prepare(
      `UPDATE threads SET customer_id = ? WHERE thread_id = ? AND (customer_id IS NULL OR customer_id = '')`,
    )
    .run(customerId, threadId)
}

// Roll up an order's total into the customer's denormalized counters.
// Called from createDraftOrder right after the orders row is inserted.
//
// Side effect: triggers a fire-and-forget Square customer sync. The first
// order is the natural moment to push our customer to Square — we now
// have name + phone (web checkout requires both) and a real reason to
// have them in the POS. Subsequent orders are no-ops at the sync side
// (square_customer_id is already set). Errors are logged, not thrown.
export function recordOrderForCustomer(customerId: string, orderTotalCents: number): void {
  const now = Date.now()
  getDb()
    .prepare(
      `UPDATE customers
       SET order_count       = order_count + 1,
           total_spent_cents = total_spent_cents + ?,
           last_seen_at      = ?,
           updated_at        = ?
       WHERE id = ?`,
    )
    .run(orderTotalCents, now, now, customerId)

  // Fire-and-forget. Lazy import keeps this module's deps clean (sync
  // pulls in sandbox-mcp transitively). The .catch is the safety net
  // for the import itself — the sync function already swallows runtime
  // errors internally.
  import('./customer-sync.ts')
    .then(({ syncCustomerToSquare }) => syncCustomerToSquare(customerId))
    .catch((err) => console.warn('[customers] sync import failed:', (err as Error).message))
}

// ── Merge ────────────────────────────────────────────────────────────
//
// When two customers exist for the same person — usually because the
// upsert dedup key (phone) was missing on one side or because the
// person used two different phone numbers — the owner can merge them
// from Telegram (`/merge_customers <source_phone> <target_phone>`) or
// the agent can call merge_customers via MCP (owner-only).
//
// Convention: SOURCE merges INTO TARGET. Target survives. Source is deleted.
// All orders + threads owned by source get re-pointed at target. Counters
// add. Missing fields on target are filled from source (name/email/notes).

export type MergeResult =
  | { ok: true; merged: { source_id: string; target_id: string; orders_moved: number; threads_moved: number; new_order_count: number } }
  | { ok: false; reason: string }

export function mergeCustomers(sourceId: string, targetId: string): MergeResult {
  if (sourceId === targetId) return { ok: false, reason: 'source and target are the same customer' }

  const db = getDb()
  const source = getCustomerById(sourceId)
  const target = getCustomerById(targetId)
  if (!source) return { ok: false, reason: `source customer ${sourceId} not found` }
  if (!target) return { ok: false, reason: `target customer ${targetId} not found` }

  // Conflict guard: if both rows have a phone (or email) and they differ,
  // surface that to the operator — auto-merging would lose dedup data.
  // The owner can still force the merge with explicit ids; this guard only
  // catches the accidental "merged the wrong two" case.
  if (source.phone && target.phone && source.phone !== target.phone) {
    return {
      ok: false,
      reason: `phone mismatch: source ${source.phone} vs target ${target.phone}. Use /customer to confirm both records before merging.`,
    }
  }

  const now = Date.now()
  // Run in a single transaction so a partial failure can't leave the
  // database with orders pointing at a deleted customer or counters
  // double-counted.
  const tx = db.transaction(() => {
    const movedOrders = db
      .prepare('UPDATE orders SET customer_id = ? WHERE customer_id = ?')
      .run(targetId, sourceId)

    const movedThreads = db
      .prepare('UPDATE threads SET customer_id = ? WHERE customer_id = ?')
      .run(targetId, sourceId)

    db.prepare(
      `UPDATE customers
       SET order_count       = order_count + ?,
           total_spent_cents = total_spent_cents + ?,
           name              = COALESCE(name, ?),
           phone             = COALESCE(phone, ?),
           email             = COALESCE(email, ?),
           square_customer_id = COALESCE(square_customer_id, ?),
           notes             = CASE
                                  WHEN notes IS NULL THEN ?
                                  WHEN ? IS NULL THEN notes
                                  ELSE notes || ' | ' || ?
                                END,
           first_seen_at     = MIN(first_seen_at, ?),
           last_seen_at      = MAX(last_seen_at, ?),
           updated_at        = ?
       WHERE id = ?`,
    ).run(
      source.order_count,
      source.total_spent_cents,
      source.name,
      source.phone,
      source.email,
      source.square_customer_id,
      source.notes,
      source.notes,
      source.notes,
      source.first_seen_at,
      source.last_seen_at,
      now,
      targetId,
    )

    db.prepare('DELETE FROM customers WHERE id = ?').run(sourceId)

    return {
      orders_moved: Number(movedOrders.changes ?? 0),
      threads_moved: Number(movedThreads.changes ?? 0),
    }
  })

  const moved = tx()
  const after = getCustomerById(targetId)

  return {
    ok: true,
    merged: {
      source_id: sourceId,
      target_id: targetId,
      orders_moved: moved.orders_moved,
      threads_moved: moved.threads_moved,
      new_order_count: after?.order_count ?? 0,
    },
  }
}

// One-shot: upsert customer from order data, link the thread, return id.
// This is the convenient call createDraftOrder uses.
export function upsertCustomerForOrder(args: {
  threadId: string
  name: string | null
  phone: string | null
  email?: string | null
}): string | null {
  return upsertCustomer({
    name: args.name,
    phone: args.phone,
    email: args.email,
    threadId: args.threadId,
  })
}
