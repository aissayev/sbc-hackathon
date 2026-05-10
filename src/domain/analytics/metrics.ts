// Digital-presence KPI definitions — single source of truth for the shape
// of the analytics snapshot. Everything that reads /stats reads this file
// for the type, not the JSON column directly.
//
// Why pinned in code: dashboard rendering, alert thresholds, and the
// snapshot writer all need to agree on the same fields. Drift here means
// silent NaN columns in /stats.

export interface DigitalPresenceSnapshot {
  iso_date: string                  // "2026-05-09"
  built_at: number                  // epoch ms
  posts: PostingMetrics
  engagement: EngagementMetrics
  reviews: ReviewMetrics
  budget: BudgetMetrics
  attribution: AttributionMetrics
  alerts: AlertSignal[]
}

export interface PostingMetrics {
  /** ContentDraft rows with status='published' in the last 7 days. */
  posts_7d: number
  /** Same, broken out by kind. */
  posts_by_kind_7d: Record<string, number>
  /** Cadence target (posts per week). Hardcoded from brief: ~5/week. */
  cadence_target: number
  /** Slots scheduled but not yet published this week. */
  scheduled_7d: number
  /** Drafts pending approval (status='draft' or 'brand_pending'). */
  pending_review: number
}

export interface EngagementMetrics {
  /** Sum of WA + IG DM threads visible right now. */
  inbox_open: number
  /** Sentiment breakdown across visible inbox + recent reviews. */
  sentiment_split: { positive: number; neutral: number; negative: number; risk: number }
  /** Items with sentiment.risk = true that haven't been replied to. */
  unhandled_risk: number
}

export interface ReviewMetrics {
  /** Review count from the sandbox `gb_list_reviews` (all-time visible). */
  total_visible: number
  /** Average rating across visible reviews. */
  avg_rating: number
  /** Reviews that don't yet have a `hasReply` flag. */
  unanswered: number
  /** Negative reviews (≤2 stars OR sentiment='negative'/'risk') in last 48h. */
  negative_velocity_48h: number
}

export interface BudgetMetrics {
  /** Monthly cap from `marketing_get_budget` (USD cents for math, displayed as $). */
  monthly_cap_cents: number
  /** MTD spend across all running/closed campaigns. */
  mtd_spend_cents: number
  /** Active campaign count from sandbox. */
  active_campaigns: number
  /** Cumulative leads attributed to all campaigns this month. */
  mtd_leads: number
}

export interface AttributionMetrics {
  /** Orders (any status) MTD with referral_source set. */
  attributed_orders: number
  /** Total MTD orders. */
  total_orders: number
  /** Top 3 referral sources by revenue (cents). */
  top_sources: Array<{ source: string; orders: number; revenue_cents: number }>
}

export type AlertSeverity = 'info' | 'warn' | 'high'

export interface AlertSignal {
  severity: AlertSeverity
  code: string
  msg: string
  /** Optional deeplink — slash command the operator can tap. */
  cta?: string
}

// ─── Helpers (used by the renderer) ────────────────────────────────────

export function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function postingShortfall(p: PostingMetrics): number {
  return Math.max(0, p.cadence_target - p.posts_7d)
}

export function spendBurnPct(b: BudgetMetrics): number {
  if (b.monthly_cap_cents <= 0) return 0
  return Math.round((b.mtd_spend_cents / b.monthly_cap_cents) * 100)
}

export function attributionPct(a: AttributionMetrics): number {
  if (a.total_orders === 0) return 0
  return Math.round((a.attributed_orders / a.total_orders) * 100)
}

export function isoDateOf(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}
