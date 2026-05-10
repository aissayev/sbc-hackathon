// Snapshot repository — interface only. SQLite impl in repository-sqlite.ts.

import type { DigitalPresenceSnapshot } from './metrics.ts'

export interface SnapshotRepository {
  save(snapshot: DigitalPresenceSnapshot): void
  /** Latest snapshot for `iso_date` if present, else null. */
  get(iso_date: string): DigitalPresenceSnapshot | null
  /** Most recent snapshot of any date (for dashboards that say "as of X"). */
  latest(): DigitalPresenceSnapshot | null
}
