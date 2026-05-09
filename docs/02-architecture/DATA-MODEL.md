# Data Model — what we store, what we don't, and why

Companion to [MCP-PRIMER.md](./MCP-PRIMER.md). That doc explains how the agent talks to the world; this one explains what tables we keep locally and why.

---

## TL;DR — the rule

> **We store only what we OWN.** Anything the sandbox owns — catalog, inventory, kitchen capacity, marketing campaigns, real-time POS — we read on demand.

Our SQLite is small on purpose. Six tables. No triggers, no migrations, no ORM.

---

## SQLite, not Postgres — confirmed

We chose SQLite (via `bun:sqlite`) because:

- **Zero infra.** No Docker, no Postgres role grants, no connection pooling. The DB is one file at `.data/happycake.db`.
- **Bun ships with it.** Native binding, faster than any pg client.
- **Our scale doesn't matter.** Hackathon: ~hundreds of orders + thousands of agent runs. SQLite handles 10k writes/sec on a laptop; we'll do <1/sec.
- **Backup is `cp .data/happycake.db backup.db`.** That's it.

Postgres becomes worth it when (a) we need concurrent writes from multiple processes, (b) we go multi-tenant, or (c) we want analytics SQL. None of that applies here.

---

## The six tables

### `products`

Mirror of `square_list_catalog`. Used by the **website** for fast renders without hitting the sandbox on every page load. The agent always reads the sandbox directly, so this is a UX optimization, not a source of truth.

```sql
CREATE TABLE products (
  id              TEXT PRIMARY KEY,           -- honey-cake-slice
  name            TEXT NOT NULL,              -- "Honey Cake (slice)"
  category        TEXT NOT NULL,              -- slices | whole-cakes | catering | custom
  price_cents     INTEGER NOT NULL,
  lead_time_hours INTEGER NOT NULL,
  allergens       TEXT,                       -- "eggs,dairy,gluten,nuts"
  description     TEXT,
  photo_url       TEXT,
  in_stock        INTEGER NOT NULL DEFAULT 1,
  daily_capacity  INTEGER,
  remote_id       TEXT,                       -- mirror of sandbox id, if needed
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
```

