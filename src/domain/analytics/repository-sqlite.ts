import { getDb } from '../../db/db.ts'
import type { DigitalPresenceSnapshot } from './metrics.ts'
import type { SnapshotRepository } from './repository.ts'

interface Row {
  iso_date: string
  payload_json: string
  built_at: number
}

function rowTo(r: Row): DigitalPresenceSnapshot {
  return JSON.parse(r.payload_json) as DigitalPresenceSnapshot
}

export class SqliteSnapshotRepository implements SnapshotRepository {
  save(s: DigitalPresenceSnapshot): void {
    getDb()
      .prepare(
        `INSERT INTO digital_presence_snapshots (iso_date, payload_json, built_at)
         VALUES (?, ?, ?)
         ON CONFLICT(iso_date) DO UPDATE SET
           payload_json = excluded.payload_json,
           built_at = excluded.built_at`,
      )
      .run(s.iso_date, JSON.stringify(s), s.built_at)
  }

  get(iso_date: string): DigitalPresenceSnapshot | null {
    const row = getDb()
      .prepare('SELECT * FROM digital_presence_snapshots WHERE iso_date = ?')
      .get(iso_date) as Row | undefined
    return row ? rowTo(row) : null
  }

  latest(): DigitalPresenceSnapshot | null {
    const row = getDb()
      .prepare('SELECT * FROM digital_presence_snapshots ORDER BY built_at DESC LIMIT 1')
      .get() as Row | undefined
    return row ? rowTo(row) : null
  }
}
