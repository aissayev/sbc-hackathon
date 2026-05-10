// In-memory cache of the sandbox MCP catalog.
//
// The order-orchestration pre-check uses this to verify every SKU exists in
// the sandbox before calling `square_create_order`. The website displays 10
// products but the sandbox simulator tracks fewer (5 in the seed snapshot,
// occasionally more after parallel-agent additions). Items in the local
// catalog that aren't in the sandbox catalog must NOT be sent to
// `square_create_order` — the call fails with a cryptic
// `Unknown variationId: sq_var_<sku>` and the order gets stuck.
//
// Instead, those orders take the **manual-fulfillment** path:
//   - Local row updates to status='approved_manual'
//   - Owner gets a clear card explaining offline handling is needed
//   - No Square POS / Kitchen ticket created (the items aren't in those
//     systems either; trying would just produce orphaned remote state)
//
// Cache strategy: 5-minute TTL, populated lazily on first call. The same
// `square_list_catalog` data drives `catalog-sync.ts` (the SQLite mirror);
// this is just a hot path that doesn't need to round-trip the DB.

import { tryCallSandboxTool } from './sandbox-mcp.ts'

interface SandboxItem {
  /** Square catalog item id, e.g. `sq_item_honey_cake_slice`. */
  id?: string
  /** Variation id passed into `square_create_order`, e.g. `sq_var_honey_cake_slice`. */
  variationId?: string
  /** Slug we use locally and on the website, e.g. `honey-cake-slice`. */
  kitchenProductId?: string
  name?: string
  category?: string
  priceCents?: number
}

// Live response shape from `square_list_catalog`:
//   { mode: 'simulated', catalog: [ {id, variationId, kitchenProductId, ...}, ... ] }
// Older shapes also accepted defensively in case the simulator ships a tweak.
type SandboxResponse =
  | { mode?: string; catalog?: SandboxItem[] }
  | { items?: SandboxItem[] }
  | SandboxItem[]

const TTL_MS = 5 * 60 * 1000

interface Cache {
  loadedAt: number
  knownSkus: Set<string>
  variationIds: Set<string>
}

let cache: Cache | null = null

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function variationIdFromSku(sku: string): string {
  return `sq_var_${sku.replace(/-/g, '_')}`
}

function extractItems(raw: SandboxResponse | null | undefined): SandboxItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if ('catalog' in raw && Array.isArray(raw.catalog)) return raw.catalog
  if ('items' in raw && Array.isArray(raw.items)) return raw.items
  return []
}

async function refresh(): Promise<Cache> {
  const raw = await tryCallSandboxTool<SandboxResponse>('square_list_catalog', {})
  const items = extractItems(raw)

  const knownSkus = new Set<string>()
  const variationIds = new Set<string>()

  for (const it of items) {
    // The sandbox surfaces three identifiers per item; we match against any
    // of them so callers can pass either the local slug or the variation id.
    if (typeof it.kitchenProductId === 'string') {
      knownSkus.add(it.kitchenProductId)
      knownSkus.add(normalize(it.kitchenProductId))
    }
    if (typeof it.variationId === 'string') {
      variationIds.add(it.variationId)
    }
    if (typeof it.name === 'string') {
      knownSkus.add(normalize(it.name))
    }
  }

  return { loadedAt: Date.now(), knownSkus, variationIds }
}

async function getCache(): Promise<Cache> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache
  cache = await refresh()
  return cache
}

/**
 * Returns true if the given local SKU corresponds to an item in the sandbox
 * catalog. Used as the pre-check before `square_create_order`.
 *
 * Match rules (any one is enough):
 *   - exact slug match (e.g. `office-dessert-box` is in the sandbox)
 *   - normalized-name match (`Office Dessert Box` → `officedessertbox`)
 *   - variation-ID match (`sq_var_office_dessert_box`)
 *
 * Returns false on cache fetch error so the caller falls back to the
 * manual-fulfillment path rather than blowing up the approve flow.
 */
export async function isMcpBackedStrict(sku: string): Promise<boolean> {
  try {
    const c = await getCache()
    if (c.knownSkus.has(sku)) return true
    if (c.knownSkus.has(normalize(sku))) return true
    if (c.variationIds.has(variationIdFromSku(sku))) return true
    return false
  } catch {
    // Cache error — be conservative and report the SKU as not-backed so the
    // approval flow degrades to manual fulfillment instead of crashing.
    return false
  }
}

/** Force a refresh. Used by tests + admin /api/catalog/sync. */
export async function refreshCatalogCache(): Promise<void> {
  cache = await refresh()
}

/** Inspect the current cache state. Used by /api/catalog/cache for debugging. */
export function inspectCache(): { loadedAt: number; size: number } | null {
  if (!cache) return null
  return { loadedAt: cache.loadedAt, size: cache.knownSkus.size }
}
