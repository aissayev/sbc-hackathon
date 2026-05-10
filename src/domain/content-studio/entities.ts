// Content studio — domain entities + value objects. Pure TypeScript, no I/O.
//
// A ContentDraft is the unit of marketing work. Lifecycle:
//   draft → brand_pending → approved → scheduled → publishing → published
//                                                              → failed
//                                  ↘ discarded   ↘ expired (24h ping, 72h cut)
//
// All persistence is behind ContentRepository (repository.ts).

export type DraftKind =
  | 'post'
  | 'reel'
  | 'story'
  | 'gbp_post'
  | 'comment_reply'
  | 'review_reply'
  | 'wa_broadcast'

export type DraftChannel = 'ig' | 'fb' | 'gbp' | 'wa' | 'multi'

export type DraftStatus =
  | 'draft'
  | 'brand_pending'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'discarded'
  | 'expired'

export interface BrandIssue {
  severity: 'block' | 'warn'
  code: string
  msg: string
  fix?: string
}

export interface BrandCheck {
  ok: boolean         // true iff no blockers
  score: number       // 0..100, simple heuristic
  issues: BrandIssue[]
  checked_at: number  // epoch ms
}

export interface ReelBrief {
  hook: string
  voiceover?: string
  b_roll: string[]
  thumbnail_idea?: string
}

export interface PublishReceipt {
  tool: string
  tool_input: unknown
  tool_output: unknown
  remote_id?: string
  url?: string
  ts: number
}

export interface ContentDraft {
  id: string
  kind: DraftKind
  channel: DraftChannel
  status: DraftStatus
  caption: string
  brief: ReelBrief | null
  media_urls: string[]
  sku_refs: string[]
  brand_check: BrandCheck | null
  owner_note: string | null
  scheduled_for: number | null
  publish_receipt: PublishReceipt | null
  tg_card_msg_id: number | null
  source_intent: string | null
  slot_id: string | null
  created_at: number
  updated_at: number
}

// ─── Plan slots ──────────────────────────────────────────────────────────

export type SlotStatus = 'pending' | 'drafted' | 'approved' | 'published' | 'skipped'

export interface PlanSlot {
  id: string
  iso_week: string       // "2026-W19"
  day_of_week: number    // 0..6 (Mon=0 by ISO)
  hour: number           // 0..23
  channel: DraftChannel
  kind: DraftKind
  topic_hint: string | null
  draft_id: string | null
  status: SlotStatus
  created_at: number
  updated_at: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────

export function isoWeekOf(ts: number): string {
  // ISO-8601 week. Simple impl: Thursday-anchor trick.
  const d = new Date(ts)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (target.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = (target.getTime() - firstThursday.getTime()) / (24 * 3600 * 1000)
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function newDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export function newSlotId(): string {
  return `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}
