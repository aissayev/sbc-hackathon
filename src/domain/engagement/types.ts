// Engagement domain types — comments, DMs, reviews from any external surface.
//
// Engagement items are intentionally NOT persisted in this Phase 2: every
// tick we re-pull from the sandbox MCP, score sentiment, and render. This
// keeps state simple (one source of truth, no stale-cache class of bugs).
// Phase 3 adds a snapshot table for analytics (engagement_items) but the
// domain stays the same.

import type { SentimentScore } from './sentiment.ts'

export type EngagementSource = 'wa_dm' | 'ig_dm' | 'gbp_review'

export interface EngagementItem {
  source: EngagementSource
  remote_id: string
  author_handle: string | null
  author_name: string | null
  text: string
  rating: number | null   // reviews only
  sentiment: SentimentScore
  occurred_at: number | null
  parent_post_ref: string | null
  /** True if the platform shows we already replied (gb_list_reviews carries
   *  this flag; DMs we infer from the absence of a pending message). */
  has_reply: boolean
}
