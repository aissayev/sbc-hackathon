// SQLite handle, lazily opened. Schema applied on first open.

import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
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
  autoSeedProductsIfEmpty(_db)
  return _db
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
}

export function closeDb() {
  _db?.close()
  _db = null
}
