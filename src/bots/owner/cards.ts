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
import { fmtMoney, shortId } from './format.ts'
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

  const lines: string[] = [
    `New draft order ${shortId(orderId)}`,
    `Score: ${fmtStars(score.stars)}${score.reasons.length ? '  · ' + score.reasons.join(', ') : ''}`,
    `Total: ${fmtMoney(total)}`,
  ]
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
