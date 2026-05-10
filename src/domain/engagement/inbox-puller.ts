// Inbox puller — fetches DMs + reviews from the sandbox MCP, normalizes
// the per-tool shapes (the schemas drift slightly between tools), and runs
// each item through sentiment.
//
// One file = one job. The TG cockpit calls listInbox / listReviews; the
// underlying sandbox shape is hidden from the presenter.

import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import { scoreSentiment } from './sentiment.ts'
import type { EngagementItem, EngagementSource } from './types.ts'

interface RawThread {
  threadId?: string
  id?: string
  from?: string
  customerHandle?: string
  customer_handle?: string
  customerName?: string
  lastMessage?: string
  last_message?: string
  lastMessageAt?: string | number
  last_message_at?: string | number
  hasReply?: boolean
  replied?: boolean
  parentPostId?: string
}

interface RawReview {
  id?: string
  reviewId?: string
  rating?: number
  stars?: number
  text?: string
  body?: string
  authorName?: string
  author?: string
  hasReply?: boolean
  replied?: boolean
  createdAt?: string | number
  created_at?: string | number
}

function timestampOf(v: string | number | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

function threadToItem(t: RawThread, source: EngagementSource): EngagementItem {
  const text = t.lastMessage ?? t.last_message ?? ''
  const handle = t.customerHandle ?? t.customer_handle ?? t.from ?? t.threadId ?? t.id ?? null
  return {
    source,
    remote_id: String(t.threadId ?? t.id ?? handle ?? ''),
    author_handle: handle ?? null,
    author_name: t.customerName ?? null,
    text,
    rating: null,
    sentiment: scoreSentiment(text),
    occurred_at: timestampOf(t.lastMessageAt ?? t.last_message_at),
    parent_post_ref: t.parentPostId ?? null,
    has_reply: t.hasReply ?? t.replied ?? false,
  }
}

function reviewToItem(r: RawReview): EngagementItem {
  const text = r.text ?? r.body ?? ''
  return {
    source: 'gbp_review',
    remote_id: String(r.id ?? r.reviewId ?? ''),
    author_handle: null,
    author_name: r.authorName ?? r.author ?? null,
    text,
    rating: r.rating ?? r.stars ?? null,
    sentiment: scoreSentiment(text),
    occurred_at: timestampOf(r.createdAt ?? r.created_at),
    parent_post_ref: null,
    has_reply: r.hasReply ?? r.replied ?? false,
  }
}

function normaliseList<T>(raw: unknown, key: string): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const arr = obj[key]
    if (Array.isArray(arr)) return arr as T[]
  }
  return []
}

export async function listDmInbox(): Promise<EngagementItem[]> {
  const [wa, ig] = await Promise.all([
    tryCallSandboxTool('whatsapp_list_threads', {}),
    tryCallSandboxTool('instagram_list_dm_threads', {}),
  ])
  const waThreads = normaliseList<RawThread>(wa, 'threads').map((t) => threadToItem(t, 'wa_dm'))
  const igThreads = normaliseList<RawThread>(ig, 'threads').map((t) => threadToItem(t, 'ig_dm'))
  return [...waThreads, ...igThreads].sort(
    (a, b) => (b.occurred_at ?? 0) - (a.occurred_at ?? 0),
  )
}

export async function listReviewInbox(): Promise<EngagementItem[]> {
  const raw = await tryCallSandboxTool('gb_list_reviews', {})
  return normaliseList<RawReview>(raw, 'reviews')
    .map(reviewToItem)
    .sort((a, b) => (b.occurred_at ?? 0) - (a.occurred_at ?? 0))
}

/** Cheap counter for the digest line: how many items per sentiment bucket. */
export function summariseSentiment(items: EngagementItem[]): {
  positive: number
  neutral: number
  negative: number
  risk: number
  unhandled: number
} {
  const out = { positive: 0, neutral: 0, negative: 0, risk: 0, unhandled: 0 }
  for (const i of items) {
    out[i.sentiment.label] += 1
    if (!i.has_reply) out.unhandled += 1
  }
  return out
}
