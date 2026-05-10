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
  statusForStrategy,
  type CampaignStrategy,
} from '../../domain/campaigns.ts'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage } from '../../channels/types.ts'
import { fmtMoney, hhmm, shortId, ordinal } from './format.ts'
import { findCustomerByPhone, listCustomerOrders } from '../../domain/customers.ts'
import { handleContentCommand, handleDraftsCommand } from './marketing/index.ts'

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
    case '/content':
      return handleContentCommand()
    case '/drafts':
      return handleDraftsCommand()
    case '/post':
    case '/reel':
      return postReelHint(cmd)
    case '/customer':
      return customerReply(msg.text.trim())
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
      '/customer <phone>   CRM view: name, lifetime spend, recent orders',
      '',
      'Marketing & social:',
      '/content      weekly content plan — calendar of drafted posts/reels',
      '/drafts       in-flight drafts (approve / schedule / publish)',
      '/post <text>  free text: "make a post about Friday\'s pistachio batch"',
      '/reel <text>  draft a reel — owner taps approve → sandbox publish',
      '/campaigns    pick ONE strategy (full $500/mo) + approve/launch',
      '/brief        live MCP brief — sales, margins, GBP demand, reviews',
      '/comments     DM inbox — sentiment + drafted replies (1-tap send)',
      '/inbox        flat WA + IG thread list (legacy, fallback)',
      '/reviews      Google Business reviews — drafted replies + 1-tap send',
      '/spend        marketing budget MTD',
      '/gb           Google Business profile metrics',
      '',
      'Analytics:',
      '/stats        digital presence dashboard — posting, sentiment, budget, alerts',
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

