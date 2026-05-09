// Initialize SQLite + optionally seed with Happy Cake US stub catalog.
// Usage:
//   bun src/scripts/db-init.ts          # apply schema only
//   bun src/scripts/db-init.ts --seed   # apply schema + seed catalog

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDb } from '../db/db.ts'

const args = new Set(process.argv.slice(2))
const db = getDb()
console.log('schema applied at', (db as unknown as { filename: string }).filename ?? 'sqlite')

if (args.has('--seed')) {
  const seed = JSON.parse(readFileSync(resolve('data/catalog/happycake.seed.json'), 'utf8')) as {
    products: Array<{
      id: string
      name: string
      category: string
      price_cents: number
      lead_time_hours: number
      allergens?: string
      description?: string
      photo_url?: string
      in_stock: number
      daily_capacity?: number
    }>
  }

  const now = Date.now()
  const insert = db.prepare(
    `INSERT INTO products
     (id, name, category, price_cents, lead_time_hours, allergens, description, photo_url, in_stock, daily_capacity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, category = excluded.category, price_cents = excluded.price_cents,
       lead_time_hours = excluded.lead_time_hours, allergens = excluded.allergens,
       description = excluded.description, photo_url = excluded.photo_url,
       in_stock = excluded.in_stock, daily_capacity = excluded.daily_capacity,
       updated_at = excluded.updated_at`,
  )
  let count = 0
  for (const p of seed.products) {
    insert.run(
      p.id,
      p.name,
      p.category,
      p.price_cents,
      p.lead_time_hours,
      p.allergens ?? null,
      p.description ?? null,
      p.photo_url ?? null,
      p.in_stock,
      p.daily_capacity ?? null,
      now,
      now,
    )
    count++
  }
  console.log(`seeded ${count} products`)
}
