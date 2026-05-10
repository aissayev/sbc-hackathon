# Catalog — local mirror vs sandbox source-of-truth

How the website, the agent, and the order flow each see the catalog, and why the two MCP surfaces are not duplicates.

---

## TL;DR

| | `mcp__local__list_products` | `mcp__happycake__square_list_catalog` |
|---|---|---|
| **Source** | SQLite mirror seeded from [data/catalog/happycake.seed.json](../../data/catalog/happycake.seed.json) | Sandbox simulator at https://www.steppebusinessclub.com/api/mcp |
| **Items** | 10 (full window-display catalog) | 5 (the simulator-tracked subset) |
| **Has** | Photos, descriptions, allergens, lead-time hours, daily-capacity, slugs (URL-safe ids) | Live in-stock, live price, marginPct, capacityPerDay, custom flag |
| **Refresh** | Synced periodically from sandbox via [src/domain/catalog-sync.ts](../../src/domain/catalog-sync.ts) (default every 5 min) | Always live |
| **Used for** | Discovery — catalog browsing, agent recommendations, website renders | Booking — orders must verify SKU exists in sandbox before drafting |

The two are **not parallel sources of truth**. Sandbox is authoritative for what can be ordered. Local is a *richer projection* that adds presentation data the sandbox doesn't carry.

---

## Why two

The hackathon brief makes the sandbox MCP the source of truth for catalog/inventory/capacity. We comply — every dynamic field (price, in-stock, lead time, capacity) ultimately comes from `square_list_catalog`. But the website needs more than what the sandbox returns:

- **Photos** — sandbox returns no images; we have a curated set in `/public/products/`
- **Marketing copy** — sandbox names cakes, doesn't describe them; the brand book demands two-epithet maximum descriptions
- **Allergens** — sandbox doesn't surface a structured list; the FDA requires us to tell customers honestly
- **Slug ids** — sandbox `productId` like `sq_var_honey_cake_slice` isn't a URL we want to expose

So we sync sandbox → SQLite, then add the projection columns. Reads stay fast (one local query), survive sandbox outages (the website always renders from the last successful sync), and don't expose the team token to the browser.

---

## The catalog-divergence reality

The website displays **10 products**; the sandbox simulator tracks **5**. Why:

The full Happy Cake menu (per the brand book + real bakery photos) has 10 items. The sandbox simulator was set up with a curated subset for the hackathon — enough variety to drive scenarios without needing to seed every SKU. So:

- **Local catalog (10):** honey-cake-slice, pistachio-roll, cloud-cake-slice, tiramisu-slice, chak-chak, truffle-bites, whole-honey-cake, custom-birthday-cake, office-dessert-box, morning-pastry-mix
- **Sandbox catalog (5):** honey, pistachio-roll, custom-birthday, office-dessert-box, morning-pastry-mix (names are normalized)

When the agent needs to draft an order, [order-orchestration.ts:97-111](../../src/domain/order-orchestration.ts#L97) pre-checks every SKU against the sandbox catalog cache. If a customer orders something local-only (e.g. "tiramisu slice"), the draft is flagged `unsupported_skus: ['tiramisu-slice']` and routes for **manual fulfillment** — owner gets a card explaining the order needs offline handling rather than the auto-approve happy path.

This is the right behavior for a real bakery: the sandbox-tracked subset would be the items integrated with Square POS, the rest would be fulfilled manually until the owner expands Square coverage.

---

## Read paths

```
Customer browsing /menu
    → web/src/app/menu/page.tsx
        → web/src/lib/api.ts:listProducts()
            → fetch http://backend:3000/api/products
                → SQLite SELECT * FROM products
                    (mirror, freshness ≤ 5 min from sandbox)
```

```
Agent answering "what cakes do you have?"
    → claude -p (concierge role)
        → mcp__local__list_products  (10 items, rich content)
        OR
        → mcp__happycake__square_list_catalog  (5 items, live)
    Per the concierge prompt: prefer local; fall back to sandbox if local
    is empty (boot/sync failure case)
```

```
Agent drafting an order
    → claude -p (concierge role)
        → mcp__local__create_draft_order
            → SQLite INSERT into orders, status='draft'
            → POST owner approval card to TG (or auto-approve standard catalog)
            → on approve: order-orchestration.ts pre-checks sandbox SKU
                          → if backed: square_create_order + kitchen_create_ticket
                          → if not:    flag manual_fulfillment, owner reviews
```

---

## Sync protocol

[src/domain/catalog-sync.ts](../../src/domain/catalog-sync.ts) runs:

1. On server boot (one-shot)
2. On a 5-minute interval (configurable via `CATALOG_SYNC_INTERVAL_MS`)
3. On demand via `POST /api/catalog/sync` (gated by `CATALOG_SYNC_SECRET`)

It calls `square_list_catalog`, normalizes each MCP item name to a slug (lowercase, alphanumeric only), looks up the matching local row by name, and updates only the dynamic columns (`price_cents`, `in_stock`, `daily_capacity`, `lead_time_hours`, `remote_id`). Items in MCP without a local match go into `unmatched_mcp` (logged so we know if the sandbox added a SKU we should backfill into the seed).

The presentation columns — photo, description, allergens — are owned by the seed and only updated when we edit `data/catalog/happycake.seed.json` and re-run `bun run db:seed`.

---

## What this means for the rubric

| Rubric line | How the catalog setup serves it |
|---|---|
| **Functional tester** | Standard-catalog drafts auto-approve via the sandbox-backed path; non-sandbox SKUs surface clean manual-fulfillment cards instead of failing with cryptic Square errors |
| **Agent-friendliness** | `/api/products` and `/menu`'s ItemList JSON-LD give an AI customer 10 products with full content in one fetch; per-product pages add Product+Offer schema |
| **On-site assistant** | The concierge agent always grounds price/availability/lead-time questions in either the local mirror (fast) or sandbox (live) — never invents |
| **Code reviewer** | The sandbox-is-truth contract is documented here; the merge logic in `catalog-sync.ts` is small, idempotent, and named |
| **Innovation** | Live catalog mirroring (not just static seed): website never hits sandbox MCP directly, team token never leaves the agent subprocess, sandbox outages don't take the website down |

---

## Open questions that aren't questions

- *"Why not just call sandbox MCP from the website?"* — Because the team token is a hackathon secret that can't be exposed to the browser, and `claude -p` is the only path that gets it. The backend is the trust boundary; the website reads through `/api/catalog`.
- *"Why not sync just-in-time on every page load?"* — The sandbox can be slow (200–500ms tail) and it'd cost a tool call per visitor. The 5-minute interval is dramatically cheaper and the freshness is good enough for a bakery (price changes are weekly, not minute-to-minute).
- *"What if the sandbox adds a new SKU?"* — `unmatched_mcp` logs it on every sync. Owner gets a one-line warning in the boot log; we backfill the seed manually (or the sync logs a Telegram alert if the count crosses 3).