**Seed once via `bun run db:seed`** from `data/catalog/happycake.seed.json`. **Re-sync** by re-running the seed command after editing the JSON. (For the hackathon we're not auto-syncing from sandbox — the JSON is committed and matches what the sandbox returns.)

### `threads`

Per-(channel, threadId) conversation state. The local MCP `list_orders`/`get_order_status`/etc. don't need this; the **agent prompt** uses it.

```sql
CREATE TABLE threads (
  thread_id    TEXT PRIMARY KEY,    -- e.g. "+12815551234" for WA, "ig_<scoped_id>" for IG
  channel      TEXT NOT NULL,       -- whatsapp | instagram | web | telegram
  sender_id    TEXT,
  sender_name  TEXT,
  history_json TEXT NOT NULL,       -- JSON array of {role, content, ts}
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

Why JSON-blob for history? Because we never query *into* it — we always load the whole array, trim to last N turns, and feed to the next `claude -p` invocation. Indexing individual messages buys nothing.

### `orders`

The **only place draft orders exist** until owner approval. After approval, they're mirrored to Square (we keep the local row for our own records).

```sql
CREATE TABLE orders (
  id                 TEXT PRIMARY KEY,                                -- ord_1700000000_abc123
  thread_id          TEXT NOT NULL,                                   -- which conversation produced it
  channel            TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN
                     ('draft','approved','rejected','in_kitchen','ready','picked_up','cancelled')),
  customer_name      TEXT,
  customer_phone     TEXT,
  items_json         TEXT NOT NULL,                                   -- [{sku, qty, unit_cents, line_total_cents, name}]
  total_cents        INTEGER NOT NULL,
  scheduled_at       TEXT,                                            -- ISO 8601
  pickup_or_delivery TEXT NOT NULL DEFAULT 'pickup',
  notes              TEXT,
  square_order_id    TEXT,                                            -- set after square_create_order succeeds
  kitchen_ticket_id  TEXT,                                            -- set after kitchen_create_ticket succeeds
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
```

**Lifecycle:**
1. Customer says "yes confirm" → concierge agent calls `create_draft_order` (local) → row written, status=`draft`.
2. Owner approves in Telegram → `approve_order` flips status → next, the kitchen agent calls `square_create_order` + `kitchen_create_ticket` (sandbox) → we update `square_order_id`, `kitchen_ticket_id` and status=`approved`/`in_kitchen`.
3. Kitchen marks ready (sandbox `kitchen_mark_ready`) → an event flow we listen to → status=`ready`, customer notified.
4. Customer picks up → status=`picked_up` (manual or via owner).

### `escalations`

Owner queue. The agent's only "panic button."

```sql
CREATE TABLE escalations (
  id           TEXT PRIMARY KEY,           -- esc_1700000000_xyz
  thread_id    TEXT NOT NULL,
  channel      TEXT NOT NULL,
  reason       TEXT NOT NULL,              -- short reason code: complaint | allergen_critical | custom_review | refund | unknown
  severity     TEXT NOT NULL DEFAULT 'low', -- low | medium | high
  context_json TEXT,                        -- arbitrary JSON the agent attaches
  status       TEXT NOT NULL DEFAULT 'open',
  resolution   TEXT,
  created_at   INTEGER NOT NULL,
  resolved_at  INTEGER
);
```

When `escalate_to_owner` runs, we INSERT a row AND fire a Telegram notification to the owner bot. The row is the audit trail; the Telegram message is the action surface.

### `leads` and `campaigns` — for the marketing loop

```sql
CREATE TABLE leads (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL,         -- meta_ad | google_ad | organic | gbp | wa_referral
  source_ref  TEXT,                   -- ad campaign id, or post URL
  campaign_id TEXT,
  thread_id   TEXT,                   -- once they DM us
  contact     TEXT,                   -- phone, IG handle, email
  status      TEXT NOT NULL DEFAULT 'new',  -- new | contacted | converted | lost
  meta_json   TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE campaigns (
  id           TEXT PRIMARY KEY,
  channel      TEXT NOT NULL,         -- meta | google | boost | organic
  budget_cents INTEGER NOT NULL,
  hypothesis   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  remote_id    TEXT,                  -- sandbox campaign id once launched
  metrics_json TEXT,                  -- snapshot of last metrics pull
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

These are **complementary** to sandbox `marketing_*` — the sandbox runs the simulator math; we keep our notes (the hypothesis text, our routing rules, our snapshot of the last metrics we saw).

### `agent_invocations` — the audit log

```sql
CREATE TABLE agent_invocations (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL,
  thread_id       TEXT,
  prompt_chars    INTEGER,
  response_chars  INTEGER,
  duration_ms     INTEGER,
  cost_usd        REAL,
  exit_code       INTEGER,
  error           TEXT,
  created_at      INTEGER NOT NULL
);
```

Every `claude -p` call writes one row. Used for: total spend tracking, "why did this user wait 30 seconds?" debugging, and the **MCP audit hygiene** rubric line in `evaluator_score_world_scenario`.

To inspect: `sqlite3 .data/happycake.db "SELECT role, duration_ms, cost_usd FROM agent_invocations ORDER BY created_at DESC LIMIT 20"`.

---

## What's NOT in the schema (and why)

**No `customers` table.** Customers are identified by `(channel, threadId)`. We don't unify across channels in this hackathon — the same person on WA and IG is two threads. Could add later.

**No `products_view_log`.** Vanity metric, not actionable for the rubric.

**No `messages` table.** History is stored as a JSON blob in `threads.history_json`. Saves a join on every conversation turn.

**No `kitchen_tickets`.** That's the sandbox's table; we just keep `kitchen_ticket_id` on `orders` to cross-reference.

**No `marketing_metrics_snapshot` per-day.** We pull live each time. If we want history, we serialize to `campaigns.metrics_json`.

---

## Pub/sub / events — when (if) we add it

Right now, "pub/sub" is just direct function calls — `escalate_to_owner` writes a row + sends a Telegram message in the same handler. Synchronous, simple.

If we add Redis later, it'd be for:

- **Decoupling** — escalation handler doesn't block on the Telegram send retry
- **Multi-replica** — multiple server instances need a queue not a function call
- **Scheduled jobs** — daily digest at 8 AM

None of those apply for the 24h sprint. **Decision: defer to post-MVP.** The cost of adding Redis (host, lib, deploy config) > the value over 24h.

If we DO add it on day 2, it's a tiny refactor: replace the direct call in `escalate()` with a Redis Pub/Sub publish, subscribe in a worker process. The schema doesn't change.

---

## Reconciliation — handling sandbox writes that fail

Hot path that matters:

```
Owner taps "Approve" in TG
   ↓
1. our handler reads draft row from local
2. calls sandbox: square_create_order (might fail)
3. calls sandbox: kitchen_create_ticket (might fail)
4. on success: update local row → status=approved, store sandbox ids
5. on failure: re-notify owner, leave local status=draft
```

Why this order? Because if step 2/3 fails AFTER we've updated local, we'd have an "approved" order that the kitchen never saw. The customer would think they're getting a cake. By updating local LAST, we're idempotent: the owner can re-tap Approve and it tries again.

If we want belt-and-suspenders, we add an `approval_attempts` count + a `last_error` field. The current schema covers it via `notes` if needed.

---

## Migrations — when to add a column

For hackathon-scale: **just edit `schema.sql` and recreate the DB.** `rm .data/happycake.db && bun run db:seed`. Fastest iteration.

For post-hackathon: switch to a migration tool (e.g., [`@better-sqlite3/migrator`](https://github.com/...) or `drizzle-kit`). Not now.

---

## Source of truth — restating the rule with examples

| When you need... | Read from... | Why |
|---|---|---|
| The current price of "Honey Cake (slice)" | `square_list_catalog` | The simulator is the price oracle |
| "Are we full on Saturday?" | `kitchen_get_capacity` | Real-time across all our pending tickets |
| "What did we sell yesterday?" | `square_recent_orders` or `square_get_pos_summary` | POS is the truth |
| "What's our $500 budget split look like?" | `marketing_get_budget` + `marketing_get_campaign_metrics` | Sandbox runs the ad math |
| "Has the customer agreed to terms?" | local `threads.history_json` | We track conversation context, not Square |
| "What pending approvals does the owner have?" | local `orders WHERE status='draft'` | Drafts only exist locally |
| "What complaints are open?" | local `escalations WHERE status='open'` | Owner concept, not in sandbox |
| "How much have we spent on agent compute?" | local `SUM(cost_usd) FROM agent_invocations` | Our concern, not anyone else's |

**If you ever feel tempted to mirror sandbox data into a local table, stop and ask:** can I just call the tool when I need it? The answer is almost always yes.
