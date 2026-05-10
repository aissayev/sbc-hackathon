// Builds a DigitalPresenceSnapshot by fanning out to:
//   - sandbox MCP (budget, campaign metrics, reviews)
//   - content-studio repo (drafts + slot status)
//   - engagement puller (live DM threads, sentiment)
//   - local DB (referral attribution from orders)
//
// All side-effecting reads happen here. The renderer (TG /stats command)
// only reads the resulting plain object; it never reaches into MCP itself.

import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import { referralSummary } from '../tools.ts'
import { listDmInbox, listReviewInbox, summariseSentiment } from '../engagement/index.ts'
import { SqliteContentRepository } from '../content-studio/index.ts'
import type { ContentDraft } from '../content-studio/index.ts'
import {
  isoDateOf,
  type AlertSignal,
  type AttributionMetrics,
  type BudgetMetrics,
  type DigitalPresenceSnapshot,
  type EngagementMetrics,
  type PostingMetrics,
  type ReviewMetrics,
} from './metrics.ts'

const DAY_MS = 86_400_000
const SEVEN_DAYS_MS = 7 * DAY_MS
const TWO_DAYS_MS = 2 * DAY_MS

interface BudgetShape { monthlyBudgetUsd?: number; targetEffectUsd?: number }
interface CampaignSpend {
  spendUsd?: number
  spend_usd?: number
  leads?: number
  status?: string
  state?: string
}

function normaliseList<T>(raw: unknown, key: string): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const arr = (raw as Record<string, unknown>)[key]
    if (Array.isArray(arr)) return arr as T[]
  }
  return []
}

// ─── Posting ────────────────────────────────────────────────────────────

function buildPostingMetrics(
  drafts: ContentDraft[],
  now: number,
): PostingMetrics {
  const cutoff = now - SEVEN_DAYS_MS
  const recent = drafts.filter((d) => d.updated_at >= cutoff)
  const posts_7d = recent.filter((d) => d.status === 'published').length
  const posts_by_kind_7d: Record<string, number> = {}
  for (const d of recent) {
    if (d.status !== 'published') continue
    posts_by_kind_7d[d.kind] = (posts_by_kind_7d[d.kind] ?? 0) + 1
  }
  const scheduled_7d = recent.filter((d) => d.status === 'scheduled').length
  const pending_review = drafts.filter(
    (d) => d.status === 'draft' || d.status === 'brand_pending',
  ).length
  return {
    posts_7d,
    posts_by_kind_7d,
    cadence_target: 5,
    scheduled_7d,
    pending_review,
  }
}

// ─── Engagement ─────────────────────────────────────────────────────────

async function buildEngagementMetrics(): Promise<EngagementMetrics> {
  const inbox = await listDmInbox()
  const reviews = await listReviewInbox()
  const summary = summariseSentiment([...inbox, ...reviews])
  const unhandled_risk = [...inbox, ...reviews].filter(
    (i) => i.sentiment.risk && !i.has_reply,
  ).length
  return {
    inbox_open: inbox.length,
    sentiment_split: {
      positive: summary.positive,
      neutral: summary.neutral,
      negative: summary.negative,
      risk: summary.risk,
    },
    unhandled_risk,
  }
}

// ─── Reviews ────────────────────────────────────────────────────────────

async function buildReviewMetrics(now: number): Promise<ReviewMetrics> {
  const reviews = await listReviewInbox()
  const total_visible = reviews.length
  const avg_rating =
    total_visible > 0
      ? reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0) / total_visible
      : 0
  const unanswered = reviews.filter((r) => !r.has_reply).length
  const cutoff = now - TWO_DAYS_MS
  const negative_velocity_48h = reviews.filter(
    (r) =>
      (r.occurred_at ?? 0) >= cutoff &&
      ((r.rating ?? 5) <= 2 || r.sentiment.label === 'negative' || r.sentiment.label === 'risk'),
  ).length
  return { total_visible, avg_rating, unanswered, negative_velocity_48h }
}

// ─── Budget ─────────────────────────────────────────────────────────────

