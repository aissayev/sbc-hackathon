// Per-role bot slash commands.
//
// The hackathon brief asks for "one bot per agent if the system has multiple
// agents". We have four agents — concierge, kitchen, marketing, owner — and
// the owner cockpit lives in src/bots/owner/. This file owns the other three.
//
// Each role bot exposes a tiny set of slash commands for the team member
// embodying that role (the kitchen lead reads /tickets on the kitchen bot,
// the marketing lead reads /metrics on the marketing bot, etc.). Free text on
// any of these bots still falls through to the role's claude -p agent — the
// slash commands are just zero-LLM-spend shortcuts for the most common
// "what's going on right now?" reads.
//
// All sandbox calls go through tryCallSandboxTool → the team token, no Claude
// Max spend. Local-DB reads use src/domain/tools.ts.

import { sendTelegram } from '../channels/telegram.ts'
import { config } from '../config.ts'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { listOrders } from '../domain/tools.ts'
import { fmtMoney, hhmm, shortId, truncate } from './owner/format.ts'
import type { BotReply } from './owner/commands.ts'
import type { IncomingMessage, AgentRole } from '../channels/types.ts'

interface OrderRow {
  id: string; status: string; total_cents: number
  customer_name: string | null; created_at: number
}

// Send a slash-command reply on the right bot for the given role. Returns a
// resolved promise (no-op) when the bot's token isn't configured, so callers
// can call this unconditionally.
export async function sendRoleReply(role: AgentRole, threadId: string, reply: BotReply): Promise<void> {
  let token: string | undefined
  if (role === 'kitchen') token = config.telegram.kitchen.token
  else if (role === 'marketing') token = config.telegram.marketing.token
  else if (role === 'concierge') token = config.telegram.concierge.token
  if (!token) return
  await sendTelegram(token, threadId, reply.text, reply.keyboard)
}

// ─── Kitchen bot ─────────────────────────────────────────────────────────
//
// Audience: the kitchen lead. They want to know what tickets are open, what
// capacity remains today, and accept/reject in one tap when needed.

