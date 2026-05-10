// Analytics bounded context — public surface.

export type {
  AlertSeverity,
  AlertSignal,
  AttributionMetrics,
  BudgetMetrics,
  DigitalPresenceSnapshot,
  EngagementMetrics,
  PostingMetrics,
  ReviewMetrics,
} from './metrics.ts'
export {
  attributionPct,
  fmtUsd,
  isoDateOf,
  postingShortfall,
  spendBurnPct,
} from './metrics.ts'
export type { SnapshotRepository } from './repository.ts'
export { SqliteSnapshotRepository } from './repository-sqlite.ts'
export { buildSnapshot } from './snapshot-builder.ts'
export { startSnapshotScheduler, stopSnapshotScheduler } from './scheduler.ts'
export { diffNewHighAlerts, publishNewHighAlerts, findPriorSnapshot } from './alert-publisher.ts'
