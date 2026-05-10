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
import {
  loadCampaignsFile,
  loadCampaignRunState,
  statusForPlan,
  type CampaignPlan,
} from '../../domain/campaigns.ts'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
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
    case '/campaigns':
      return campaignsReply()
    case '/campaign':
      return campaignDetailReply(msg.text.trim())
    case '/brief':
      return briefReply()
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
      'Quick commands:',
      "/today        today's orders, revenue, pending approvals",
      '/orders       last 10 orders + one-tap approve',
      '/escalations  open escalations',
      '/campaigns    marketing portfolio + status + approve/launch',
      '/brief        live MCP data brief (sales, margins, GBP demand, reviews)',
      '/reset        clear conversation context',
      '/help         this menu',
      '',
      "Free text goes to the owner agent — ask anything: \"how's the kitchen tomorrow?\"",
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
      [
        { text: '📣 Campaigns', data: '/campaigns' },
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

/**
 * /brief — surface the latest live MCP data brief inline. Reads the cached
 * baseline at data/campaigns/.state/baseline.json (written by `bun run
 * marketing:brief`) and shows the top decision-relevant facts without making
 * the operator open a markdown file.
 */
function briefReply(): BotReply {
  const path = resolve('data/campaigns/.state/baseline.json')
  if (!existsSync(path)) {
    return {
      text:
        'No live data brief yet. Run on the server:\n\n  bun run marketing:brief\n\nThat pulls budget + sales + margins + capacity + GBP metrics + reviews from the sandbox MCP and caches them here.',
    }
  }
  let baseline: Record<string, unknown>
  try {
    baseline = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch (err) {
    return { text: `Couldn't parse brief: ${(err as Error).message}` }
  }

  const sales = baseline.sales as
    | { avgMonthlyRevenueUsd?: number; avgTicketUsd?: number; trendDirection?: string }
    | undefined
  const budget = baseline.budget as { monthlyBudgetUsd?: number; targetEffectUsd?: number } | undefined
  const margins = (baseline.margins as Array<{ productId: string; estimatedMarginPct?: number; marginPct?: number }>) ?? []
  const gb = baseline.gbMetrics30d as
    | { directionsRequests?: number; callsClicks?: number; websiteClicks?: number; profileViews?: number }
    | undefined
  const reviews = (baseline.gbReviews as Array<{ rating?: number; author?: string; text?: string }>) ?? []
  const kc = baseline.kitchenCapacity as
    | { remainingCapacityMinutes?: number; dailyCapacityMinutes?: number; activePrepMinutes?: number }
    | undefined
  const ranked = (baseline.ranked as Array<{
    kitchenProductId?: string
    id?: string
    minutesPerMarginDollar?: number
    dailyCeiling?: number
  }>) ?? []

  const topMargins = margins
    .map((m) => `${m.productId}: ${m.estimatedMarginPct ?? m.marginPct ?? '?'}%`)
    .join(' · ')

  const topPrepEfficient = [...ranked]
    .filter((r) => typeof r.minutesPerMarginDollar === 'number')
    .sort((a, b) => (a.minutesPerMarginDollar ?? Infinity) - (b.minutesPerMarginDollar ?? Infinity))
    .slice(0, 3)
    .map((r) => `${r.kitchenProductId ?? r.id} (${(r.minutesPerMarginDollar ?? 0).toFixed(2)}m/$)`)
    .join(' · ')

  const reviewLine = reviews
    .slice(0, 2)
    .map((r) => `${r.rating ?? '?'}★ ${r.author ?? '?'}: "${(r.text ?? '').slice(0, 80)}"`)
    .join('\n')

  const lines: string[] = [
    `Live MCP brief · pulled ${String(baseline.pulledAt ?? '').slice(0, 16)}`,
    '',
    `Budget: $${budget?.monthlyBudgetUsd ?? '?'}/mo → $${budget?.targetEffectUsd ?? '?'} target`,
    `Sales avg: $${sales?.avgMonthlyRevenueUsd?.toFixed(0) ?? '?'}/mo · ticket $${sales?.avgTicketUsd?.toFixed(2) ?? '?'} · trend ${sales?.trendDirection ?? '?'}`,
    '',
    'Live margins:',
    '  ' + topMargins,
    '',
    'Most prep-efficient (min/$margin):',
    '  ' + topPrepEfficient,
    '',
    `Kitchen: ${kc?.activePrepMinutes ?? 0}/${kc?.dailyCapacityMinutes ?? 420} min used today (${kc?.remainingCapacityMinutes ?? '?'} remaining)`,
    '',
    `GBP last 30d: ${gb?.profileViews ?? '?'} views · ${gb?.directionsRequests ?? '?'} directions · ${gb?.callsClicks ?? '?'} calls · ${gb?.websiteClicks ?? '?'} site-clicks`,
    '',
    'Recent reviews (creative input):',
    reviewLine,
  ]

  return {
    text: lines.join('\n'),
    keyboard: [
      [
        { text: '📣 Campaigns', data: '/campaigns' },
        { text: '📋 Today', data: '/today' },
      ],
    ],
  }
}

function statusEmoji(s: 'planned' | 'launched' | 'unknown'): string {
  if (s === 'launched') return '🟢'
  if (s === 'unknown') return '🟡'
  return '⚪'
}

function leverLabel(lever: string): string {
  if (lever === 'primary') return 'PRIMARY'
  if (lever === 'primary_support') return 'PRIMARY+'
  if (lever === 'secondary') return 'SECONDARY'
  if (lever === 'amplifier') return 'RETARGET'
  if (lever === 'earned') return 'ORGANIC'
  return lever.toUpperCase()
}

/**
 * /campaigns — list the marketing portfolio with status and a button per
 * campaign that opens the detail card. Detail card has "Approve & Launch"
 * for planned campaigns; the callback handler routes that to the sandbox
 * MCP. The plan itself lives in data/campaigns/plans.json (read-only here).
 */
function campaignsReply(): BotReply {
  let plans
  try {
    plans = loadCampaignsFile()
  } catch (err) {
    return {
      text: `Couldn't read campaign plan: ${(err as Error).message}\n\nIs data/campaigns/plans.json present?`,
    }
  }

  const state = loadCampaignRunState()
  const launchedCount = plans.campaigns.filter(
    (c) => statusForPlan(c.id, state).status === 'launched',
  ).length

  const headerLines = [
    `Marketing portfolio — $${plans.totalAllocatedUsd}/${plans.constraint.monthlyBudgetUsd} allocated`,
    `Target: $${plans.constraint.targetEffectUsd} attributable rev (${plans.constraint.challenge})`,
    `Status: ${launchedCount}/${plans.campaigns.length} launched · last reviewed ${plans.lastReviewed}`,
    '',
    'Tap a campaign to see the hypothesis and approve.',
  ]

  const rows: Array<Array<{ text: string; data: string }>> = plans.campaigns.map((c) => {
    const st = statusForPlan(c.id, state)
    const label = `${statusEmoji(st.status)} ${leverLabel(c.lever)} · $${c.budgetUsd} · ${c.name.slice(0, 38)}`
    return [{ text: label, data: `view_campaign:${c.id}` }]
  })

  return { text: headerLines.join('\n'), keyboard: rows }
}

/**
 * /campaign <id> — direct deep-link form. Useful for testing without the
 * inline keyboard. Same body as the callback's view_campaign:<id>.
 */
function campaignDetailReply(rawText: string): BotReply {
  const id = rawText.split(/\s+/)[1]?.trim()
  if (!id) {
    return {
      text: 'Usage: /campaign <id>\nOr just /campaigns to pick from the list.',
    }
  }
  return renderCampaignDetail(id)
}

/**
 * Shared renderer used by /campaign <id> and the view_campaign:<id>
 * callback in callbacks.ts. Exported for callbacks.ts.
 */
export function renderCampaignDetail(planId: string): BotReply {
  let plans
  try {
    plans = loadCampaignsFile()
  } catch (err) {
    return { text: `Couldn't read plan: ${(err as Error).message}` }
  }
  const plan: CampaignPlan | undefined = plans.campaigns.find((c) => c.id === planId)
  if (!plan) return { text: `No campaign with id "${planId}". Try /campaigns.` }

  const state = loadCampaignRunState()
  const st = statusForPlan(planId, state)

  const hyp = plan.hypothesis as Record<string, unknown>
  const hypLines = Object.entries(hyp)
    .slice(0, 8)
    .map(([k, v]) => `  · ${k}: ${typeof v === 'number' ? v : String(v)}`)

  const lines: string[] = [
    `${statusEmoji(st.status)} ${plan.name}`,
    `Lever: ${leverLabel(plan.lever)} · Budget: $${plan.budgetUsd} · Channel: ${plan.channel}`,
    '',
    'ICP:',
    ...plan.icp.slice(0, 3).map((i) => `  · ${i}`),
    '',
    'Anchor SKU: ' + plan.anchorSku,
    plan.supportingSkus.length ? 'Supporting: ' + plan.supportingSkus.join(', ') : '',
    '',
    'Offer: ' + plan.offer,
    '',
    'Creative strategy: ' + plan.creativeStrategy,
    '',
    'Hypothesis:',
    ...hypLines,
    '',
    'Kill: ' + plan.killThreshold,
    'Scale: ' + plan.scaleThreshold,
  ].filter(Boolean)

  if (st.status === 'launched' && st.campaignId) {
    lines.push('', `Sandbox campaignId: ${st.campaignId}`, `Leads generated: ${st.leadsGenerated}`)
  }

  const keyboard: Array<Array<{ text: string; data: string }>> = []
  if (st.status === 'planned' && plan.budgetUsd > 0) {
    keyboard.push([
      { text: `✓ Approve & Launch ($${plan.budgetUsd})`, data: `launch_campaign:${plan.id}` },
      { text: '↩ Back', data: '/campaigns' },
    ])
  } else if (st.status === 'launched') {
    keyboard.push([
      { text: '📊 Read metrics', data: `metrics_campaign:${plan.id}` },
      { text: '↩ Back', data: '/campaigns' },
    ])
  } else {
    keyboard.push([{ text: '↩ Back', data: '/campaigns' }])
  }

  return { text: lines.join('\n'), keyboard }
}