async function kitchenTicketsReply(): Promise<BotReply> {
  const r = await tryCallSandboxTool<{ tickets?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>('kitchen_list_tickets', {})
  const tickets = (Array.isArray(r) ? r : (r?.tickets ?? [])) as Array<{
    id?: string; ticketId?: string
    productId?: string; product?: string
    quantity?: number; qty?: number
    status?: string; state?: string
    dueAt?: string; due_at?: string
  }>
  if (!tickets.length) return { text: '✅ No open kitchen tickets.' }
  const rows = tickets.slice(0, 12).map((t) => {
    const id = t.id ?? t.ticketId ?? '—'
    const sku = t.productId ?? t.product ?? '?'
    const qty = t.quantity ?? t.qty ?? 1
    const state = (t.status ?? t.state ?? 'open').padEnd(10)
    return `${state}  ${shortId(id)}  ${truncate(sku, 22)} ×${qty}`
  })
  return { text: ['Kitchen tickets:', '', ...rows].join('\n') }
}

async function kitchenCapacityReply(): Promise<BotReply> {
  const r = await tryCallSandboxTool<Record<string, unknown>>('kitchen_get_production_summary', {})
  if (!r || typeof r !== 'object') return { text: 'No capacity data available.' }
  // Capacity shape varies — show whatever the sandbox returns, capped to 600 chars.
  const json = JSON.stringify(r, null, 2)
  return {
    text: ['Today in the kitchen:', '', '```', json.slice(0, 600), json.length > 600 ? '… (truncated)' : '', '```']
      .filter(Boolean)
      .join('\n'),
  }
}

function kitchenHelpReply(): BotReply {
  return {
    text: [
      'HappyCake Kitchen',
      '',
      "/tickets    open kitchen tickets (sandbox)",
      '/capacity   today\'s production summary',
      '/help       this menu',
      '',
      'Free text → kitchen agent for ticket actions and capacity decisions.',
    ].join('\n'),
  }
}

export async function handleKitchenCommand(msg: IncomingMessage): Promise<BotReply | null> {
  if (msg.roleHint !== 'kitchen') return null
  const cmd = msg.text.trim().split(/\s+/)[0]?.toLowerCase()
  switch (cmd) {
    case '/start':
    case '/help':
      return kitchenHelpReply()
    case '/tickets':
      return await kitchenTicketsReply()
    case '/capacity':
      return await kitchenCapacityReply()
    default:
      return null
  }
}

// ─── Marketing bot ───────────────────────────────────────────────────────
//
// Audience: the marketing lead. Same data as the owner's /spend / /campaigns
// but on its own bot so the marketing team has a dedicated surface.

interface CampaignRow {
  id?: string; campaignId?: string
  name?: string; status?: string; channel?: string
  budgetUsd?: number; spendUsd?: number
  ctr?: number; leads?: number
}

async function marketingMetricsReply(): Promise<BotReply> {
  // marketing_get_campaign_metrics returns rolled-up metrics across all
  // campaigns the team has launched. The sandbox shape is either
  //   { campaigns: [...] }  or  [...]  per environment, so handle both.
  const r = await tryCallSandboxTool<{ campaigns?: CampaignRow[] } | CampaignRow[]>('marketing_get_campaign_metrics', {})
  const all = Array.isArray(r) ? r : (r?.campaigns ?? [])
  if (!all.length) return { text: 'No campaigns yet. Run `bun run marketing:run` to seed.' }
  const lines = all.slice(0, 8).map((row) => {
    const name = truncate(row.name ?? row.id ?? row.campaignId ?? '?', 28)
    const spend = row.spendUsd ?? 0
    const budget = row.budgetUsd ?? 0
    const ctr = typeof row.ctr === 'number' ? `CTR ${(row.ctr * 100).toFixed(1)}%` : ''
    const leads = typeof row.leads === 'number' ? `${row.leads}L` : ''
    return `📣 ${name}  $${spend.toFixed(0)}/$${budget.toFixed(0)} ${leads} ${ctr}`.trim()
  })
  return { text: ['Marketing campaigns:', '', ...lines].join('\n') }
}

async function marketingBudgetReply(): Promise<BotReply> {
  const r = await tryCallSandboxTool<{ monthlyBudgetUsd?: number; targetEffectUsd?: number; spentUsd?: number; remainingUsd?: number }>('marketing_get_budget', {})
  if (!r) return { text: 'Budget unavailable — sandbox unreachable.' }
  const lines = [
    'Marketing budget',
    '',
    `Monthly:    $${r.monthlyBudgetUsd ?? '?'}`,
    `Target:     $${r.targetEffectUsd ?? '?'} effect`,
  ]
  if (typeof r.spentUsd === 'number') lines.push(`Spent MTD:  $${r.spentUsd}`)
  if (typeof r.remainingUsd === 'number') lines.push(`Remaining:  $${r.remainingUsd}`)
  return { text: lines.join('\n') }
}

function marketingHelpReply(): BotReply {
  return {
    text: [
      'HappyCake Marketing',
      '',
      '/metrics  active campaigns + spend + leads + CTR',
      '/budget   $500/mo budget status',
      '/help     this menu',
      '',
      'Free text → marketing agent for campaign decisions, ad copy, kill calls.',
    ].join('\n'),
  }
}

export async function handleMarketingCommand(msg: IncomingMessage): Promise<BotReply | null> {
  if (msg.roleHint !== 'marketing') return null
  const cmd = msg.text.trim().split(/\s+/)[0]?.toLowerCase()
  switch (cmd) {
    case '/start':
    case '/help':
      return marketingHelpReply()
    case '/metrics':
      return await marketingMetricsReply()
    case '/budget':
      return await marketingBudgetReply()
    default:
      return null
  }
}

// ─── Concierge bot ───────────────────────────────────────────────────────
//
// Audience: a team member watching customer conversations. The concierge bot
// is a *read-mostly* surface — see what's coming in, what got escalated, jump
// in if the agent needs help.

function conciergeThreadsReply(): BotReply {
  // Latest 10 orders is a proxy for "active conversations that converted to
  // intent" — every draft order has a corresponding thread. Shows the
  // concierge team what their agent has produced today.
  const orders = listOrders({ limit: 10 }) as OrderRow[]
  if (!orders.length) return { text: 'No order intent threads today.' }
  const rows = orders.map((o) => {
    const customer = o.customer_name ? ` · ${o.customer_name}` : ''
    return `${hhmm(o.created_at)}  ${shortId(o.id)}  ${o.status.padEnd(8)}  ${fmtMoney(o.total_cents)}${customer}`
  })
  return { text: ['Recent order-intent threads:', '', ...rows].join('\n') }
}

function conciergeHelpReply(): BotReply {
  return {
    text: [
      'HappyCake Concierge',
      '',
      '/threads   recent customer threads that reached order intent',
      '/help      this menu',
      '',
      'Free text → concierge agent (same prompt as the website chat surface).',
    ].join('\n'),
  }
}

export async function handleConciergeCommand(msg: IncomingMessage): Promise<BotReply | null> {
  if (msg.roleHint !== 'concierge') return null
  const cmd = msg.text.trim().split(/\s+/)[0]?.toLowerCase()
  switch (cmd) {
    case '/start':
    case '/help':
      return conciergeHelpReply()
    case '/threads':
      return conciergeThreadsReply()
    default:
      return null
  }
}

// ─── Unified slash dispatcher ────────────────────────────────────────────

export async function handleRoleCommand(msg: IncomingMessage): Promise<BotReply | null> {
  if (msg.channel !== 'telegram') return null
  if (typeof msg.text !== 'string' || !msg.text.startsWith('/')) return null
  if (msg.roleHint === 'kitchen') return await handleKitchenCommand(msg)
  if (msg.roleHint === 'marketing') return await handleMarketingCommand(msg)
  if (msg.roleHint === 'concierge') return await handleConciergeCommand(msg)
  return null
}
