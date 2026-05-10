// Owner async slash commands for inbox + reviews + spend + GBP metrics.
//
// Hits the sandbox over HTTP (covered by team token) — same cost profile as
// DB-backed commands: instant, free, no `claude -p` spend.

import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import type { BotReply } from './commands.ts'
import type { IncomingMessage } from '../../channels/types.ts'
import { shortId } from './format.ts'

interface ThreadRow {
  threadId?: string; id?: string; from?: string
  customerHandle?: string; customer_handle?: string
  lastMessage?: string; last_message?: string
}
interface ReviewRow {
  id?: string; reviewId?: string
  rating?: number; stars?: number
  text?: string; body?: string
  authorName?: string; author?: string
  hasReply?: boolean; replied?: boolean
}
interface CampaignSpend {
  spendUsd?: number; spend_usd?: number; leads?: number
}
interface BudgetShape {
  monthlyBudgetUsd?: number; targetEffectUsd?: number
}
interface GbMetrics {
  views?: number; calls?: number
  directionRequests?: number; direction_requests?: number
  period?: string; windowDays?: number
}

const trunc = (s: string, n = 60): string => s.length > n ? s.slice(0, n).trimEnd() + '\u2026' : s
const stars = (n: number): string => {
  const f = Math.max(0, Math.min(5, Math.round(n)))
  return '\u2605'.repeat(f) + '\u2606'.repeat(5 - f)
}

async function inboxReply(): Promise<BotReply> {
  const [wa, ig] = await Promise.all([
    tryCallSandboxTool<{ threads?: ThreadRow[] } | ThreadRow[]>('whatsapp_list_threads', {}),
    tryCallSandboxTool<{ threads?: ThreadRow[] } | ThreadRow[]>('instagram_list_dm_threads', {}),
  ])
  const waThreads = (Array.isArray(wa) ? wa : (wa?.threads ?? [])).slice(0, 5)
  const igThreads = (Array.isArray(ig) ? ig : (ig?.threads ?? [])).slice(0, 5)
  if (waThreads.length === 0 && igThreads.length === 0) {
    return { text: '\u2705 Inbox empty \u2014 no open WA or IG threads.' }
  }
  const rows: string[] = ['Inbox \u2014 open threads', '']
  const buttons: Array<Array<{ text: string; data: string }>> = []
  for (const t of waThreads) {
    const handle = t.from ?? t.customerHandle ?? t.customer_handle ?? t.threadId ?? t.id ?? '?'
    const last = trunc(t.lastMessage ?? t.last_message ?? '', 50)
    rows.push(`\ud83d\udcf1 wa  ${handle}  "${last}"`)
    if (t.threadId || t.id) buttons.push([{ text: `\ud83d\udcac Reply ${shortId(handle)}`, data: `reply_wa:${t.threadId ?? t.id}` }])
  }
  for (const t of igThreads) {
    const handle = t.customerHandle ?? t.customer_handle ?? t.from ?? t.threadId ?? t.id ?? '?'
    const last = trunc(t.lastMessage ?? t.last_message ?? '', 50)
    rows.push(`\ud83d\udcf7 ig  ${handle}  "${last}"`)
    if (t.threadId || t.id) buttons.push([{ text: `\ud83d\udcac Reply ${shortId(handle)}`, data: `reply_ig:${t.threadId ?? t.id}` }])
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
    const text = trunc(rev.text ?? rev.body ?? '', 60)
    const replied = rev.hasReply ?? rev.replied ?? false
    const reviewId = rev.id ?? rev.reviewId
    const flag = replied ? ' \u2713 replied' : ''
    rows.push(`${stars(rating)}  ${author}  "${text}"${flag}`)
    if (reviewId && !replied) buttons.push([{ text: `\ud83d\udcac Reply (${rating}\u2605 ${trunc(author, 12)})`, data: `reply_review:${reviewId}` }])
  }
  return { text: rows.join('\n'), keyboard: buttons.slice(0, 8) }
}

async function spendReply(): Promise<BotReply> {
  const [budget, metrics] = await Promise.all([
    tryCallSandboxTool<BudgetShape>('marketing_get_budget', {}),
    tryCallSandboxTool<{ campaigns?: CampaignSpend[] } | CampaignSpend[]>('marketing_get_campaign_metrics', {}),
  ])
  const monthly = budget?.monthlyBudgetUsd ?? 500
  const target = budget?.targetEffectUsd ?? 5000
  const all = Array.isArray(metrics) ? metrics : (metrics?.campaigns ?? [])
  const cumSpend = all.reduce((acc, c) => acc + (c.spendUsd ?? c.spend_usd ?? 0), 0)
  const remaining = Math.max(0, monthly - cumSpend)
  const cumLeads = all.reduce((acc, c) => acc + (c.leads ?? 0), 0)
  return {
    text: [
      'Marketing \u2014 month to date', '',
      `Budget:    $${monthly} target $${target} effect`,
      `Spent:     $${cumSpend.toFixed(2)}`,
      `Remaining: $${remaining.toFixed(2)}`,
      `Leads:     ${cumLeads}`,
    ].join('\n'),
    keyboard: [[{ text: '\ud83d\udce3 Campaigns', data: '/campaigns' }]],
  }
}

async function gbReply(): Promise<BotReply> {
  const m = await tryCallSandboxTool<GbMetrics>('gb_get_metrics', { window: 'last_7_days' })
  if (!m) return { text: '(GBP metrics unavailable \u2014 sandbox returned no data)' }
  const views = m.views ?? 0
  const calls = m.calls ?? 0
  const directions = m.directionRequests ?? m.direction_requests ?? 0
  const period = m.period ?? `last ${m.windowDays ?? 7} days`
  return {
    text: [
      `Google Business \u2014 ${period}`, '',
      `Views:      ${views}`,
      `Calls:      ${calls}`,
      `Directions: ${directions}`,
    ].join('\n'),
    keyboard: [[{ text: '\u2b50 Reviews', data: '/reviews' }]],
  }
}

export async function handleOwnerAsyncCommand(msg: IncomingMessage): Promise<BotReply | null> {
  const cmd = msg.text.trim().split(/\s+/)[0]?.toLowerCase()
  switch (cmd) {
    case '/inbox': return await inboxReply()
    case '/reviews': return await reviewsReply()
    case '/spend': return await spendReply()
    case '/gb': return await gbReply()
    default: return null
  }
}
