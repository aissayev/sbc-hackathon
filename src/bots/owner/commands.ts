// Owner-bot slash-command router.
//
// Slash commands bypass `claude -p` — they're cheap DB reads with predictable
// shape. The agent only handles free text where reasoning is needed.
//
//   /start, /help     — show command menu
//   /today            — daily digest from local SQLite (orders, revenue, escs)
//   /orders           — last 10 orders + one-tap approve for the most-recent draft
//   /escalations      — open escalations as inline-keyboard cards
//
// Free text falls through to the agent (run in src/server.ts onMessage handler).

import { sendTelegram, editTelegramMessage, sendChatAction } from '../../channels/telegram.ts'
import { config } from '../../config.ts'
import { listOrders, listEscalations, dailyReport } from '../../domain/tools.ts'
import type { IncomingMessage } from '../../channels/types.ts'
import { fmtMoney, hhmm, shortId } from './format.ts'

export interface BotReply {
  text: string
  keyboard?: Array<Array<{ text: string; data: string }>>
}

interface OrderRow {
  id: string
  status: string
  total_cents: number
  customer_name: string | null
  created_at: number
}

interface EscRow {
  id: string
  reason: string
  severity: string
  created_at: number
}

/**
 * True when a Telegram message arrives via the *owner* bot AND starts with `/`.
 * The router stamps roleHint='owner' for messages from the configured owner
 * bot+chat. Free-text from the operator falls through to the agent.
 */
export function isOwnerSlashCommand(msg: IncomingMessage): boolean {
  return (
    msg.channel === 'telegram' &&
    msg.roleHint === 'owner' &&
    typeof msg.text === 'string' &&
    msg.text.startsWith('/')
  )
}

/**
 * Dispatch a slash command. Returns the reply (text + optional inline keyboard)
 * or null if the command isn't recognized — caller falls through to the agent.
 */
export function handleOwnerCommand(msg: IncomingMessage): BotReply | null {
  const cmd = msg.text.trim().split(/\s+/)[0]?.toLowerCase()
  switch (cmd) {
    case '/start':
    case '/help':
      return helpReply()
    case '/today':
      return todayReply()
    case '/orders':
      return ordersReply()
    case '/escalations':
      return escalationsReply()
    case '/reset':
      // /reset is handled in server.ts (clears thread history); return a
      // placeholder so the slash dispatcher doesn't fall through to the agent.
      return { text: '✓ conversation cleared. fresh context.' }
    default:
      return null
  }
}

/**
 * Convenience: deliver a BotReply to the owner chat using the configured
 * owner bot token. No-op when token is unset.
 */
export async function sendOwnerReply(threadId: string, reply: BotReply): Promise<void> {
  const token = config.telegram.owner.token
  if (!token) return
  await sendTelegram(token, threadId, reply.text, reply.keyboard)
}

// ─── command handlers ───────────────────────────────────────────────────

function helpReply(): BotReply {
  return {
    text: [
      'HappyCake Operator',
      '',
      'Operations:',
      "/today        today's orders, revenue, pending approvals",
      '/orders       last 10 orders + one-tap approve',
      '/escalations  open escalations',
      '',
      'Marketing & social:',
      '/inbox        WA + IG threads needing reply',
      '/reviews      recent Google Business reviews',
      '/campaigns    active campaigns + status + pause/2× / approve/launch',
      '/spend        marketing budget MTD',
      '/gb           Google Business profile metrics',
      '',
      'Self-grading:',
      '/score        rubric coverage from the sandbox evaluator',
      '',
      'Conversation:',
      '/reset        clear thread context',
      '/help         this menu',
      '',
      "Free text goes to the owner agent — ask anything: \"how's the kitchen tomorrow?\" or \"draft a reply to that 2-star review\".",
    ].join('\n'),
  }
}

function todayReply(): BotReply {
  const r = dailyReport()
  return {
    text: [
      `Today — ${r.date}`,
      `  Orders: ${r.orders_count}`,
      `  Revenue: ${fmtMoney(r.revenue_cents)}`,
      `  Pending approvals: ${r.pending_approval}`,
      `  Open escalations: ${r.escalations_open}`,
    ].join('\n'),
    keyboard: [
      [
        { text: '📋 Orders', data: '/orders' },
        { text: '⚠ Escalations', data: '/escalations' },
      ],
    ],
  }
}

function ordersReply(): BotReply {
  const orders = listOrders({ limit: 10 }) as OrderRow[]
  if (orders.length === 0) return { text: 'No orders yet.' }
  const lines = orders.map((o) => {
    const customer = o.customer_name ? ` · ${o.customer_name}` : ''
    return `${hhmm(o.created_at)}  ${shortId(o.id)}  ${o.status.padEnd(8)}  ${fmtMoney(o.total_cents)}${customer}`
  })
  // Surface the most-recent DRAFT (if any) with one-tap approve/reject so
  // the operator can act without going to /escalations.
  const firstDraft = orders.find((o) => o.status === 'draft')
  return {
    text: ['Recent orders:', '', ...lines].join('\n'),
    keyboard: firstDraft
      ? [
          [
            { text: `✓ Approve ${shortId(firstDraft.id)}`, data: `approve:${firstDraft.id}` },
            { text: '✗ Reject', data: `reject:${firstDraft.id}` },
          ],
        ]
      : undefined,
  }
}

function escalationsReply(): BotReply {
  const open = listEscalations({ status: 'open' }) as EscRow[]
  if (open.length === 0) return { text: '✅ No open escalations.' }
  return {
    text: `${open.length} open escalation${open.length === 1 ? '' : 's'} — tap to view`,
    keyboard: open.slice(0, 8).map((e) => [
      {
        text: `${(e.severity || 'low')[0].toUpperCase()} · ${e.reason.slice(0, 36)}`,
        data: `view_esc:${e.id}`,
      },
    ]),
  }
}
