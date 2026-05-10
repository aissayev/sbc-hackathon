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
  // Migrations run BEFORE schema.exec because schema.sql may reference
  // columns added by migration (e.g. CREATE INDEX on referral_source). On
  // a fresh DB the migration is a no-op (the table doesn't exist yet).
  applyMigrations(_db)
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  _db.exec(schema)
  return _db
}

// Idempotent column-add migrations. CREATE TABLE IF NOT EXISTS doesn't
// retrofit columns onto existing rows, so each new optional column needs
// a guarded ALTER TABLE here. SQLite raises "duplicate column name" if it
// already exists — we swallow that one specific error.
function applyMigrations(db: Database) {
  const tableExists = (name: string): boolean => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name)
    return !!row
  }
  const addColumn = (table: string, column: string, type: string) => {
    if (!tableExists(table)) return  // schema.exec hasn't created it yet — nothing to migrate
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
