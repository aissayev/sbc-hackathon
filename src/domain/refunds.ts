// Customer-initiated refund flow, owner-approved.
//
// Triggered by the concierge agent when a customer asks for a refund on
// any channel. Creates a `refund_requests` row, flips the linked order's
// status to `refund_pending`, and posts a TG card to the owner. The
// owner's tap on Approve/Deny in TG calls back into approveRefund /
// denyRefund here. On approve we attempt a Square sandbox status update
// (best-effort — the sandbox doesn't expose a real refund endpoint, so
// we mark the order CANCELED in Square and `refunded` locally). On deny
// we revert the order to its prior status and stash the owner's reason
// for the customer-facing reply.
//
// All three operations are idempotent — retries on TG callbacks (or a
// tool flake at the MCP layer) won't create duplicate rows or double-
// flip state.

import { z } from 'zod'
import { getDb } from '../db/db.ts'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { replyToInboxThread, type InboxChannel } from './inbox.ts'

// Statuses the order has to be in for a refund to be eligible. Drafts
// haven't been promoted to Square yet; rejected/cancelled never were
// fulfilled; refunded/refund_pending are already in flight.
const REFUNDABLE_STATUSES = new Set([
  'approved',
  'in_kitchen',
  'ready',
  'out_for_delivery',
  'picked_up',
  'completed',
])

export const requestRefundSchema = z.object({
  order_id: z.string(),
  thread_id: z.string(),
  channel: z.enum(['whatsapp', 'instagram', 'web', 'telegram']),
  reason: z.string().min(3).max(500),
})

export type RequestRefundResult =
  | { ok: false; reason: string }
  | { ok: true; refund_id: string; order_id: string; status: 'pending'; deduplicated?: boolean }

interface OrderRow {
  id: string
  status: string
  total_cents: number
  customer_name: string | null
  channel: string
  square_order_id: string | null
}

function readOrderForRefund(orderId: string): OrderRow | null {
  return (
    (getDb()
      .prepare(
        'SELECT id, status, total_cents, customer_name, channel, square_order_id FROM orders WHERE id = ?',
      )
      .get(orderId) as OrderRow | undefined) ?? null
  )
}

interface RefundRow {
  id: string
  order_id: string
  thread_id: string
  channel: string
  reason: string
  prev_status: string
  status: 'pending' | 'approved' | 'denied'
  decision_note: string | null
  created_at: number
  decided_at: number | null
}

