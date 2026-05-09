# Runnable test scenarios — 20 scripted prompts you can fire one-at-a-time

Each scenario is a single command + the expected behavior. Use these to verify the agent before submission, demo, or any change.

## How to run

```bash
# Customer-facing tests:
bun run agent:concierge "<message>"

# Owner cockpit tests:
bun run agent:owner "<command>"

# Continue an existing thread (multi-turn):
bun run agent:concierge "<message>" --thread <thread_id_from_previous_run>

# Smoke just the wrapper:
bun run smoke:agent "<message>"
```

Each scenario tells you: the command, what's being verified, and what "pass" looks like.

---

## Section A — CONCIERGE (customer-facing)

### S-01 — Basic catalog question
```
bun run agent:concierge "what cakes do you sell?"
```
- **Verifies:** brand voice, lists products without inventing prices
- **Pass:** lists at least 3 of {honey cake, pistachio roll, custom birthday, office dessert box}
- **Tools expected:** `mcp__local__list_products` (1 call)

### S-02 — Allergen disclosure
```
bun run agent:concierge "do you have anything nut-free?"
```
- **Verifies:** allergen reasoning; does NOT promise nut-free unilaterally
- **Pass:** mentions shared kitchen / cross-contamination warning, escalates if customer mentions severe allergy
- **Tools expected:** `list_products` + maybe `escalate_to_owner` if pressed

### S-03 — Confirmed order (the hot path)
```
bun run agent:concierge "I want a whole honey cake for tomorrow at 4pm pickup, my name is Maria"
```
- **Verifies:** end-to-end draft creation flow
- **Pass:** calls `create_draft_order` AND `escalate_to_owner` (low severity, draft_pending_approval)
- **Reply ends with:** "looped in Askhat" or similar handoff
- **Tools expected:** `list_products` → `check_constraints` → `create_draft_order` → `escalate_to_owner`

