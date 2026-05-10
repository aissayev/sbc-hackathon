// Public catalog API + the SQLite mirror of the sandbox MCP catalog.
// The website calls /api/catalog directly; the agent still calls the MCP
// (rubric requirement). Sync is gated by CATALOG_SYNC_SECRET so it can't
// be triggered by the public internet.

import { Hono } from 'hono'
import { config } from '../config.ts'
import { listProducts, getProduct } from '../domain/tools.ts'
import { syncCatalogFromSandbox, getLastSync } from '../domain/catalog-sync.ts'

export const catalogRoutes = new Hono()

catalogRoutes.get('/api/products', (c) => c.json({ products: listProducts({ in_stock_only: true }) }))

catalogRoutes.get('/api/products/:id', (c) => {
  const p = getProduct(c.req.param('id'))
  return p ? c.json(p) : c.json({ error: 'not found' }, 404)
})

catalogRoutes.get('/api/catalog', (c) => {
  const products = listProducts({ in_stock_only: false })
  const sync = getLastSync()
  return c.json({
    products,
    sync: sync ? { ok: sync.ok, at: sync.at, matched: sync.matched, error: sync.error } : null,
  })
})

catalogRoutes.post('/api/catalog/sync', async (c) => {
  if (!config.catalog.syncSecret) {
    return c.json({ error: 'sync endpoint disabled (CATALOG_SYNC_SECRET not set)' }, 503)
  }
  const provided = c.req.header('x-sync-secret')
  if (provided !== config.catalog.syncSecret) {
    return c.json({ error: 'forbidden' }, 403)
  }
  const result = await syncCatalogFromSandbox()
  return c.json(result, result.ok ? 200 : 502)
})