function readRefund(refundId: string): RefundRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, order_id, thread_id, channel, reason, prev_status, status, decision_note,
                created_at, decided_at
         FROM refund_requests WHERE id = ?`,
      )
      .get(refundId) as RefundRow | undefined) ?? null
  )
}

export function requestRefund(args: z.infer<typeof requestRefundSchema>): RequestRefundResult {
  const order = readOrderForRefund(args.order_id)
  if (!order) return { ok: false, reason: 'order not found' }

  // Idempotency: if there's already an open request on this order, hand
  // back its id rather than create a second one. Owner-side card was
  // already posted; agent retry is a no-op.
  const existing = getDb()
    .prepare(
      `SELECT id FROM refund_requests
       WHERE order_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(args.order_id) as { id: string } | undefined
  if (existing) {
    return {
      ok: true,
      refund_id: existing.id,
      order_id: args.order_id,
      status: 'pending',
      deduplicated: true,
    }
  }

  if (order.status === 'refund_pending' || order.status === 'refunded') {
    return { ok: false, reason: `order is already ${order.status}` }
  }
  if (!REFUNDABLE_STATUSES.has(order.status)) {
    return {
      ok: false,
      reason: `order status is "${order.status}" — refunds are only available after the order is approved`,
    }
  }

  const id = `rfd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  const db = getDb()
  db.exec('BEGIN')
  try {
    db.prepare(
      `INSERT INTO refund_requests
         (id, order_id, thread_id, channel, reason, prev_status, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(id, args.order_id, args.thread_id, args.channel, args.reason, order.status, now)
    db.prepare(
      `UPDATE orders SET status = 'refund_pending', updated_at = ? WHERE id = ?`,
    ).run(now, args.order_id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return { ok: true, refund_id: id, order_id: args.order_id, status: 'pending' }
}

export interface DecisionResult {
  ok: boolean
  refund_id: string
  order_id?: string
  status?: 'approved' | 'denied' | 'pending'
  error?: string
  square_updated?: boolean
  customer_notified?: boolean
}

export async function approveRefund(refundId: string, note?: string): Promise<DecisionResult> {
  const refund = readRefund(refundId)
  if (!refund) return { ok: false, refund_id: refundId, error: 'refund not found' }
  if (refund.status === 'approved') {
    // Idempotent — already done.
    return {
      ok: true,
      refund_id: refundId,
      order_id: refund.order_id,
      status: 'approved',
    }
  }
  if (refund.status === 'denied') {
    return { ok: false, refund_id: refundId, error: 'refund was already denied' }
  }

  const order = readOrderForRefund(refund.order_id)
  if (!order) return { ok: false, refund_id: refundId, error: 'order not found' }

  const now = Date.now()
  const db = getDb()
  db.exec('BEGIN')
  try {
    db.prepare(
      `UPDATE refund_requests SET status = 'approved', decision_note = ?, decided_at = ?
       WHERE id = ?`,
    ).run(note ?? null, now, refundId)
    db.prepare(`UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?`).run(
      now,
      refund.order_id,
    )
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  // Try to keep Square in sync. The sandbox doesn't expose a real refund
  // endpoint; we flip the linked Square order to CANCELED so the POS view
  // matches reality. Best-effort: failure here doesn't block the local
  // state update — the refund is "real" from the customer's POV either way.
  let squareUpdated = false
  if (order.square_order_id) {
    const r = await tryCallSandboxTool('square_update_order_status', {
      orderId: order.square_order_id,
      status: 'CANCELED',
      note: note ?? `Refund approved (${refundId})`,
    })
    squareUpdated = r != null
  }

  // Customer notification on the original channel.
  const customerNotified = await notifyCustomer(refund, {
    approved: true,
    note,
  })

  return {
    ok: true,
    refund_id: refundId,
    order_id: refund.order_id,
    status: 'approved',
    square_updated: squareUpdated,
    customer_notified: customerNotified,
  }
}

export async function denyRefund(refundId: string, reason: string): Promise<DecisionResult> {
  const refund = readRefund(refundId)
  if (!refund) return { ok: false, refund_id: refundId, error: 'refund not found' }
  if (refund.status === 'denied') {
    // Idempotent.
    return {
      ok: true,
      refund_id: refundId,
      order_id: refund.order_id,
      status: 'denied',
    }
  }
  if (refund.status === 'approved') {
    return { ok: false, refund_id: refundId, error: 'refund was already approved' }
  }
  if (!reason || reason.trim().length < 3) {
    return { ok: false, refund_id: refundId, error: 'denial reason required (≥ 3 chars)' }
  }

  const now = Date.now()
  const db = getDb()
  db.exec('BEGIN')
  try {
    db.prepare(
      `UPDATE refund_requests SET status = 'denied', decision_note = ?, decided_at = ?
       WHERE id = ?`,
    ).run(reason, now, refundId)
    // Revert the order to its prior status — the original kitchen / pickup
    // state shouldn't be lost just because someone asked for a refund and
    // got declined.
    db.prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`).run(
      refund.prev_status,
      now,
      refund.order_id,
    )
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  const customerNotified = await notifyCustomer(refund, { approved: false, note: reason })
  return {
    ok: true,
    refund_id: refundId,
    order_id: refund.order_id,
    status: 'denied',
    customer_notified: customerNotified,
  }
}

async function notifyCustomer(
  refund: RefundRow,
  decision: { approved: boolean; note?: string },
): Promise<boolean> {
  // Only customer-side channels get a push; if the request originated
  // from telegram (rare — TG is owner-side in our build) we skip the
  // outbound and rely on the agent picking it up next turn.
  const ch = refund.channel
  if (ch !== 'whatsapp' && ch !== 'instagram' && ch !== 'web') return false

  const message = decision.approved
    ? buildApprovalMessage(decision.note)
    : buildDenialMessage(decision.note ?? '')

  const r = await replyToInboxThread(ch as InboxChannel, refund.thread_id, message).catch(
    () => null,
  )
  return r?.ok === true
}

function buildApprovalMessage(note?: string): string {
  // Brand voice: short, plain, confident. Per BRANDBOOK: "Be direct.
  // Don't over-apologise. Make it right."
  const tail = note ? ` ${note}` : ''
  return [
    'your refund is approved.',
    'you should see it back on the original payment method in 3–5 business days.',
    `we appreciate you flagging this — ${tail.trim() || 'we will use it to do better.'}`,
  ].join(' ')
}

function buildDenialMessage(reason: string): string {
  return [
    'thanks for your patience — we reviewed and we cannot approve a refund here.',
    `reason: ${reason}`,
    'happy to talk options if that does not feel right — just reply to this message.',
  ].join(' ')
}

// ─── Read helpers for owner-side surfaces ────────────────────────────────

export function listRefunds(filter?: { status?: 'pending' | 'approved' | 'denied'; limit?: number }) {
  const limit = filter?.limit ?? 50
  if (filter?.status) {
    return getDb()
      .prepare(
        `SELECT id, order_id, channel, reason, status, created_at, decided_at, decision_note
         FROM refund_requests WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(filter.status, limit)
  }
  return getDb()
    .prepare(
      `SELECT id, order_id, channel, reason, status, created_at, decided_at, decision_note
       FROM refund_requests ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)
}

export function readRefundForCard(refundId: string) {
  const refund = readRefund(refundId)
  if (!refund) return null
  const order = readOrderForRefund(refund.order_id)
  return { refund, order }
}
