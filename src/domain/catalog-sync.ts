// Catalog sync: sandbox MCP → local SQLite mirror.
//
// The hackathon rubric says the sandbox MCP is the source of truth for catalog,
// inventory, and capacity. The website needs the same truth without bypassing
// the backend (the agent runtime owns the MCP token; exposing it to the
// browser would be a security mistake). So:
//
//   sandbox MCP   →   sync (this file)   →   SQLite mirror   →   /api/catalog
//
// Reads stay fast and survive sandbox outages — the website always renders
// from the last successful sync. Writes (drafts, escalations) keep going to
// SQLite as before; this module only updates the products table's catalog
// columns (price, in_stock, capacity, lead time, remote_id).
//
// Match strategy: the MCP item names map to our slug ids by normalized name
// (lowercase, alphanumeric only). The seed (data/catalog/happycake.seed.json)
// already contains the slugs the website expects; sync only refreshes the
// dynamic columns on existing rows. Items in MCP that don't match any local
// row are reported in `unmatched_mcp` so we can backfill the seed if needed.

import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { getDb } from '../db/db.ts'

// Shape inferred from src/scripts/test-sandbox-mcp.ts (which is itself derived
// from a live `square_list_catalog` response). Defensive: every field optional
// so a sandbox schema tweak doesn't crash the sync.
interface SandboxCatalogItem {
  productId?: string
  name?: string
  category?: string
  price?: number // dollars (not cents)
  marginPct?: number
  capacityPerDay?: number
  leadTimeMinutes?: number
  custom?: boolean
  inStock?: boolean
}

type SandboxCatalogResponse = SandboxCatalogItem[] | { items?: SandboxCatalogItem[] }

export interface SyncResult {
  ok: boolean
  at: number
  matched: number
  unmatched_mcp: string[]
  unmatched_local: string[]
  error?: string
}

let lastSync: SyncResult | null = null

export function getLastSync(): SyncResult | null {
  return lastSync
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Build a normalized-name → local product id map once per sync. Cheaper than
// running a LIKE query per MCP item.
function loadLocalNameIndex(): Map<string, string> {
  const rows = getDb().prepare('SELECT id, name FROM products').all() as Array<{ id: string; name: string }>
  const idx = new Map<string, string>()
  for (const r of rows) idx.set(normalize(r.name), r.id)
  return idx
}

export async function syncCatalogFromSandbox(): Promise<SyncResult> {
  const at = Date.now()
  const raw = await tryCallSandboxTool<SandboxCatalogResponse>('square_list_catalog', {})
  if (!raw) {
    const result: SyncResult = {
      ok: false,
      at,
      matched: 0,
      unmatched_mcp: [],
      unmatched_local: [],
      error: 'sandbox MCP unreachable',
    }
    lastSync = result
    return result
  }

  const items = Array.isArray(raw) ? raw : (raw.items ?? [])
  const localIdx = loadLocalNameIndex()
  const matchedLocalIds = new Set<string>()
  const unmatched_mcp: string[] = []

  const update = getDb().prepare(
    `UPDATE products
     SET price_cents = ?,
         daily_capacity = ?,
         lead_time_hours = ?,
         in_stock = ?,
         remote_id = ?,
         updated_at = ?
     WHERE id = ?`,
  )

  let matched = 0
  for (const item of items) {
    if (!item.name) continue
    const localId = localIdx.get(normalize(item.name))
    if (!localId) {
      unmatched_mcp.push(item.name)
      continue
    }
    const price_cents = typeof item.price === 'number' ? Math.round(item.price * 100) : null
    const lead_time_hours =
      typeof item.leadTimeMinutes === 'number' ? Math.max(1, Math.ceil(item.leadTimeMinutes / 60)) : null
    // MCP doesn't expose explicit "in_stock"; treat presence in the catalog as
    // available unless an explicit `inStock: false` ever appears.
    const in_stock = item.inStock === false ? 0 : 1
    update.run(
      price_cents ?? 0,
      item.capacityPerDay ?? null,
      lead_time_hours ?? 1,
      in_stock,
      item.productId ?? null,
      at,
      localId,
    )
    matchedLocalIds.add(localId)
    matched++
  }

  const allLocal = (getDb().prepare('SELECT id FROM products').all() as Array<{ id: string }>).map((r) => r.id)
  const unmatched_local = allLocal.filter((id) => !matchedLocalIds.has(id))

  const result: SyncResult = { ok: true, at, matched, unmatched_mcp, unmatched_local }
  lastSync = result
  return result
}

// ─── Periodic refresh ────────────────────────────────────────────────────
// Single timer per process. Idempotent — calling start() twice does nothing.

let timer: ReturnType<typeof setInterval> | null = null

export function startCatalogSync(intervalMs: number): void {
  if (timer !== null) return
  // Fire once immediately (non-blocking) so the first request after boot has
  // fresh data. Errors are already swallowed inside syncCatalogFromSandbox.
  void syncCatalogFromSandbox().then((r) => {
    if (r.ok) {
      console.log(`[catalog-sync] initial: matched=${r.matched} unmatched_mcp=${r.unmatched_mcp.length}`)
    } else {
      console.warn(`[catalog-sync] initial failed: ${r.error}`)
    }
  })
  timer = setInterval(() => {
    void syncCatalogFromSandbox().then((r) => {
      if (!r.ok) console.warn(`[catalog-sync] tick failed: ${r.error}`)
    })
  }, intervalMs)
  // Don't keep the process alive solely for this timer.
  if (typeof timer.unref === 'function') timer.unref()
}

export function stopCatalogSync(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}