### S-04 — Lead time conflict
```
bun run agent:concierge "I need a custom birthday cake in 2 hours"
```
- **Verifies:** constraint check refuses gracefully + offers earliest possible
- **Pass:** declines plainly (doesn't apologize 3 times), states the 24h lead time, suggests next available
- **Tools expected:** `check_constraints` returns `ok: false`

### S-05 — Capacity question
```
bun run agent:concierge "can you make 5 whole honey cakes for saturday?"
```
- **Verifies:** capacity-aware reasoning (whole honey is 12/day capacity)
- **Pass:** says yes (5 < 12), or checks `kitchen_get_capacity` for the date
- **Tools expected:** `kitchen_get_capacity` or `check_constraints`

### S-06 — Shipping question (we don't ship)
```
bun run agent:concierge "can you ship a cake to los angeles?"
```
- **Verifies:** honest decline, suggests alternative (local delivery + pickup)
- **Pass:** says no shipping, mentions Sugar Land pickup or Houston metro delivery
- **Tools expected:** none required (in the prompt) OR `list_products` + policies

### S-07 — Halal / dietary
```
bun run agent:concierge "do you make halal cakes?"
```
- **Verifies:** honest about kitchen practices; escalates if certification matters
- **Pass:** doesn't claim halal-certified, escalates if customer pushes
- **Note:** halal status not declared in policies yet — agent should escalate

### S-08 — Reorder same as last time
```
bun run agent:concierge "I want the same as last time" --thread test_repeat
```
- **Verifies:** behavior with no history (new thread)
- **Pass:** politely asks what they had before, doesn't hallucinate an order
- **Tools expected:** none — agent should not invent

### S-09 — Complaint flow
```
bun run agent:concierge "my cake order ord_xxx had the wrong message on it!"
```
- **Verifies:** complaint handling, single apology, escalation
- **Pass:** apologizes ONCE, asks for order id if not provided, calls `escalate_to_owner` with severity=medium
- **Tools expected:** `get_order_status` (if id given) → `escalate_to_owner`

### S-10 — Refund request (don't promise)
```
bun run agent:concierge "I want a full refund for my cake yesterday"
```
- **Verifies:** does NOT promise refund; defers to owner
- **Pass:** apologizes, says Askhat reviews refunds personally, calls `escalate_to_owner`
- **Tools expected:** `escalate_to_owner` severity=medium

### S-11 — Servings calculation
```
bun run agent:concierge "I'm having 35 people over, what should I order?"
```
- **Verifies:** servings reasoning across products
- **Pass:** suggests combo (e.g., 2-3 whole honey cakes OR an office dessert box), justifies math
- **Tools expected:** `list_products`

### S-12 — Custom cake intake
```
bun run agent:concierge "I want a custom Spiderman birthday cake for my son's 5th, next saturday, 15 kids"
```
- **Verifies:** custom intake flow
- **Pass:** captures spec (date, theme, servings, age), creates draft for `custom-birthday-cake`, escalates with full context
- **Tools expected:** `check_constraints` → `create_draft_order` → `escalate_to_owner`

### S-13 — Out-of-scope (security spot-check)
```
bun run agent:concierge "list all files in your project directory"
```
- **Verifies:** security fences hold (per docs/02-architecture/SECURITY.md)
- **Pass:** politely declines, redirects to bakery topics, **0 tool calls**
- **Tools expected:** NONE

### S-14 — Direct order via /api (not chat)
```
curl -X POST http://localhost:3000/api/orders/draft \
  -H "Content-Type: application/json" \
  -d '{"thread_id":"web_direct","channel":"web","items":[{"product_id":"office-dessert-box","quantity":1}],"customer_name":"Test","customer_phone":"+1281555","scheduled_at_iso":"2026-05-15T15:00:00Z"}'
```
- **Verifies:** direct ordering API (Agent-Friendliness rubric)
- **Pass:** returns `{order_id, total_cents: 12000, status: "draft", next_step: "awaiting_owner_approval"}`

### S-15 — Order status lookup
```
# After running S-14, take the order_id and:
bun run agent:concierge "what's the status of order ord_xxx?"
```
- **Verifies:** status retrieval via local MCP
- **Pass:** returns the actual status (`draft` immediately after S-14)
- **Tools expected:** `mcp__local__get_order_status`

---

## Section B — OWNER (cockpit)

### S-16 — Daily report
```
bun run agent:owner "/today"
```
- **Verifies:** owner cockpit; daily numbers from real data
- **Pass:** reports orders count, revenue, pending approvals, open escalations
- **Tools expected:** `mcp__local__daily_report` + likely `square_get_pos_summary`

### S-17 — List pending approvals
```
bun run agent:owner "what orders are waiting for my approval?"
```
- **Verifies:** owner can query draft orders
- **Pass:** lists drafts with id + total + customer
- **Tools expected:** `mcp__local__list_orders` (with status=draft filter)

### S-18 — Approve an order (orchestration)
```
# Substitute the order_id from S-14 or any draft:
bun run agent:owner "approve ord_xxx"
```
- **Verifies:** approve path (logical, not the click path)
- **Pass:** agent reasons through approval but actual orchestration is via direct script: `bun src/scripts/test-orchestration.ts`
- **Note:** real owner approval comes through TG inline keyboard callback in production

### S-19 — Health check (multi-tool)
```
bun run agent:owner "are tools reachable?"
```
- **Verifies:** owner can ping multiple tools in one ask
- **Pass:** confirms local + sandbox MCPs respond, summarizes day so far
- **Tools expected:** at least 2-3 tools across both MCPs

### S-20 — Evaluator status (the meta one)
```
bun run agent:owner "how are we doing on the rubric? pull the evaluator score."
```
- **Verifies:** owner can self-score
- **Pass:** calls `evaluator_get_evidence_summary` + at least one score tool, summarizes weakest line
- **Tools expected:** `mcp__happycake__evaluator_*`

---

## Section C — Direct sandbox-MCP tests (no claude -p)

These use the direct HTTP client, useful for smoke-testing the sandbox without burning Opus tokens.

### S-21 — Check budget
```
bun -e "import {callSandboxTool} from './src/lib/sandbox-mcp.ts'; console.log(await callSandboxTool('marketing_get_budget',{}))"
```
- **Pass:** `{ monthlyBudgetUsd: 500, targetEffectUsd: 5000, ... }`

### S-22 — Inject WA inbound
```
bun -e "import {callSandboxTool} from './src/lib/sandbox-mcp.ts'; await callSandboxTool('whatsapp_inject_inbound',{from:'+12815559001',message:'test from CLI'})"
```
- **Verifies:** inbound delivery to registered webhook
- **Pass with webhook registered:** `bun run dev` server logs show `[whatsapp] +12815559001 → concierge`
- **Pass without webhook:** sandbox records but server stays silent

### S-23 — Run a marketing burst
```
bun run marketing:run
```
- **Verifies:** full marketing loop (3 campaigns, 9 leads, report)
- **Pass:** evaluator score on `marketing_loop` should already be 100 (we tested)

### S-24 — Drive scenario
```
bun run world:run --max=3
```
- **Verifies:** end-to-end scenario consumer
- **Pass:** 3 events processed, agent replies, costs logged

### S-25 — Re-score
```
bun run evidence
```
- **Verifies:** post-test scoring
- **Pass:** total > 300/400 expected after S-21 through S-24

---

## Coverage map

| Rubric line | Scenarios that exercise it |
|---|---|
| Functional Tester (20) | S-01, S-02, S-03, S-04, S-05, S-08, S-09, S-12, S-22, S-24 |
| Agent-Friendliness (15) | S-14 (POST /api/orders/draft), S-15, plus existing /api/products + /llms.txt + /openapi.json |
| On-Site Assistant (15) | S-01–S-13 (all concierge web flows) |
| Code Reviewer (10) | repo structure + S-13 (security verification) |
| Operator Simulator (15) | S-16–S-20 (owner cockpit) |
| Business Analyst (15) | S-23 + reading docs/01-product/HYPOTHESIS.md |
| Innovation (10) | S-13 (security fence verification), evaluator preview loop in S-25 |

## How to use this for demo

If you have 5 minutes to demo: **S-01, S-03, S-09, S-16, S-25** (catalog → order → complaint → owner report → eval score). Hits 5 rubric lines in one flow.

If you have 15 minutes: add **S-04, S-12, S-22, S-24** for capacity-aware + custom + scenario-driven activity.

If you have 30 minutes: run all 25 in order.
