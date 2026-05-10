// SQLite handle, lazily opened. Schema applied on first open.

import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.ts'

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db
  mkdirSync(dirname(config.db.path), { recursive: true })
  _db = new Database(config.db.path)
  _db.exec('PRAGMA journal_mode = WAL')
  _db.exec('PRAGMA foreign_keys = ON')
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  _db.exec(schema)
  applyMigrations(_db)
  return _db
}

// Idempotent column-add migrations. CREATE TABLE IF NOT EXISTS doesn't
// retrofit columns onto existing rows, so each new optional column needs
// a guarded ALTER TABLE here. SQLite raises "duplicate column name" if it
// already exists — we swallow that one specific error.
function applyMigrations(db: Database) {
  const addColumn = (table: string, column: string, type: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
    } catch (err) {
      const msg = (err as Error).message
      if (!msg.includes('duplicate column')) throw err
    }
  }
  // 2026-05-10: ?ref= attribution on draft orders.
  addColumn('orders', 'referral_source', 'TEXT')
}

export function closeDb() {
  _db?.close()
  _db = null
}
