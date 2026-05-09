# MCP Primer — written for the team's junior engineers

If you're new to MCP, agents, or this codebase, **read this top to bottom** before touching `src/agent/`. It answers the three questions that come up over and over: *what is each MCP tool, who owns the data, and when do we read vs write?*

---

## 1. What MCP is, in plain English

**MCP (Model Context Protocol)** is a way to give an AI agent a **toolbox** of functions it can call. Think of it as "the agent's REST API." Each tool has a name, a description, an input schema, and an output. The agent decides when to call which tool based on the user's message.

There are two MCPs in this project. They're both wired into every `claude -p` invocation via `.mcp.json`:

| MCP | Transport | Hosted by | What it owns | How we connect |
|---|---|---|---|---|
| **`happycake`** | HTTP | Steppe Business Club (sandbox) | The simulated business: real catalog, kitchen capacity, marketing budget, simulated customers, world scenarios | We call `https://www.steppebusinessclub.com/api/mcp` with header `X-Team-Token: <our token>` |
| **`local`** | stdio | Us — runs as a child process | OUR state: conversation threads, drafted orders pending approval, escalation queue, daily reports, agent invocation audit log | Claude Code spawns `bun src/agent/mcp/local-server.ts` |

Both are addressed by Claude as `mcp__<server>__<tool>`. So `mcp__happycake__square_list_catalog` is the catalog tool on the sandbox; `mcp__local__list_products` is our cached mirror of it.

**You do not write MCP request bodies by hand.** You let the agent (`claude -p`) do that. We only declare the tools (in `local-server.ts`) and the role-scoped allowlist (in `invoke.ts`).

---

## 2. The 55 sandbox tools, organized by what each does

This list is the **source of truth** for what's possible. If you're stuck, the answer is almost certainly "there's an MCP tool for that." Tool names are verbatim from the live sandbox.

### `square_*` — POS, catalog, inventory, sales (7 tools)

The bakery's point-of-sale layer. Acts like Square in production.

| Tool | What it does | Read/Write? |
|---|---|---|
| `square_list_catalog` | Returns the 5 active products with id, price, margin %, capacity, lead time, custom flag | **Read** — source of truth for the menu |
| `square_get_inventory` | Returns inventory counts for given variation IDs | **Read** |
| `square_recent_orders` | Returns recent POS orders since an ISO timestamp | **Read** |
| `square_create_order` | Creates an order in the simulator. `source` can be `website`/`whatsapp`/`instagram`/`walk-in`/`agent`. Used after the customer confirms and the owner approves | **Write** — promotes our local draft to the canonical record |
| `square_update_order_status` | Moves an order through statuses: created → kitchen_pending → ready → completed → cancelled | **Write** |
| `square_get_pos_summary` | Per-team summary: order count, revenue, channel mix, kitchen-handoff readiness | **Read** — used by the owner bot for `/today` |
| `square_recent_sales_csv` | Returns the seeded 6-month sales CSV for marketing reasoning. **This is the canonical data source for our $500→$5,000 hypothesis.** | **Read** |

### `whatsapp_*` — WhatsApp simulator (4 tools)

The simulator pretends to be Meta's WhatsApp Cloud API. We can use these EVEN IF we don't have a real WA number set up.

| Tool | What it does | Read/Write? |
|---|---|---|
| `whatsapp_send` | Sends a text message to a customer phone (E.164) | **Write** — the agent uses this to reply on WA |
| `whatsapp_list_threads` | Lists recent WA threads our team has handled | **Read** |
| `whatsapp_register_webhook` | Tells the simulator to forward inbound WA events to a public URL we provide (our ngrok / cloudflare URL) | **Write — we call this once at setup** |
| `whatsapp_inject_inbound` | TEST-ONLY. Injects a fake inbound WA message. The evaluator uses this; so do we for our own dry-runs | **Write (test)** |

**How real customers reach us via WA:**
1. We call `whatsapp_register_webhook` once with our ngrok URL.
2. The simulator (or real WA) sends inbound messages to `POST /webhooks/whatsapp` on our server.
3. We parse → `IncomingMessage` → `onMessage` → `claude -p` → reply.
4. Reply goes back via `whatsapp_send` (sandbox) or the real Cloud API (production).

### `instagram_*` — Instagram simulator (8 tools)

Same idea as WhatsApp but with the IG-specific surface (DMs, comments, scheduled posts, owner approval gate).

