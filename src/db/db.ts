// SQLite handle, lazily opened. Schema applied on first open.

import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, existsSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { config } from '../config.ts'

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db
  mkdirSync(dirname(config.db.path), { recursive: true })
  _db = openWithCorruptionRecovery(config.db.path)
  _db.exec('PRAGMA journal_mode = WAL')
  _db.exec('PRAGMA foreign_keys = ON')
  // Migrations run BEFORE schema.exec because schema.sql may reference
  // columns added by migration (e.g. CREATE INDEX on referral_source). On
  // a fresh DB the migration is a no-op (the table doesn't exist yet).
  applyMigrations(_db)
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  _db.exec(schema)
  autoSeedProductsIfEmpty(_db)
  return _db
}

// Open the SQLite file. If it's corrupt (file system damage, partial
// write, wrong format), rename it aside and open a fresh DB. This trades
// non-critical local state (chat history, draft orders) for the backend
// staying up — the alternative is the whole server crashing on every
// request. Production-grade resilience for hackathon-quality storage.
function openWithCorruptionRecovery(path: string): Database {
  try {
    const db = new Database(path)
    // Probe the file: a corrupt header throws here even if `new Database`
    // succeeded (Bun opens lazily).
    db.exec('SELECT 1')
    return db
  } catch (err) {
    const msg = (err as Error).message
    // Only handle real corruption signals — propagate other errors (e.g.
    // permission denied) so the operator sees them.
    const isCorrupt = /malformed|not a database|corrupt|file is encrypted/i.test(msg)
    if (!isCorrupt) throw err
    if (!existsSync(path)) throw err
    const aside = `${path}.corrupt-${Date.now()}`
    console.error(`[db] CORRUPT db at ${path}: ${msg}`)
    console.error(`[db] moving aside to ${aside} and starting fresh`)
    renameSync(path, aside)
    // Move WAL + SHM with the same suffix so they don't try to recover the corrupt main.
    for (const ext of ['-wal', '-shm']) {
      if (existsSync(path + ext)) renameSync(path + ext, aside + ext)
    }
    return new Database(path)
  }
}

// Idempotent products seed: if the products table is empty AND the canonical
// seed file is on disk, load it. Stops fresh clones / worktrees from tripping
// "unknown product <id>" the first time the website tries to draft an order.
// In prod the table is populated from the Square sandbox catalog; this guard
// only fires when nobody has seeded yet, so it's safe to leave on.
function autoSeedProductsIfEmpty(db: Database) {
  try {
    const { c } = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }
    if (c > 0) return
    const seedPath = resolve('data/catalog/happycake.seed.json')
    if (!existsSync(seedPath)) return
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as {
      products: Array<{
        id: string; name: string; category: string; price_cents: number
        lead_time_hours: number; allergens?: string; description?: string
        photo_url?: string; in_stock: number; daily_capacity?: number
      }>
    }
    if (!seed.products?.length) return
    const now = Date.now()
    const insert = db.prepare(
      `INSERT INTO products
       (id, name, category, price_cents, lead_time_hours, allergens, description, photo_url, in_stock, daily_capacity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const tx = db.transaction((rows: typeof seed.products) => {
      for (const p of rows) {
        insert.run(
          p.id, p.name, p.category, p.price_cents, p.lead_time_hours,
          p.allergens ?? null, p.description ?? null, p.photo_url ?? null,
          p.in_stock, p.daily_capacity ?? null, now, now,
        )
      }
    })
    tx(seed.products)
    console.log(`[db] auto-seeded ${seed.products.length} products from happycake.seed.json`)
  } catch (err) {
    console.warn('[db] auto-seed skipped:', (err as Error).message)
  }
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

  // 2026-05-10: CRM. Link orders + threads to a customers row so the
  // owner can see "Maria's 12th order" and the agent can recognize a
  // repeat caller. The customers table itself is created by schema.sql
  // (CREATE TABLE IF NOT EXISTS); only the foreign-key columns on
  // existing tables need an idempotent ALTER.
  addColumn('orders', 'customer_id', 'TEXT')
  addColumn('threads', 'customer_id', 'TEXT')
  addColumn('orders', 'customer_email', 'TEXT')

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
