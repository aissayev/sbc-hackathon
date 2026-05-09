// Smoke test for the sandbox MCP HTTP client.
// Calls a known-safe read tool and prints the result.
//
// Run:  bun src/scripts/test-sandbox-mcp.ts

import { callSandboxTool } from '../lib/sandbox-mcp.ts'

console.log('[smoke] calling square_list_catalog via direct HTTP MCP...')
const t0 = Date.now()

interface CatalogItem {
  productId: string
  name: string
  category?: string
  price?: number
  marginPct?: number
  capacityPerDay?: number
  leadTimeMinutes?: number
  custom?: boolean
}

const catalog = await callSandboxTool<CatalogItem[] | { items?: CatalogItem[] }>('square_list_catalog', {})

const items = Array.isArray(catalog) ? catalog : (catalog.items ?? [])
console.log(`✓ ${Date.now() - t0}ms — ${items.length} items returned`)
for (const item of items.slice(0, 5)) {
  console.log(`  • ${item.name} (${item.productId}): $${item.price} · margin ${item.marginPct}%`)
}

console.log('\n[smoke] calling marketing_get_budget...')
const t1 = Date.now()
const budget = await callSandboxTool('marketing_get_budget', {})
console.log(`✓ ${Date.now() - t1}ms`)
console.log(JSON.stringify(budget, null, 2).slice(0, 300))