async function buildBudgetMetrics(): Promise<BudgetMetrics> {
  const [budget, metrics] = await Promise.all([
    tryCallSandboxTool('marketing_get_budget', {}) as Promise<BudgetShape | null>,
    tryCallSandboxTool('marketing_get_campaign_metrics', {}),
  ])
  const monthly_cap_cents = Math.round((budget?.monthlyBudgetUsd ?? 500) * 100)
  const campaigns = normaliseList<CampaignSpend>(metrics, 'campaigns')
  const mtd_spend_cents = Math.round(
    campaigns.reduce((acc, c) => acc + (c.spendUsd ?? c.spend_usd ?? 0), 0) * 100,
  )
  const active_campaigns = campaigns.filter((c) => {
    const s = (c.status ?? c.state ?? '').toLowerCase()
    return s === 'running' || s === 'active' || s === 'launched'
  }).length
  const mtd_leads = campaigns.reduce((acc, c) => acc + (c.leads ?? 0), 0)
  return { monthly_cap_cents, mtd_spend_cents, active_campaigns, mtd_leads }
}

// ─── Attribution ────────────────────────────────────────────────────────

function buildAttributionMetrics(): AttributionMetrics {
  const refs = referralSummary({ limit: 3 })
  return {
    attributed_orders: refs.attributed_orders,
    total_orders: refs.total_orders,
    top_sources: refs.rows.map((r) => ({
      source: r.source,
      orders: r.orders,
      revenue_cents: r.revenue_cents,
    })),
  }
}

// ─── Alerts ─────────────────────────────────────────────────────────────

function buildAlerts(
  posts: PostingMetrics,
  engagement: EngagementMetrics,
  reviews: ReviewMetrics,
  budget: BudgetMetrics,
): AlertSignal[] {
  const alerts: AlertSignal[] = []
  if (posts.posts_7d < 2) {
    alerts.push({
      severity: 'warn',
      code: 'posting_cadence_low',
      msg: `Only ${posts.posts_7d}/${posts.cadence_target} posts in the last 7d`,
      cta: '/content',
    })
  }
  if (engagement.unhandled_risk > 0) {
    alerts.push({
      severity: 'high',
      code: 'unhandled_risk_items',
      msg: `${engagement.unhandled_risk} risk-flagged comment${engagement.unhandled_risk === 1 ? '' : 's'} need Askhat's eyes`,
      cta: '/comments',
    })
  }
  if (reviews.negative_velocity_48h >= 2) {
    alerts.push({
      severity: 'high',
      code: 'negative_review_surge',
      msg: `${reviews.negative_velocity_48h} negative review${reviews.negative_velocity_48h === 1 ? '' : 's'} in last 48h`,
      cta: '/reviews',
    })
  }
  if (reviews.unanswered > 3) {
    alerts.push({
      severity: 'warn',
      code: 'reviews_backlog',
      msg: `${reviews.unanswered} reviews waiting for a reply`,
      cta: '/reviews',
    })
  }
  if (
    budget.mtd_spend_cents > 0 &&
    budget.mtd_spend_cents / budget.monthly_cap_cents > 0.9
  ) {
    alerts.push({
      severity: 'warn',
      code: 'budget_burn_high',
      msg: `Spend at >90% of monthly cap with ${daysLeftThisMonth()} days remaining`,
      cta: '/spend',
    })
  }
  if (posts.pending_review >= 3) {
    alerts.push({
      severity: 'info',
      code: 'drafts_pending',
      msg: `${posts.pending_review} drafts waiting for approval`,
      cta: '/drafts',
    })
  }
  return alerts
}

function daysLeftThisMonth(): number {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.max(0, end.getDate() - now.getDate())
}

// ─── Public builder ─────────────────────────────────────────────────────

export async function buildSnapshot(
  repo: SqliteContentRepository = new SqliteContentRepository(),
): Promise<DigitalPresenceSnapshot> {
  const now = Date.now()
  const drafts = repo.listDrafts({ limit: 200 })
  const [engagement, reviews, budget] = await Promise.all([
    buildEngagementMetrics(),
    buildReviewMetrics(now),
    buildBudgetMetrics(),
  ])
  const posts = buildPostingMetrics(drafts, now)
  const attribution = buildAttributionMetrics()
  const alerts = buildAlerts(posts, engagement, reviews, budget)
  return {
    iso_date: isoDateOf(now),
    built_at: now,
    posts,
    engagement,
    reviews,
    budget,
    attribution,
    alerts,
  }
}
