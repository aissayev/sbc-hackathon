// Async owner slash commands that pull from the sandbox MCP.
//
// These commands hit the sandbox over HTTP (covered by the team token, not
// Claude Max) — same cost profile as the DB-backed commands in commands.ts:
// instant, free, no `claude -p` spend. They're async only because the sandbox
// is over the network.
//
// The five commands here close the marketing/social-management gap on the
// owner cockpit:
//
//   /inbox        WhatsApp + Instagram thread inbox (oldest unanswered first)
//   /reviews      Recent Google Business reviews + 1-tap reply
//   /campaigns    Active marketing campaigns + metrics + pause/double-down
//   /spend        Marketing budget + cumulative campaign spend MTD
//   /gb           Google Business profile metrics (views, calls, directions)

import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import type { BotReply } from './commands.ts'
import type { IncomingMessage } from '../../channels/types.ts'
import { shortId, stars, truncate } from './format.ts'
import { scoreReply } from './score.ts'

interface ThreadRow {
  threadId?: string; id?: string; from?: string
  customerHandle?: string; customer_handle?: string
  lastMessage?: string; last_message?: string
  unanswered?: boolean; needsReply?: boolean
}
interface ReviewRow {
  id?: string; reviewId?: string
  rating?: number; stars?: number
  text?: string; body?: string
  authorName?: string; author?: string
  hasReply?: boolean; replied?: boolean
}
interface CampaignRow {
  id?: string; campaignId?: string
  name?: string; channel?: string; status?: string
  budgetUsd?: number; spendUsd?: number; spend_usd?: number
  ctr?: number; leads?: number
}
interface BudgetShape {
  monthlyBudgetUsd?: number; targetEffectUsd?: number
  remainingUsd?: number; spentUsd?: number
}
interface GbMetrics {
  views?: number; calls?: number
  directionRequests?: number; direction_requests?: number
  period?: string; windowDays?: number
}

async function inboxReply(): Promise<BotReply> {
  const [wa, ig] = await Promise.all([
    tryCallSandboxTool<{ threads?: ThreadRow[] } | ThreadRow[]>('whatsapp_list_threads', {}),
    tryCallSandboxTool<{ threads?: ThreadRow[] } | ThreadRow[]>('instagram_list_dm_threads', {}),
  ])
  const waThreads = (Array.isArray(wa) ? wa : (wa?.threads ?? [])).slice(0, 5)
  const igThreads = (Array.isArray(ig) ? ig : (ig?.threads ?? [])).slice(0, 5)
  if (waThreads.length === 0 && igThreads.length === 0) {
    return { text: '✅ Inbox empty — no open WA or IG threads.' }
  }
  const rows: string[] = ['Inbox — open threads', '']
  const buttons: Array<Array<{ text: string; data: string }>> = []
  for (const t of waThreads) {
    const handle = t.from ?? t.customerHandle ?? t.customer_handle ?? t.threadId ?? t.id ?? '?'
    const last = truncate(t.lastMessage ?? t.last_message ?? '', 50)
    rows.push(`📱 wa  ${handle}  "${last}"`)
    if (t.threadId || t.id) buttons.push([{ text: `💬 Reply ${shortId(handle)}`, data: `reply_wa:${t.threadId ?? t.id}` }])
  }
  for (const t of igThreads) {
    const handle = t.customerHandle ?? t.customer_handle ?? t.from ?? t.threadId ?? t.id ?? '?'
    const last = truncate(t.lastMessage ?? t.last_message ?? '', 50)
    rows.push(`📷 ig  ${handle}  "${last}"`)
    if (t.threadId || t.id) buttons.push([{ text: `💬 Reply ${shortId(handle)}`, data: `reply_ig:${t.threadId ?? t.id}` }])
  }
  return { text: rows.join('\n'), keyboard: buttons.slice(0, 8) }
}

async function reviewsReply(): Promise<BotReply> {
  const r = await tryCallSandboxTool<{ reviews?: ReviewRow[] } | ReviewRow[]>('gb_list_reviews', {})
  const reviews = (Array.isArray(r) ? r : (r?.reviews ?? [])).slice(0, 8)
  if (reviews.length === 0) return { text: 'No recent Google Business reviews.' }
  const rows: string[] = ['Recent Google Business reviews', '']
  const buttons: Array<Array<{ text: string; data: string }>> = []
  for (const rev of reviews) {
    const rating = rev.rating ?? rev.stars ?? 0
    const author = rev.authorName ?? rev.author ?? '?'
    const text = truncate(rev.text ?? rev.body ?? '', 60)
    const replied = rev.hasReply ?? rev.replied ?? false
    const reviewId = rev.id ?? rev.reviewId
    const flag = replied ? ' ✓ replied' : ''
    rows.push(`${stars(rating)}  ${author}  "${text}"${flag}`)
    if (reviewId && !replied) buttons.push([{ text: `💬 Reply (${rating}★ ${truncate(author, 12)})`, data: `reply_review:${reviewId}` }])
  }
  return { text: rows.join('\n'), keyboard: buttons.slice(0, 8) }
}

