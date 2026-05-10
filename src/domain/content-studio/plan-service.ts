// Plan service — week-view + slot management.
//
// A "plan" is a list of slots for an ISO week. Slots are advisory (cadence
// targets); the actual ContentDraft can be detached from any slot. When a
// draft is linked to a slot, the slot's status mirrors the draft.

import type { ContentRepository } from './repository.ts'
import {
  isoWeekOf,
  newSlotId,
  type DraftChannel,
  type DraftKind,
  type PlanSlot,
} from './entities.ts'

export interface SlotSeed {
  day_of_week: number
  hour: number
  channel: DraftChannel
  kind: DraftKind
  topic_hint?: string
}

// Default rhythm. Brief recommends ~3-5 posts/week with at least one reel
// and one GBP post. This is the seed; the owner edits via /content over time.
export const DEFAULT_WEEKLY_RHYTHM: SlotSeed[] = [
  { day_of_week: 0, hour: 9, channel: 'ig', kind: 'post', topic_hint: 'Monday slice spotlight' },
  { day_of_week: 1, hour: 12, channel: 'ig', kind: 'reel', topic_hint: 'Tuesday behind-the-scenes' },
  { day_of_week: 3, hour: 9, channel: 'multi', kind: 'post', topic_hint: 'Friday batch announcement' },
  { day_of_week: 4, hour: 17, channel: 'gbp', kind: 'gbp_post', topic_hint: 'Weekend pickup window' },
  { day_of_week: 5, hour: 10, channel: 'ig', kind: 'story', topic_hint: 'Saturday live decorating' },
]

export class PlanService {
  constructor(private readonly repo: ContentRepository) {}

  /** Returns the plan for the requested week, seeding from DEFAULT_WEEKLY_RHYTHM
   *  if the week is empty. Idempotent: calling twice never duplicates. */
  ensureWeek(isoWeek: string, seeds: SlotSeed[] = DEFAULT_WEEKLY_RHYTHM): PlanSlot[] {
    const existing = this.repo.listSlotsForWeek(isoWeek)
    if (existing.length > 0) return existing
    const now = Date.now()
    for (const seed of seeds) {
      const slot: PlanSlot = {
        id: newSlotId(),
        iso_week: isoWeek,
        day_of_week: seed.day_of_week,
        hour: seed.hour,
        channel: seed.channel,
        kind: seed.kind,
        topic_hint: seed.topic_hint ?? null,
        draft_id: null,
        status: 'pending',
        created_at: now,
        updated_at: now,
      }
      this.repo.saveSlot(slot)
    }
    return this.repo.listSlotsForWeek(isoWeek)
  }

  currentWeek(): PlanSlot[] {
    return this.ensureWeek(isoWeekOf(Date.now()))
  }

  attachDraft(slot_id: string, draft_id: string): PlanSlot {
    const slot = this.repo.getSlot(slot_id)
    if (!slot) throw new Error(`slot not found: ${slot_id}`)
    const next: PlanSlot = {
      ...slot,
      draft_id,
      status: 'drafted',
      updated_at: Date.now(),
    }
    this.repo.saveSlot(next)
    return next
  }

  markStatus(slot_id: string, status: PlanSlot['status']): PlanSlot {
    const slot = this.repo.getSlot(slot_id)
    if (!slot) throw new Error(`slot not found: ${slot_id}`)
    const next: PlanSlot = { ...slot, status, updated_at: Date.now() }
    this.repo.saveSlot(next)
    return next
  }

  /** Coverage stat: how many slots have an active (non-skipped) draft. */
  weekCoverage(isoWeek: string): { filled: number; total: number; gaps: PlanSlot[] } {
    const slots = this.repo.listSlotsForWeek(isoWeek)
    const filled = slots.filter((s) => s.status !== 'pending' && s.status !== 'skipped').length
    const gaps = slots.filter((s) => s.status === 'pending')
    return { filled, total: slots.length, gaps }
  }
}