| Tool | What it does | Read/Write? |
|---|---|---|
| `instagram_list_dm_threads` | Lists our IG DM threads | **Read** |
| `instagram_send_dm` | Sends a DM to a thread | **Write** |
| `instagram_reply_to_comment` | Replies to a comment under a post | **Write** |
| `instagram_schedule_post` | Queues a post for owner approval. Gets a `scheduledPostId` | **Write** — but doesn't publish |
| `instagram_approve_post` | Owner-side helper. Used by the team's Telegram bot when the owner taps "Approve" | **Write** |
| `instagram_publish_post` | Publishes a previously-approved post. Errors if not approved | **Write** |
| `instagram_register_webhook` | Forwards inbound IG events to our public URL | **Write — once at setup** |
| `instagram_inject_dm` | TEST-ONLY. Injects a fake inbound DM | **Write (test)** |

**Important:** `instagram_publish_post` will refuse to run if the post isn't owner-approved. The simulator enforces the approval gate server-side. So even if our marketing agent accidentally calls publish, it bounces back. Good guardrail.

### `gb_*` — Google Business Profile (5 tools)

Reviews, posts, metrics for our GMB profile. All simulated.

| Tool | What it does | Read/Write? |
|---|---|---|
| `gb_list_reviews` | Recent reviews | **Read** |
| `gb_simulate_reply` | Records a proposed reply to a review (doesn't actually post to Google) | **Write** |
| `gb_simulate_post` | Records a proposed weekly post | **Write** |
| `gb_get_metrics` | Views, calls, direction requests over `last_7_days` or `last_30_days` | **Read** |
| `gb_list_simulated_actions` | Inspects everything we've recorded in the GMB namespace (audit) | **Read** |

### `marketing_*` — the $500→$5,000 demand engine (10 tools)

This is where the **Business Analyst rubric (15 pts)** is won.

| Tool | What it does | Read/Write? |
|---|---|---|
| `marketing_get_budget` | Returns `monthlyBudgetUsd: 500`, `targetEffectUsd: 5000`. The constraint, in code | **Read** |
| `marketing_get_sales_history` | 6-month anonymized sales history. Use this to write the hypothesis | **Read** |
| `marketing_get_margin_by_product` | Margin % per SKU. Use this to allocate dollars where they earn most | **Read** |
| `marketing_create_campaign` | Records a campaign plan. Channel ∈ `instagram`/`google_local`/`whatsapp`/`website`/`mixed` | **Write** |
| `marketing_launch_simulated_campaign` | Launches a created campaign in the simulator. Records impressions/clicks/leads/orders | **Write** |
| `marketing_get_campaign_metrics` | Reads simulated metrics back | **Read** |
| `marketing_generate_leads` | Generates simulated leads from a campaign so we can route them | **Write** |
| `marketing_route_lead` | Records how an agent routed a lead to website / whatsapp / instagram / owner_approval | **Write** |
| `marketing_adjust_campaign` | Records an adjustment after reading metrics ("kill", "double down", "rotate creative") | **Write** |
| `marketing_report_to_owner` | Summary of plan + simulated results + lead routing + next actions, formatted for the owner | **Read (rendered)** |

The marketing agent's job is exactly: read budget + history + margin → create campaign → queue for owner approval → on approval, launch → measure → adjust. Each step is one of these tools.

### `kitchen_*` — production handoff (8 tools)

Capacity + production tickets. Owns whether we can promise a date/time.

| Tool | What it does | Read/Write? |
|---|---|---|
| `kitchen_get_capacity` | Daily capacity in minutes (420 default), default lead time (45 min), current load | **Read** — call before promising any date |
| `kitchen_get_menu_constraints` | Per-product prep time, lead time, capacity, custom flag | **Read** |
| `kitchen_create_ticket` | Creates a production ticket from an order. Required: orderId, customerName, items, optional pickup time | **Write** |
| `kitchen_list_tickets` | Lists our tickets, optionally filtered by status | **Read** |
| `kitchen_accept_ticket` | Accepts a queued ticket if capacity allows | **Write** |
| `kitchen_reject_ticket` | Rejects with a reason (lead time / capacity / inventory) | **Write** |
| `kitchen_mark_ready` | Flags a ticket ready for pickup. Triggers customer notification | **Write** |
| `kitchen_get_production_summary` | Counts, capacity use, rejections, readiness — for evaluator + owner | **Read** |

### `world_*` — time-compressed business day (7 tools)

The evaluator drives a deterministic scenario at us. We can do the same to ourselves to dry-run.

| Tool | What it does | Read/Write? |
|---|---|---|
| `world_get_scenarios` | Lists available scenarios: `launch-day-revenue-engine`, `weekend-capacity-crunch` | **Read** |
| `world_start_scenario` | Starts a scenario for our team. Resets the timeline | **Write** |
| `world_next_event` | Returns the next deterministic event in the timeline (a customer DM, a new review, a kitchen ping…) | **Read (consumes)** |
| `world_inject_event` | Inject a custom event for testing | **Write (test)** |
| `world_advance_time` | Advances clock by N sim minutes; returns the events that came due | **Write** |
| `world_get_timeline` | Reads the full per-team timeline (debug) | **Read** |
| `world_get_scenario_summary` | Progress summary: events delivered, channel mix, current minute, remaining | **Read** |

### `evaluator_*` — preview your own score (6 tools)

This is the **secret weapon**. We can pre-grade ourselves before submission.

| Tool | What it does | Read/Write? |
|---|---|---|
| `evaluator_get_evidence_summary` | What evidence the judges will see across world / marketing / square / kitchen / channels / mcp_audit | **Read** |
| `evaluator_score_marketing_loop` | Score the $500→$5,000 loop using simulator evidence | **Read** |
| `evaluator_score_pos_kitchen_flow` | Score the order → kitchen handoff flow | **Read** |
| `evaluator_score_channel_response` | Score WA/IG/GBP response quality | **Read** |
| `evaluator_score_world_scenario` | Score deterministic scenario execution + MCP audit hygiene | **Read** |
| `evaluator_generate_team_report` | Combined team evidence report (we pass repoUrl, websiteUrl, notes) | **Read (rendered)** |

We run `bun run evidence` to invoke these and print a markdown summary. **Run this 3-4 times during the day**, after each big change, to see what moved.

---

## 3. The local MCP — what it adds, and why

The sandbox MCP doesn't know about state we own. Specifically:

- **Conversation threads.** When a customer sends 5 WA messages, we need to feed all 5 back to the agent so it has context. The sandbox has no concept of "our conversation history with this customer." We store it in `threads` (SQLite).
- **Drafts before owner approval.** When the agent wants to create an order, we don't push to Square POS yet — the owner must approve. So we store a *draft* locally; on approval, we then call `square_create_order`. The local DB is the only place draft orders live.
- **Escalation queue.** Customer says "I have a complaint" → agent calls `escalate_to_owner` → row in our `escalations` table → notification fires to the owner Telegram bot. The sandbox has no escalation concept.
- **Daily report rendered from our data.** `dailyReport()` reads our `orders` and `escalations` and produces "5 orders today, $230 revenue, 1 pending approval, 0 open complaints" for the owner's Telegram. The sandbox renders different things (POS summary, marketing report) — they're complementary.
- **Agent invocation audit.** Every `claude -p` call writes to `agent_invocations` (id, role, duration, cost, exit, error). This is for **us** to debug, not for the eval.

The local MCP exposes 11 tools that read/write this local state:

`list_products`, `check_constraints`, `create_draft_order`, `get_order_status`, `escalate_to_owner`, `list_orders`, `list_escalations`, `approve_order`, `reject_order`, `daily_report`, `queue_owner_approval`, `notify_customer`.

**Why does it run as a separate process?** MCP's stdio transport requires a child process. Claude Code spawns `bun src/agent/mcp/local-server.ts`, sends JSON-RPC requests over stdin, reads responses on stdout. The child process opens our SQLite, registers tools, sleeps until called. Cheap (~30ms startup).

---

## 4. Source of truth — when to read which

This is the rule that prevents us from getting confused:

| Data | Source of truth | Why |
|---|---|---|
| Catalog (products, prices, margins, capacity) | **Sandbox** (`square_list_catalog`) | They own the menu. Prices change in the simulator independently. |
| Inventory counts | **Sandbox** (`square_get_inventory`) | Same — it's the simulator's state |
| Real-time kitchen capacity | **Sandbox** (`kitchen_get_capacity`) | They simulate cumulative load across all teams |
| Sales history (the 6-month CSV) | **Sandbox** (`square_recent_sales_csv`) | Seeded fixture |
| Confirmed orders (post owner-approval) | **Sandbox** (`square_*` after `square_create_order`) | The eval looks at sandbox POS summary |
| Marketing campaigns + metrics | **Sandbox** (`marketing_*`) | Simulator runs the ad mechanics |
| Drafted orders (pre-approval) | **Local SQLite** (`orders` table where status=`draft`) | Sandbox doesn't model drafts |
| Conversation threads + history | **Local SQLite** (`threads`) | Sandbox doesn't model multi-turn context |
| Escalation queue | **Local SQLite** (`escalations`) | Owner-side concept; sandbox doesn't model it |
| Agent invocation log | **Local SQLite** (`agent_invocations`) | Our debugging |
| World scenario state | **Sandbox** (`world_*`) | They drive it |

**What we DON'T mirror:** we never copy Square catalog into local SQLite at runtime. We seed `data/catalog/happycake.seed.json` once for the **website to render** when the sandbox is unreachable, but the agent always asks the sandbox.

(If we ever need to mirror — e.g., for offline mode — we'd add a sync job. We don't, because the sandbox is fast and we always have network during the hackathon.)

---

## 5. Read on-demand vs. polling — answering the "every 10 minutes" question

We do **NOT** poll the sandbox on a schedule. There is no 10-minute job. Here's the actual model:

| Surface | Pattern | Why |
|---|---|---|
| Customer message arrives (WA / IG webhook) | **Push** — the simulator sends to our `/webhooks/*` URL when it has an event | Webhooks are real-time; polling would add latency for no benefit |
| Customer message arrives (Telegram) | **Long-poll** — we hold a 25-second `getUpdates` request open; the moment a message arrives, the response returns | Telegram doesn't push (no webhook unless we set one up). Long-poll is functionally equivalent — ~0 latency, low overhead |
| Catalog / inventory / capacity | **On-demand** — agent calls `square_list_catalog` etc. only when needed | Cheaper; always fresh; no stale-cache bugs |
| Marketing campaign metrics | **On-demand** — when the marketing agent asks "how's it doing?" | Same |
| World scenario events | **Pull on cue** — when we run `bun run world:start`, we read `world_next_event` once per tick; otherwise nothing pulls | The agent processes events in batches when we trigger a run |

So why was "every 10 minutes" floating around? The earlier `docs/_archive/PLAN.md` (annotated stale) proposed BullMQ workers polling for stale state. We don't need them. **Pull on demand is correct for our shape.**

The only background loop in our system today is the Telegram long-poll (25s timeout, immediate return on event). That's not "polling for state"; that's "waiting for an event."

---

## 6. Reconciliation — what happens when our local view drifts from sandbox

Because we don't mirror, there's nothing to reconcile *for shared data*. Mirror = drift; no mirror = no drift.

For things we **own** that we then **promote** to the sandbox (drafts → confirmed orders), the rule is:

1. Customer agrees → we write a row in our `orders` table with status=`draft`.
2. Owner approves via Telegram inline keyboard → our handler calls **two things**:
   a. Local: `update_order_status(id, 'approved')`
   b. Sandbox: `square_create_order(...)` then `kitchen_create_ticket(...)`
3. Both writes succeed → mark our row with the returned `square_order_id` and `kitchen_ticket_id`.
4. If the sandbox call fails → we DO NOT mark approved locally. Status stays `draft` and we re-notify the owner. (This avoids "approved locally, never made it to the kitchen" silent failure.)

In code, this is one transaction in `src/bots/owner.ts` (TODO). Pseudo:

```typescript
async function approveDraft(orderId: string, approvedBy: string) {
  const draft = getOrder(orderId)
  if (!draft || draft.status !== 'draft') throw new Error('not a draft')

  // Try sandbox first — failure here means we don't update local
  const square = await callSandbox('square_create_order', { items: draft.items, source: draft.channel })
  const ticket = await callSandbox('kitchen_create_ticket', { orderId: square.id, customerName: draft.customer_name, items: draft.items })

  // Both sandbox writes succeeded — now record locally
  updateOrder(orderId, { status: 'approved', square_order_id: square.id, kitchen_ticket_id: ticket.id })
  // Notify customer
  await notifyCustomer(draft.thread_id, `Confirmed! Pickup at ${draft.scheduled_at}.`)
}
```

The "callSandbox" helper here will be wrapped via the agent — we ask `claude -p` in `kitchen` role to do the work. (Or we can do it via an HTTP MCP client directly when we don't need agent reasoning.)

---

## 7. How the tools become accessible to a `claude -p` invocation

Concretely, this is the chain when a customer message arrives:

1. **Webhook hits the server.** WA/IG payload → parsed → `IncomingMessage`.
2. **Server picks a role.** `src/agent/router.ts` returns `concierge` / `kitchen` / `marketing` / `owner`.
3. **Server spawns `claude -p`** with these flags (see `src/agent/invoke.ts`):
   - `--mcp-config .mcp.json` — points at the rendered file with both servers
   - `--allowedTools mcp__happycake__square_list_catalog mcp__local__list_products ...` — the role-scoped subset
   - `--disallowedTools Bash Edit Write Read ...` — keeps the agent away from the filesystem
   - `--append-system-prompt <role prompt>` — concierge.md, kitchen.md, etc.
   - `--output-format stream-json --verbose` — so we can capture each tool call event
   - `--model claude-opus-4-7` — the only allowed model
4. **Claude Code starts up** (~1s). Reads `.mcp.json`, opens an HTTP connection to the sandbox, spawns `bun src/agent/mcp/local-server.ts` over stdio. Both MCPs are now ready.
5. **Claude reasons.** It reads the system prompt + user message, decides if it needs a tool. If so, it sends a tool-use block, the MCP returns a tool-result block, and Claude continues.
6. **`stream-json` events flow on stdout.** Our wrapper parses each line:
   - `{type: 'assistant', message: {content: [{type: 'tool_use', name: 'mcp__local__list_products', input: {...}}]}}` → we record the tool call
   - `{type: 'result', result: '<final reply>', total_cost_usd: 0.40, ...}` → we capture the reply + cost
7. **Wrapper persists the run** to `agent_invocations` in SQLite. Returns `{reply, tool_calls, duration_ms, cost_usd, exit_code}` to `onMessage`.
8. **Channel adapter sends the reply** back to the customer. The whole round trip is ~10–15 seconds for a single tool call.

---

## 8. Wrapping anything as an "agent tool"

You'd think we'd need to "register" each sandbox tool somewhere. We don't. Here's why:

- The sandbox MCP advertises its tool list automatically when Claude Code connects. Claude reads the schemas from the MCP itself (the `tools/list` JSON-RPC method).
- All we do is **decide which tools each role is allowed to call** via `--allowedTools`. That's `ROLE_TOOL_ALLOWLIST` in `src/agent/invoke.ts:41`.

If you want to add a NEW capability, two scenarios:

**Sandbox already has a tool we want to use.** Just add the tool name to the role's allowlist. Done. Example: kitchen role doesn't currently allow `square_get_pos_summary`; if we want it to, add `'mcp__happycake__square_get_pos_summary'` to the kitchen array.

**We want a NEW tool the sandbox doesn't have** (e.g., "render a daily report from our local data"). Add it to the local MCP:
1. Write the function in `src/domain/tools.ts` (pure logic, no MCP awareness).
2. Register it in `src/agent/mcp/local-server.ts` with `server.registerTool(...)`.
3. Add `'mcp__local__<name>'` to whichever role(s) need it in `invoke.ts`.

That's the entire "wrapping" story. No frameworks, no decorators.

---

## 9. Cost — where the numbers come from

When we run `bun run smoke:agent "..."`, we see lines like `cost: $0.40`. That number comes from `claude -p --output-format stream-json` itself. Specifically, the final event:

```json
{"type":"result","result":"Yes — honey cake is...","total_cost_usd":0.40098575,"num_turns":3, ...}
```

Claude Code computes this by tracking input/output tokens against the user's Claude Max plan and reporting the equivalent USD. It's not from MCP, not from us. We just parse it out and store it in `agent_invocations.cost_usd` so we can audit total spend.

Every `claude -p` we run during the hackathon is **billed against Adilet's Claude Max** (no API credits). Budget for a 24h sprint: assume ~$30-60 of compute if we run `world_start` + scenarios + evidence checks several times.

---

## 10. Practical "I want to..." cheatsheet

| Task | Do this |
|---|---|
| See what tools the sandbox is exposing right now | `claude mcp list` from repo root |
| Verify our local MCP starts cleanly | `bun run mcp:local` then ctrl-C — should print no errors |
| Smoke a customer message | `bun run smoke:agent "your message"` |
| Preview what judges will see | `bun run evidence` |
| Drive a time-compressed business day | `bun run world:start launch-day-revenue-engine` |
| Add a new local tool | edit `src/domain/tools.ts` + `src/agent/mcp/local-server.ts` + role allowlist in `src/agent/invoke.ts` |
| Allow an existing sandbox tool to a role | add the `mcp__happycake__<tool>` string to that role in `src/agent/invoke.ts` |
| Re-render `.mcp.json` after editing the template | `bun run setup:mcp` |
| Reset all local state | `rm .data/happycake.db && bun run db:seed` |
| See the most recent agent runs | `sqlite3 .data/happycake.db "SELECT * FROM agent_invocations ORDER BY created_at DESC LIMIT 10"` |