function postReelHint(cmd: string): BotReply {
  const kind = cmd === '/reel' ? 'reel' : 'post'
  return {
    text:
      `Type the intent and I'll draft it:\n\n  make a ${kind} about Friday's pistachio batch\n\nor pick a starter from /content`,
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
/**
 * /customer <phone>  →  full CRM view + last 5 orders.
 * Phone format is permissive — normalizePhone() inside findCustomerByPhone
 * strips formatting before lookup. With no arg, prompt for one.
 */
function customerReply(rawText: string): BotReply {
  const arg = rawText.replace(/^\/customer\s*/i, '').trim()
  if (!arg) {
    return {
      text:
        'Usage: /customer <phone>\n\nExamples:\n  /customer (281) 979-8320\n  /customer 2819798320\n  /customer +12819798320',
    }
  }
  const customer = findCustomerByPhone(arg)
  if (!customer) {
    return { text: `No customer record for ${arg}.\n\nFirst-time caller — they'll show up here after their first order.` }
  }

  const firstSeen = new Date(customer.first_seen_at).toISOString().slice(0, 10)
  const lastSeen = new Date(customer.last_seen_at).toISOString().slice(0, 10)
  const repeatLine =
    customer.order_count <= 1
      ? '✨ First-time customer'
      : `🔁 ${ordinal(customer.order_count)} order · ${fmtMoney(customer.total_spent_cents)} lifetime`

  const recent = listCustomerOrders(customer.id, 5)
  const orderLines = recent.length
    ? recent.map((o) => {
        const when = new Date(o.created_at).toISOString().slice(5, 10)
        return `  ${when}  ${fmtMoney(o.total_cents)}  ${o.status.padEnd(10)}  ${o.items_summary || '—'}`
      })
    : ['  (no orders yet)']

  return {
    text: [
      `👤 ${customer.name ?? '(no name)'}`,
      customer.phone ? `   ${customer.phone}` : null,
      customer.email ? `   ${customer.email}` : null,
      '',
      repeatLine,
      `   First seen: ${firstSeen}`,
      `   Last seen:  ${lastSeen}`,
      '',
      'Recent orders:',
      ...orderLines,
      customer.notes ? `\nNotes: ${customer.notes}` : null,
    ]
      .filter((s): s is string => s !== null)
      .join('\n'),
  }
}

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

function statusEmoji(s: 'planned' | 'chosen' | 'launched' | 'unknown'): string {
  if (s === 'launched') return '🟢'
  if (s === 'chosen') return '🔵'
  if (s === 'unknown') return '🟡'
  return '⚪'
}

/**
 * /campaigns — list the 4 alternative marketing strategies (each = full $500
 * deployment). The recommended one is badged ⭐. The owner picks ONE and
 * approves; the rest stay visible as alternatives but unspent.
 *
 * Plan source: data/campaigns/plans.json (read-only here).
 */
function campaignsReply(): BotReply {
  let plan
  try {
    plan = loadCampaignsFile()
  } catch (err) {
    return {
      text: `Couldn't read campaign plan: ${(err as Error).message}\n\nIs data/campaigns/plans.json present?`,
    }
  }

  const state = loadCampaignRunState()
  const launched = plan.strategies.find((s) => statusForStrategy(s.id, state).status === 'launched')

  const headerLines = [
    `Marketing strategy — $${plan.constraint.monthlyBudgetUsd}/mo, ONE strategy at a time`,
    `Target: $${plan.constraint.targetEffectUsd} attributable rev (${plan.constraint.challenge})`,
    `Recommended: ${plan.recommendation.primary}`,
    launched ? `Live: ${launched.name}` : `Status: nothing launched yet`,
    '',
    'Tap a strategy to see the rollout, projection, and approve.',
  ]

  const rows: Array<Array<{ text: string; data: string }>> = plan.strategies.map((s) => {
    const st = statusForStrategy(s.id, state)
    const star = s.recommended ? '⭐ ' : '   '
    const label = `${statusEmoji(st.status)} ${star}$${s.fullBudgetUsd} · ${s.name.slice(0, 36)}`
    return [{ text: label, data: `view_campaign:${s.id}` }]
  })

  // Always-on organic gets a separate row (it's not a paid strategy)
  rows.push([{ text: '🌱    $0 · ' + plan.alwaysOnOrganic.name.slice(0, 36), data: `view_organic` }])

  return { text: headerLines.join('\n'), keyboard: rows }
}

/**
 * /campaign <id> — direct deep-link form. Useful for testing without the
 * inline keyboard.
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
 * Shared renderer for the strategy detail card. Used by /campaign <id> and
 * the view_campaign:<id> callback in callbacks.ts. Shows ICP, thesis, the
 * 6-month rollout projections, kill/scale rules, and an Approve & Launch
 * button if the strategy is still planned.
 */
export function renderCampaignDetail(strategyId: string): BotReply {
  let plan
  try {
    plan = loadCampaignsFile()
  } catch (err) {
    return { text: `Couldn't read plan: ${(err as Error).message}` }
  }

  if (strategyId === 'organic') {
    const o = plan.alwaysOnOrganic
    const lines = [
      `🌱 ${o.name}`,
      `Budget: $${o.budgetUsd} (zero ad spend)`,
      `Effort: ${o.effortRequired}`,
      '',
      `Purpose: ${o.purpose}`,
      '',
      'Tracks:',
      ...Object.entries(o.tracks).map(([k, t]) => `  · ${k}: ${t.expectedOutcome}`),
      '',
      'Timeline:',
      ...Object.entries(o.monthlyTimeline).map(([k, v]) => `  ${k}: ${v}`),
      '',
      'Runs in parallel with whichever paid strategy is launched.',
    ]
    return {
      text: lines.join('\n'),
      keyboard: [[{ text: '↩ Back to strategies', data: '/campaigns' }]],
    }
  }

  const strategy: CampaignStrategy | undefined = plan.strategies.find((s) => s.id === strategyId)
  if (!strategy) return { text: `No strategy with id "${strategyId}". Try /campaigns.` }

  const state = loadCampaignRunState()
  const st = statusForStrategy(strategyId, state)

  const m1 = strategy.monthlyRollout.month1
  const m3 = strategy.monthlyRollout.month3
  const m6 = strategy.monthlyRollout.month6

  const fmtOutcome = (o?: Record<string, number | string>) =>
    o
      ? Object.entries(o)
          .slice(0, 4)
          .map(([k, v]) => `      · ${k}: ${v}`)
          .join('\n')
      : '      (no projection)'

  const lines: string[] = [
    `${statusEmoji(st.status)} ${strategy.recommended ? '⭐ ' : ''}${strategy.name}`,
    `Full budget: $${strategy.fullBudgetUsd}/mo (no split)`,
    `Channel: ${strategy.primaryChannel}${strategy.secondaryChannel ? ' + ' + strategy.secondaryChannel : ''}`,
    `Anchor: ${strategy.anchorSku}`,
    '',
    `Thesis: ${strategy.thesis}`,
    '',
  ]

  if (strategy.alternativeNote) {
    lines.push(`Note: ${strategy.alternativeNote}`, '')
  }

  lines.push('ICP:')
  for (const i of strategy.icp.slice(0, 3)) lines.push(`  · ${i}`)
  lines.push('')

  if (m1) {
    lines.push(`Month 1 — ${m1.phase}`)
    lines.push(fmtOutcome(m1.expectedOutcomes))
    lines.push('')
  }
  if (m3) {
    lines.push(`Month 3 — ${m3.phase}`)
    lines.push(fmtOutcome(m3.expectedOutcomes))
    lines.push('')
  }
  if (m6) {
    lines.push(`Month 6 — ${m6.phase}`)
    lines.push(fmtOutcome(m6.expectedOutcomes))
    lines.push('')
  }

  lines.push(`Kill: ${strategy.killThresholdsBlended}`)
  lines.push(`Scale: ${strategy.scaleThresholdsBlended}`)

  if (st.status === 'launched' && st.campaignId) {
    lines.push('', `Sandbox campaignId: ${st.campaignId}`, `Leads generated: ${st.leadsGenerated}`)
  }

  const keyboard: Array<Array<{ text: string; data: string }>> = []
  if (st.status === 'planned' || st.status === 'chosen') {
    keyboard.push([
      {
        text: `✓ Approve & Launch ($${strategy.fullBudgetUsd}/mo, full budget)`,
        data: `launch_campaign:${strategy.id}`,
      },
    ])
    keyboard.push([{ text: '↩ Back', data: '/campaigns' }])
  } else if (st.status === 'launched') {
    keyboard.push([
      { text: '📊 Read metrics', data: `metrics_campaign:${strategy.id}` },
      { text: '↩ Back', data: '/campaigns' },
    ])
  } else {
    keyboard.push([{ text: '↩ Back', data: '/campaigns' }])
  }

  return { text: lines.join('\n'), keyboard }
}
