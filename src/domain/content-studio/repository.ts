// Content studio repository — interface only.
//
// Domain services depend on this interface. SQLite is one implementation
// (repository-sqlite.ts); tests can swap an in-memory impl. SOLID/DI by
// constructor parameter — no globals beyond the entry-point.

import type { ContentDraft, DraftStatus, PlanSlot } from './entities.ts'

export interface DraftFilter {
  status?: DraftStatus | DraftStatus[]
  kind?: string
  channel?: string
  limit?: number
}

export interface ScheduledDueFilter {
  /** Inclusive upper bound (epoch ms). Returns drafts where
   *  status='scheduled' AND scheduled_for <= upTo. */
  upTo: number
  limit?: number
}

export interface ContentRepository {
  // Drafts
  saveDraft(draft: ContentDraft): void
  getDraft(id: string): ContentDraft | null
  listDrafts(filter: DraftFilter): ContentDraft[]
  listScheduledDue(filter: ScheduledDueFilter): ContentDraft[]

  // Slots
  saveSlot(slot: PlanSlot): void
  getSlot(id: string): PlanSlot | null
  listSlotsForWeek(iso_week: string): PlanSlot[]
  listSlotsForChannel(channel: string, isoWeek: string): PlanSlot[]
}
