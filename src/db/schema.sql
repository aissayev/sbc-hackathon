-- Happy Cake US — local SQLite schema.
-- Source of truth for our own state (threads, drafted orders, escalations).
-- The sandbox MCP is the source of truth for: sales history, real catalog,
-- kitchen capacity, ad campaigns. We mirror just enough locally to render
-- the website and keep conversation history.

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,
  -- minimum advance time, in hours
  lead_time_hours INTEGER NOT NULL DEFAULT 24,
  -- comma-separated list: eggs, dairy, gluten, nuts, soy
  allergens     TEXT,
  description   TEXT,
  photo_url     TEXT,
  in_stock      INTEGER NOT NULL DEFAULT 1,
  -- daily kitchen capacity for this SKU; null = unlimited
  daily_capacity INTEGER,
  -- mirrored from sandbox `square_get_catalog` when available
  remote_id     TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  thread_id   TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,
  sender_id   TEXT,
  sender_name TEXT,
  -- JSON array of {role, content, ts}
  history_json TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL,
  channel       TEXT NOT NULL,
  -- State machine:
  --   draft → approved → in_kitchen → ready → out_for_delivery? → picked_up | completed
  --                  ↘ rejected
  --                  ↘ cancelled
  -- `out_for_delivery` is only used for delivery orders; pickup goes
  -- ready → picked_up. `completed` is the terminal "done" status used by
  -- both delivery and pickup once the customer has the cake.
  status        TEXT NOT NULL CHECK (status IN ('draft','approved','rejected','in_kitchen','ready','out_for_delivery','picked_up','completed','cancelled')),
  customer_name TEXT,
  customer_phone TEXT,
  -- JSON array of {sku, qty, unit_cents, line_total_cents, modifiers}
  items_json    TEXT NOT NULL,
  total_cents   INTEGER NOT NULL,
  scheduled_at  TEXT,
  pickup_or_delivery TEXT NOT NULL DEFAULT 'pickup',
  notes         TEXT,
  -- Square POS link if synced
  square_order_id TEXT,
  -- Kitchen MCP ticket link if synced
  kitchen_ticket_id TEXT,
  -- Attribution tag from a `?ref=<token>` query param. Lets the owner answer
  -- "where did this customer come from" without bolting on a real analytics
  -- pipeline. Token is whatever the campaign URL set — usually a short slug
  -- like `ig`, `gbp`, `email-2026-05`, or a partner code. NULL = direct.
  referral_source TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_thread ON orders(thread_id);
CREATE INDEX IF NOT EXISTS idx_orders_referral ON orders(referral_source);

CREATE TABLE IF NOT EXISTS escalations (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  channel     TEXT NOT NULL,
  reason      TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'low',
  context_json TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution  TEXT,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  source_ref  TEXT,
  campaign_id TEXT,
  thread_id   TEXT,
  contact     TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  meta_json   TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,
  budget_cents INTEGER NOT NULL,
  hypothesis  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','approved','running','paused','closed')),
  -- Square sandbox MCP campaign id once launched
  remote_id   TEXT,
  metrics_json TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Owner approval queue. Anything the marketing or concierge agent wants
-- the owner to OK before going out (a draft post, a budget change, a
-- creative tweak) lands here. The cockpit `/admin/posts` page reads
-- this; the owner's Telegram bot already has approve/reject callbacks.
CREATE TABLE IF NOT EXISTS owner_approvals (
  id          TEXT PRIMARY KEY,
  -- 'campaign'      — proposed campaign launch
  -- 'creative'      — IG/GBP post draft, WA broadcast copy
  -- 'budget_change' — adjust an existing campaign's budget
  -- 'reply'         — proposed reply to a sensitive thread
  kind        TEXT NOT NULL,
  summary     TEXT NOT NULL,
  detail      TEXT NOT NULL,
  -- 'instagram', 'whatsapp', 'gbp', 'web', 'telegram', or null when not channel-specific
  channel     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  -- Free-text reason captured at decision time (e.g. owner's note in TG).
  decision_note TEXT,
  created_at  INTEGER NOT NULL,
  decided_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON owner_approvals(status);

CREATE TABLE IF NOT EXISTS agent_invocations (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL,
  thread_id   TEXT,
  prompt_chars INTEGER,
  response_chars INTEGER,
  duration_ms INTEGER,
  cost_usd    REAL,
  exit_code   INTEGER,
  error       TEXT,
  created_at  INTEGER NOT NULL
);
