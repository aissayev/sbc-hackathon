// Owner approve/reject orchestration — the only place that promotes a local
// draft to the sandbox (Square + Kitchen) and the only place that mutates an
// approved order's status from outside the agent.
//
// Order of operations on approve, per docs/02-architecture/DATA-MODEL.md:
//   1. Read the local draft.
//   2. Call sandbox `square_create_order`. Failure here = stop, leave draft.
//   3. Call sandbox `kitchen_create_ticket`. Failure here = stop, leave draft
//      (and ideally void the Square order, but we don't have a `square_void`
//      tool; orphan Square orders are acceptable since the owner can re-tap
//      Approve to retry).
//   4. Update the LOCAL row last (status='approved', store both remote ids).
//   5. Notify the customer via the original channel.
//
// Order of operations on reject:
//   1. Read draft. If already non-draft, no-op.
//   2. Update local status='rejected', store reason in `notes`.
//   3. Notify customer with the reason in brand voice.
//
// We don't go through claude -p for this orchestration — it's deterministic,
// must succeed-or-fail atomically, and we don't want LLM variability in the
// "press a button → cake is ordered" path.

import { getDb } from '../db/db.ts'
import { callSandboxTool, SandboxMcpError } from '../lib/sandbox-mcp.ts'
import { isMcpBackedStrict } from '../lib/mcp-catalog-cache.ts'

interface OrderRow {
  id: string
  thread_id: string
  channel: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  items_json: string
  total_cents: number
  scheduled_at: string | null
  pickup_or_delivery: string
  notes: string | null
  square_order_id: string | null
  kitchen_ticket_id: string | null
}

