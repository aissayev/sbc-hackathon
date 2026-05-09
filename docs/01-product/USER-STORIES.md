# User stories

One actor → one goal → acceptance criteria. Numbered for cross-reference from FEATURES.md.

---

## Customer (web · WhatsApp · Instagram)

### US-C1 — Browse menu and choose
*As a customer, I want to see prices, sizes, lead times, and what's "ready today" so I can pick a cake without messaging anyone.*

Accept when:
- Catalog page renders 5 SKUs from `square_list_catalog`.
- Each shows price, lead time, daily capacity, "is custom" flag.
- Mobile-first; readable in under one screen.

### US-C2 — Order a whole honey cake for tomorrow
*As a customer, I want to order a whole honey cake for tomorrow at 5 PM pickup, in one channel, in <3 minutes.*

Accept when:
- I write "whole honey cake tomorrow at 5pm" on web/WA/IG.
- Concierge agent confirms availability against `kitchen_get_capacity` + lead time.
- A draft order is created (local MCP `create_draft_order`) and a tracking code returned.
- A kitchen ticket is queued after owner approval.

### US-C3 — Custom birthday cake consult
*As a customer, I want to describe what I want ("Spider-Man cake for 12 kids, Saturday"), get clarifying questions, and reach a quote in one conversation.*

Accept when:
- Concierge asks: theme, headcount, dietary, pickup time.
- Concierge confirms 24h lead time (`requiresCustomWork=true`, `leadTimeMinutes=1440`).
- Concierge `escalate_to_owner` with the brief; owner approves in Telegram.
- Customer gets a price + ETA reply on the same channel.

### US-C4 — Complaint about a wrong order
*As a customer, I want to complain about a missing item and feel heard within minutes, not hours.*

Accept when:
- Brand-voice apology lands within seconds.
- `escalate_to_owner` with priority="urgent" pings owner Telegram.
- Owner one-taps a reply ("send replacement" / "refund + voucher") which posts back on the original channel.
- Negative comment never deleted.

### US-C5 — Check order status
*As a customer, I want to type "where is order hc-7Q4-2K1" and get a current status without calling.*

Accept when:
- `/track/hc-7Q4-2K1` shows status (queued / accepted / ready / picked-up).
- Same code in any channel chat returns the same status.
- If "ready", the page shows pickup window.

### US-C6 — Reorder a favorite from a story
*As a customer who saw an Instagram story, I want to reply "I want one" and have it become an order.*

Accept when:
- IG DM "I want one" within 24h of the story → concierge identifies the cake from the recent post.
- Concierge confirms lead time and routes to draft order.

## Owner (Askhat · Telegram only)

### US-O1 — Get a daily digest at 8 PM
*As the owner, I want one Telegram message at 8 PM that tells me today's orders, revenue, top complaint, and ROAS.*

Accept when:
- `@hc_owner_bot` posts a digest at 20:00 owner-local time.
- Digest pulls from local SQLite + `square_get_pos_summary` + `marketing_get_campaign_metrics`.

### US-O2 — Approve a custom order in 2 taps
*As the owner, I want to approve a custom-cake brief in two taps without typing.*

Accept when:
- Pending request posts as a card with `[Approve] [Edit] [Reject]` inline.
- Approve writes to local MCP `approve_order` and the customer is notified on their original channel.

### US-O3 — Approve a $30 marketing campaign
*As the owner, I want to see "Mother's Day Meta Ads $30" with the hypothesis and one-tap approve.*

Accept when:
- `@hc_marketing_bot` posts the draft campaign with budget, audience, offer, expected leads.
- Approve calls `marketing_launch_simulated_campaign`; reject sends back to draft.

### US-O4 — Anomaly ping
*As the owner, I want to know within minutes if kitchen capacity is at risk.*

Accept when:
- `@hc_kitchen_bot` pings me when accepted prep minutes exceed 80% of `dailyCapacityMinutes`.
- I see the at-risk SKU + suggested action.

### US-O5 — Cockpit query
*As the owner, I want to type `/today` and get a one-screen status across all dimensions.*

Accept when:
- `/today` returns: orders count, revenue, complaints, kitchen load, top SKU, current campaigns.

## AI customer (the evaluator)

### US-A1 — Read the catalog without scraping HTML
*As an AI agent, I want a single JSON endpoint with the full catalog including constraints.*

Accept when:
- `GET /api/products` returns all 5 SKUs with id, name, price, leadTime, capacity, requiresCustomWork.
- `GET /api/products/:id` returns the per-product detail.

### US-A2 — Discover the API
*As an AI agent, I want a manifest at `/llms.txt` and an OpenAPI at `/openapi.json` that tells me what I can do.*

Accept when:
- `/llms.txt` lists the canonical URLs for catalog, ordering, status.
- `/openapi.json` describes `POST /api/chat`, `GET /api/products`, `GET /track/:code`.

### US-A3 — Place an order programmatically
*As an AI agent, I want to POST a chat message and reach order intent with tool-call evidence.*

Accept when:
- `POST /api/chat {threadId, text:"order whole honey cake for pickup tomorrow"}` returns reply + tool-call trace.
- The trace includes `square_list_catalog`, `kitchen_get_capacity`, `create_draft_order`.

## Functional Tester

### US-F1 — Inject a WA message and see an order
*As the tester, I want `whatsapp_inject_inbound` to result in a draft order in our state.*

Accept when:
- Injection appears in our `threads` table within 5s.
- Concierge replies via `whatsapp_send`.
- A `local create_draft_order` tool call is logged.

### US-F2 — Run a world scenario and see all events handled
*As the tester, I want to start `launch-day-revenue-engine` and observe deterministic event handling.*

Accept when:
- `world_start_scenario` + 8 minutes of `world_next_event` polling.
- Every event has a corresponding `agent_invocations` row.
- `evaluator_score_world_scenario` returns ≥80%.

## Code Reviewer

### US-R1 — Clone and run from the README
*As the reviewer, I want to clone the repo and have a working smoke test in 5 commands.*

Accept when:
- `bun install && cp .env.example .env.local && bun run setup:mcp && bun run db:seed && bun run smoke:agent "hi"` succeeds.

### US-R2 — Find no secrets
*As the reviewer, I want grep to confirm no API keys, no real tokens.*

Accept when:
- `git grep -nE 'sbc_team_|EAA[A-Za-z0-9]{20,}|sk-ant-'` returns nothing.

### US-R3 — Read the architecture in <10 minutes
*As the reviewer, I want one diagram + 4 one-page docs that explain the system.*

Accept when:
- ARCHITECTURE.md (top-level), [02-architecture/SYSTEM.md](../02-architecture/SYSTEM.md), [TECH-STACK.md](../02-architecture/TECH-STACK.md), [AGENT-RUNTIME.md](../02-architecture/AGENT-RUNTIME.md), [WEBHOOKS.md](../02-architecture/WEBHOOKS.md) cover it.
