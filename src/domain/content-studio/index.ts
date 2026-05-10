// Public API of the content-studio bounded context. Callers depend on this
// barrel, never on individual files. Keeps the public surface tight.

export type {
  BrandCheck,
  BrandIssue,
  ContentDraft,
  DraftChannel,
  DraftKind,
  DraftStatus,
  PlanSlot,
  PublishReceipt,
  ReelBrief,
  SlotStatus,
} from './entities.ts'
export { isoWeekOf, newDraftId, newSlotId } from './entities.ts'
export { checkBrand, summarizeCheck } from './brand-checker.ts'
export { DraftService, type CreateDraftInput, type EditCaptionInput, type ScheduleInput, type PublishOutcome } from './draft-service.ts'
export { PlanService, DEFAULT_WEEKLY_RHYTHM, type SlotSeed } from './plan-service.ts'
export type { ContentRepository, DraftFilter, ScheduledDueFilter } from './repository.ts'
export { SqliteContentRepository } from './repository-sqlite.ts'