function readOrder(orderId: string): OrderRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, thread_id, channel, status, customer_name, customer_phone, items_json,
                total_cents, scheduled_at, pickup_or_delivery, notes, square_order_id, kitchen_ticket_id
         FROM orders WHERE id = ?`,
      )
      .get(orderId) as OrderRow | undefined) ?? null
  )
}

export interface ApproveResult {
  ok: boolean
  order_id: string
  square_order_id?: string
  kitchen_ticket_id?: string
  error?: string
  stage?: 'read_local' | 'pre_check' | 'square_create' | 'kitchen_create' | 'persist'
  /** Items in the draft that aren't in the sandbox MCP catalog. Owner needs to fulfill manually. */
  unsupported_skus?: string[]
  /** True when the order took the manual-fulfillment path (no Square / kitchen call). */
  manual_fulfillment?: boolean
}

export async function approveDraftAndPromote(orderId: string): Promise<ApproveResult> {
  const draft = readOrder(orderId)
  if (!draft) return { ok: false, order_id: orderId, error: 'order not found', stage: 'read_local' }
  if (draft.status === 'approved' || draft.status === 'in_kitchen') {
    // Already promoted — idempotent success.
    return {
      ok: true,
      order_id: orderId,
      square_order_id: draft.square_order_id ?? undefined,
      kitchen_ticket_id: draft.kitchen_ticket_id ?? undefined,
    }
  }
  if (draft.status !== 'draft') {
    return { ok: false, order_id: orderId, error: `order status is ${draft.status}, not draft`, stage: 'read_local' }
  }

  const items = JSON.parse(draft.items_json) as Array<{
    sku: string
    qty: number
    unit_cents: number
    line_total_cents: number
    name?: string
  }>

  // Pre-check: every SKU must exist in the sandbox MCP catalog before we can
  // call square_create_order. The local catalog (10 items) is a superset of
  // the sandbox catalog (5 items + the occasional parallel-agent addition).
  // Custom cakes typed in by the agent or the admin UI typically don't have
  // a Square variation. Without this pre-check, the approval call fails with
  // a cryptic `Unknown variationId: sq_var_<sku>` and the order gets stuck
  // — which is exactly the bug a custom-cake test surfaces.
  //
  // Items that don't have a sandbox match take the **manual-fulfillment**
  // path: locally approved, no Square/kitchen call, owner sees a clear
  // status indicating offline handling is needed.
  const unsupported: string[] = []
  for (const it of items) {
    if (!(await isMcpBackedStrict(it.sku))) {
      unsupported.push(it.sku)
    }
  }
  if (unsupported.length > 0) {
    const now = Date.now()
    getDb()
      .prepare(
        `UPDATE orders SET status = 'approved_manual', updated_at = ? WHERE id = ? AND status = 'draft'`,
      )
      .run(now, orderId)
    return {
      ok: true,
      order_id: orderId,
      manual_fulfillment: true,
      unsupported_skus: unsupported,
      stage: 'pre_check',
    }
  }

  // Step 1: Square POS order. The simulator catalog uses `sq_var_<id-with-underscores>`
  // for variation IDs. Response shape (verified live):
  //   { mode: 'simulated', order: { id, source, items, totalCents, status, ... } }
  let squareOrderId: string
  try {
    const square = await callSandboxTool<{
      mode?: string
      order?: { id?: string; status?: string; totalCents?: number }
    }>('square_create_order', {
      items: items.map((it) => ({
        variationId: `sq_var_${it.sku.replace(/-/g, '_')}`,
        quantity: it.qty,
        note: it.name,
      })),
      source: draft.channel === 'web' ? 'website' : draft.channel,
      customerName: draft.customer_name ?? undefined,
      customerNote: draft.notes ?? undefined,
    })
    squareOrderId = square.order?.id ?? ''
    if (!squareOrderId) {
      return {
        ok: false,
        order_id: orderId,
        error: `square_create_order returned no order.id (shape: ${JSON.stringify(square).slice(0, 200)})`,
        stage: 'square_create',
      }
    }
  } catch (err) {
    return {
      ok: false,
      order_id: orderId,
      error: err instanceof SandboxMcpError ? err.message : (err as Error).message,
      stage: 'square_create',
    }
  }

  // Step 2: Kitchen ticket. Response shape varies — try a few common field names.
  let kitchenTicketId: string
  try {
    const ticket = await callSandboxTool<{
      ticket?: { id?: string }
      ticketId?: string
      id?: string
    }>('kitchen_create_ticket', {
      orderId: squareOrderId,
      customerName: draft.customer_name ?? 'Customer',
      items: items.map((it) => ({ productId: it.sku, quantity: it.qty })),
      requestedPickupAt: draft.scheduled_at ?? undefined,
      notes: draft.notes ?? undefined,
    })
    kitchenTicketId = ticket.ticket?.id ?? ticket.ticketId ?? ticket.id ?? ''
    if (!kitchenTicketId) {
      return {
        ok: false,
        order_id: orderId,
        error: `kitchen_create_ticket returned no ticket id (shape: ${JSON.stringify(ticket).slice(0, 200)})`,
        stage: 'kitchen_create',
        square_order_id: squareOrderId,
      }
    }
  } catch (err) {
    return {
      ok: false,
      order_id: orderId,
      error: err instanceof SandboxMcpError ? err.message : (err as Error).message,
      stage: 'kitchen_create',
      square_order_id: squareOrderId,
    }
  }

  // Step 3: Persist locally LAST. If this fails (rare — local SQLite),
  // re-tapping Approve is idempotent (we no-op if status is already approved
  // and we have remote ids).
  const now = Date.now()
  getDb()
    .prepare(
      `UPDATE orders SET status = 'approved', square_order_id = ?, kitchen_ticket_id = ?, updated_at = ?
       WHERE id = ? AND status = 'draft'`,
    )
    .run(squareOrderId, kitchenTicketId, now, orderId)

  return {
    ok: true,
    order_id: orderId,
    square_order_id: squareOrderId,
    kitchen_ticket_id: kitchenTicketId,
  }
}

export interface RejectResult {
  ok: boolean
  order_id: string
  error?: string
}

export async function rejectDraft(orderId: string, reason: string): Promise<RejectResult> {
  const draft = readOrder(orderId)
  if (!draft) return { ok: false, order_id: orderId, error: 'order not found' }
  if (draft.status === 'rejected') return { ok: true, order_id: orderId } // idempotent
  if (draft.status !== 'draft') {
    return { ok: false, order_id: orderId, error: `order status is ${draft.status}, not draft` }
  }
  getDb()
    .prepare(`UPDATE orders SET status = 'rejected', notes = ?, updated_at = ? WHERE id = ?`)
    .run(reason, Date.now(), orderId)
  return { ok: true, order_id: orderId }
}

/** Read a draft for callers that need to send customer-facing notifications. */
export function readDraft(orderId: string) {
  return readOrder(orderId)
}
