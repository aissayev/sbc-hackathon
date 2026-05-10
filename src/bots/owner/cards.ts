// Outbound owner-bot cards.
//
// Called by the local stdio MCP (src/agent/mcp/local-server.ts) after
// `create_draft_order` and `escalate_to_owner` so the operator gets a
// inline-keyboard card to act on without polling.
//
// Idempotent on the Telegram side (a duplicate post is harmless — it's just
// another message in the operator's feed). Returns false if owner bot/chat
// aren't configured; never throws.

import { sendTelegram } from '../../channels/telegram.ts'
import { config } from '../../config.ts'
import { getOrderStatus } from '../../domain/tools.ts'
import { readRefundForCard } from '../../domain/refunds.ts'
import { getCustomerById } from '../../domain/customers.ts'
import { fmtMoney, shortId, ordinal } from './format.ts'
import { scoreLead, fmtStars } from './scoring.ts'

/**
 * Post an "approve / reject" card for a freshly-created draft order.
 * Returns true if the card was posted; false if the owner bot isn't
 * configured or the order isn't found.
 */
export async function postDraftOrderCard(orderId: string): Promise<boolean> {
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return false

  const status = getOrderStatus({ order_id: orderId }) as Record<string, unknown>
  if (!status || ('ok' in status && status.ok === false)) return false

  const total = (status.total_cents as number | undefined) ?? 0
  const customer = (status.customer_name as string | null | undefined) ?? null
  const scheduled = (status.scheduled_at as string | null | undefined) ?? null

  const channel = (status.channel as string | null | undefined) ?? null
  const threadId = (status.thread_id as string | null | undefined) ?? ''
  const score = scoreLead({ total_cents: total, thread_id: threadId, channel })

  // Repeat-customer badge — order_count is post-increment (this order is
  // counted), so order_count===1 means "first ever order" and 2+ means
  // "Nth visit". Total spend reads as the customer's lifetime, including
  // this draft. Skipped silently if the order has no customer link.
  const customerId = (status.customer_id as string | null | undefined) ?? null
  let repeatBadge: string | null = null
  let lifetimeLine: string | null = null
  if (customerId) {
    const c = getCustomerById(customerId)
    if (c) {
      if (c.order_count <= 1) {
        repeatBadge = '✨ First-time customer'
      } else {
        repeatBadge = `🔁 ${ordinal(c.order_count)} order · ${fmtMoney(c.total_spent_cents)} lifetime`
        lifetimeLine = null  // already in repeatBadge
      }
    }
  }

  const lines: string[] = [
    `New draft order ${shortId(orderId)}`,
    `Score: ${fmtStars(score.stars)}${score.reasons.length ? '  · ' + score.reasons.join(', ') : ''}`,
    `Total: ${fmtMoney(total)}`,
  ]
  if (repeatBadge) lines.push(repeatBadge)
  if (lifetimeLine) lines.push(lifetimeLine)
  if (customer) lines.push(`Customer: ${customer}`)
  if (scheduled) lines.push(`Pickup: ${scheduled}`)

  await sendTelegram(token, chatId, lines.join('\n'), [
    [
      { text: '✓ Approve', data: `approve:${orderId}` },
      { text: '✗ Reject', data: `reject:${orderId}` },
    ],
  ])
  return true
}

/**
 * Post an "approve / deny" card for a customer-initiated refund request.
 * Refund denial requires a written reason — the deny button kicks off the
 * follow-up text flow (see callbacks.ts:handleRefundDeny). The `reason`
 * field is the customer's stated reason, NOT the owner's eventual decision.
 */
export async function postRefundRequestCard(refundId: string): Promise<boolean> {
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return false

  const found = readRefundForCard(refundId)
  if (!found || !found.order) return false
  const { refund, order } = found

  const lines: string[] = [
    `🔄 Refund request — ${shortId(refund.order_id)}`,
    `Total: ${fmtMoney(order.total_cents)}`,
  ]
  if (order.customer_name) lines.push(`Customer: ${order.customer_name}`)
  lines.push(`Channel: ${refund.channel}`)
  lines.push(`Reason: "${refund.reason}"`)

  await sendTelegram(token, chatId, lines.join('\n'), [
    [
      { text: '✓ Approve refund', data: `refund_approve:${refundId}` },
      { text: '✗ Deny', data: `refund_deny:${refundId}` },
    ],
  ])
  return true
}

/**
 * Post an alert for an open escalation (complaint, custom-cake, allergen).
 */
export async function postEscalationCard(
  escId: string,
  reason: string,
  severity: string,
): Promise<boolean> {
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return false

  await sendTelegram(
    token,
    chatId,
    [`⚠ Escalation ${shortId(escId)} · severity ${severity}`, reason].join('\n'),
    [
      [
        { text: '🔍 View', data: `view_esc:${escId}` },
        { text: '⚠ All escalations', data: '/escalations' },
      ],
    ],
  )
  return true
}