async function campaignsReply(): Promise<BotReply> {
  const r = await tryCallSandboxTool<{ campaigns?: CampaignRow[] } | CampaignRow[]>('marketing_get_campaign_metrics', {})
  const all = Array.isArray(r) ? r : (r?.campaigns ?? [])
  const active = all.filter((c) => c.status !== 'killed' && c.status !== 'completed').slice(0, 6)
  if (active.length === 0) return { text: 'No active campaigns.' }
  const rows: string[] = ['Active campaigns', '']
  const buttons: Array<Array<{ text: string; data: string }>> = []
  for (const c of active) {
    const id = c.id ?? c.campaignId ?? '?'
    const name = c.name ?? c.channel ?? id
    const spend = c.spendUsd ?? c.spend_usd ?? 0
    const budget = c.budgetUsd ?? 0
    const leads = c.leads ?? 0
    const ctr = typeof c.ctr === 'number' ? `${(c.ctr * 100).toFixed(1)}%` : '—'
    rows.push(`📣 ${truncate(name, 28)}  $${spend.toFixed(0)}/$${budget.toFixed(0)}  ${leads}L  CTR ${ctr}`)
    if (c.id ?? c.campaignId) {
      buttons.push([
        { text: `⏸ Pause ${shortId(name)}`, data: `pause:${id}` },
        { text: '🔥 2×', data: `2x:${id}` },
      ])
    }
  }
  return { text: rows.join('\n'), keyboard: buttons.slice(0, 6) }
}

async function spendReply(): Promise<BotReply> {
  const [budget, metrics] = await Promise.all([
    tryCallSandboxTool<BudgetShape>('marketing_get_budget', {}),
    tryCallSandboxTool<{ campaigns?: CampaignRow[] } | CampaignRow[]>('marketing_get_campaign_metrics', {}),
  ])
  const monthly = budget?.monthlyBudgetUsd ?? 500
  const target = budget?.targetEffectUsd ?? 5000
  const all = Array.isArray(metrics) ? metrics : (metrics?.campaigns ?? [])
  const cumSpend = all.reduce((acc, c) => acc + (c.spendUsd ?? c.spend_usd ?? 0), 0)
  const remaining = Math.max(0, monthly - cumSpend)
  const cumLeads = all.reduce((acc, c) => acc + (c.leads ?? 0), 0)
  return {
    text: [
      'Marketing — month to date', '',
      `Budget:    \$${monthly} target \$${target} effect`,
      `Spent:     \$${cumSpend.toFixed(2)}`,
      `Remaining: \$${remaining.toFixed(2)}`,
      `Leads:     ${cumLeads}`,
    ].join('\n'),
    keyboard: [[{ text: '📣 Campaigns', data: '/campaigns' }]],
  }
}

async function gbReply(): Promise<BotReply> {
  const m = await tryCallSandboxTool<GbMetrics>('gb_get_metrics', { window: 'last_7_days' })
  if (!m) return { text: '(GBP metrics unavailable — sandbox returned no data)' }
  const views = m.views ?? 0
  const calls = m.calls ?? 0
  const directions = m.directionRequests ?? m.direction_requests ?? 0
  const period = m.period ?? `last ${m.windowDays ?? 7} days`
  return {
    text: [
      `Google Business — ${period}`, '',
      `Views:      ${views}`,
      `Calls:      ${calls}`,
      `Directions: ${directions}`,
    ].join('\n'),
    keyboard: [[{ text: '⭐ Reviews', data: '/reviews' }]],
  }
}

export async function handleOwnerAsyncCommand(msg: IncomingMessage): Promise<BotReply | null> {
  const cmd = msg.text.trim().split(/\s+/)[0]?.toLowerCase()
  switch (cmd) {
    case '/inbox': return await inboxReply()
    case '/reviews': return await reviewsReply()
    case '/campaigns': return await campaignsReply()
    case '/spend': return await spendReply()
    case '/gb': return await gbReply()
    case '/score': return await scoreReply()
    default: return null
  }
}
