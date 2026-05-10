// Owner async slash commands — closes WA/IG/GBP visibility gap.
// Sandbox HTTP, no `claude -p` spend.

import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import type { BotReply } from './commands.ts'
import type { IncomingMessage } from '../../channels/types.ts'
import { shortId } from './format.ts'
import { scoreReply } from './score.ts'
import { referralSummary } from '../../domain/tools.ts'
import { handleCommentsCommand, handleRichReviewsCommand, handleStatsCommand } from './marketing/index.ts'

const fmtUsd = (cents: number): string => `$${(cents / 100).toFixed(2)}`

interface ThreadRow { threadId?: string; id?: string; from?: string; customerHandle?: string; customer_handle?: string; lastMessage?: string; last_message?: string }
interface ReviewRow { id?: string; reviewId?: string; rating?: number; stars?: number; text?: string; body?: string; authorName?: string; author?: string; hasReply?: boolean; replied?: boolean }
interface CampaignSpend { spendUsd?: number; spend_usd?: number; leads?: number }
interface BudgetShape { monthlyBudgetUsd?: number; targetEffectUsd?: number }
interface GbMetrics { views?: number; calls?: number; directionRequests?: number; direction_requests?: number; period?: string; windowDays?: number }

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
  if (waThreads.length === 0 && igThreads.length === 0) return { text: '\u2705 Inbox empty \u2014 no open WA or IG threads.' }
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

  // Referral attribution from local DB. Shows where MTD orders actually came
  // from \u2014 the cheapest closed-loop signal on whether the campaigns are
  // landing customers, not just impressions.
  const refs = referralSummary({ limit: 5 })
  const refLines: string[] = []
  if (refs.attributed_orders > 0) {
    refLines.push('', 'By referral source (MTD):')
    for (const r of refs.rows) {
      refLines.push(`  ${r.source.padEnd(16)} ${r.orders}\u00d7 ${fmtUsd(r.revenue_cents)}`)
    }
    const attribPct = refs.total_orders > 0 ? Math.round((refs.attributed_orders / refs.total_orders) * 100) : 0
    refLines.push(`  attributed: ${refs.attributed_orders}/${refs.total_orders} orders (${attribPct}%)`)
  } else if (refs.total_orders > 0) {
    refLines.push('', `No \`?ref=\` attribution yet \u2014 ${refs.total_orders} MTD orders all direct.`)
    refLines.push('Tag campaign URLs with `?ref=ig` / `?ref=gbp` etc. to track.')
  }

  return {
    text: [
      'Marketing \u2014 month to date',
      '',
      `Budget:    $${monthly} target $${target} effect`,
      `Spent:     $${cumSpend.toFixed(2)}`,
      `Remaining: $${remaining.toFixed(2)}`,
      `Leads:     ${cumLeads}`,
      ...refLines,
    ].join('\n'),
    keyboard: [[{ text: '\ud83d\udce3 Campaigns', data: '/campaigns' }]],
  }
}

async function gbReply(): Promise<BotReply> {
  const m = await tryCallSandboxTool<GbMetrics>('gb_get_metrics', { window: 'last_7_days' })
  if (!m) return { text: '(GBP metrics unavailable)' }
  const views = m.views ?? 0
  const calls = m.calls ?? 0
  const directions = m.directionRequests ?? m.direction_requests ?? 0
  const period = m.period ?? `last ${m.windowDays ?? 7} days`
  return {
    text: [`Google Business \u2014 ${period}`, '', `Views:      ${views}`, `Calls:      ${calls}`, `Directions: ${directions}`].join('\n'),
    keyboard: [[{ text: '\u2b50 Reviews', data: '/reviews' }]],
  }
}

export async function handleOwnerAsyncCommand(msg: IncomingMessage): Promise<BotReply | null> {
  const cmd = msg.text.trim().split(/\s+/)[0]?.toLowerCase()
  switch (cmd) {
    case '/inbox': return await inboxReply()
    case '/comments': return await handleCommentsCommand()
    case '/reviews': return await handleRichReviewsCommand()
    case '/reviews-flat': return await reviewsReply()
    case '/stats': return await handleStatsCommand()
    case '/spend': return await spendReply()
    case '/gb': return await gbReply()
    case '/score': return await scoreReply()
    default: return null
  }
}
