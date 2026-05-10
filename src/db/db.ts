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

  // 2026-05-10: refund flow — extend orders.status CHECK to include
  // `refund_pending` + `refunded`. SQLite can't ALTER a CHECK constraint
  // in place; the dance is rebuild-and-rename. Idempotent: we read the
  // existing CREATE statement and skip if it already lists the new states.
  if (tableExists('orders')) {
    const row = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'")
      .get() as { sql: string } | undefined
    if (row && !row.sql.includes("'refunded'")) {
      console.log('[db] migrating orders table: widening status CHECK for refund states')
      db.exec('BEGIN')
      try {
        // Mirror the schema.sql definition exactly. We're widening the
        // CHECK and otherwise preserving the table.
        db.exec(`
          CREATE TABLE orders_new (
            id            TEXT PRIMARY KEY,
            thread_id     TEXT NOT NULL,
            channel       TEXT NOT NULL,
            status        TEXT NOT NULL CHECK (status IN ('draft','approved','rejected','in_kitchen','ready','out_for_delivery','picked_up','completed','cancelled','refund_pending','refunded')),
            customer_name TEXT,
            customer_phone TEXT,
            items_json    TEXT NOT NULL,
            total_cents   INTEGER NOT NULL,
            scheduled_at  TEXT,
            pickup_or_delivery TEXT NOT NULL DEFAULT 'pickup',
            notes         TEXT,
            square_order_id TEXT,
            kitchen_ticket_id TEXT,
            referral_source TEXT,
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
          );
          INSERT INTO orders_new
            (id, thread_id, channel, status, customer_name, customer_phone, items_json,
             total_cents, scheduled_at, pickup_or_delivery, notes, square_order_id,
             kitchen_ticket_id, referral_source, created_at, updated_at)
          SELECT
            id, thread_id, channel, status, customer_name, customer_phone, items_json,
            total_cents, scheduled_at, pickup_or_delivery, notes, square_order_id,
            kitchen_ticket_id, referral_source, created_at, updated_at
          FROM orders;
          DROP TABLE orders;
          ALTER TABLE orders_new RENAME TO orders;
        `)
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      // The indexes were dropped with the old table. schema.exec below
      // recreates them via CREATE INDEX IF NOT EXISTS.
    }
  }
}

export function closeDb() {
  _db?.close()
  _db = null
}
