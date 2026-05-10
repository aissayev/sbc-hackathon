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
  -- FK into customers.id; nullable until the thread is matched (usually
  -- on first order draft, when phone shows up).
  customer_id TEXT,
  -- JSON array of {role, content, ts}
  history_json TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_threads_customer ON threads(customer_id);

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL,
  channel       TEXT NOT NULL,
  -- State machine:
  --   draft → approved → in_kitchen → ready → out_for_delivery? → picked_up | completed
  --                  ↘ rejected
  --                  ↘ cancelled
  --                  ↘ refund_pending → refunded
  -- `out_for_delivery` is only used for delivery orders; pickup goes
  -- ready → picked_up. `completed` is the terminal "done" status used by
  -- both delivery and pickup once the customer has the cake.
  -- `refund_pending` enters from any post-payment state via the customer
  -- flow (request_refund tool); owner approval flips it to `refunded`,
  -- denial reverts to the prior state (stored in refund_requests.prev_status).
  status        TEXT NOT NULL CHECK (status IN ('draft','approved','rejected','in_kitchen','ready','out_for_delivery','picked_up','completed','cancelled','refund_pending','refunded')),
  customer_name TEXT,
  customer_phone TEXT,
  -- Optional: collected when web checkout asks for it.
  customer_email TEXT,
  -- FK into customers.id; nullable so old rows / phone-less drafts still
  -- pass. Maintained by upsertCustomerForOrder() in domain/customers.ts.
  customer_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- CRM source of truth. One row per unique customer (deduped by phone, then
-- email). Populated automatically on every draft-order create from the
-- customer_name + customer_phone the form collects, and surfaced to the
-- agent via local MCP tools (find_customer_by_phone, get_customer,
-- list_customer_orders) and to the owner via a Telegram /customer command
-- + repeat-customer badge on draft-order cards.
--
-- Counters (order_count, total_spent_cents, last_seen_at) are denormalized
-- so a "12th order" badge is a single row read, not an aggregate scan.
-- They're kept in sync from upsertCustomerForOrder() in domain/customers.ts.
--
-- square_customer_id is reserved for live Square sync; the hackathon
-- sandbox MCP doesn't expose customer endpoints, so it stays NULL today.
CREATE TABLE IF NOT EXISTS customers (
  id                 TEXT PRIMARY KEY,                 -- 'cust_<random>'
  name               TEXT,
  phone              TEXT UNIQUE,                      -- E.164-normalized when possible
  email              TEXT UNIQUE,
  square_customer_id TEXT,                             -- reserved for prod sync
  first_seen_at      INTEGER NOT NULL,
  last_seen_at       INTEGER NOT NULL,
  order_count        INTEGER NOT NULL DEFAULT 0,
  total_spent_cents  INTEGER NOT NULL DEFAULT 0,
  -- Free-form owner notes. Shown in /customer view, not the agent prompt.
  notes              TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_last_seen ON customers(last_seen_at DESC);

-- Refund requests, initiated by the customer on any channel via the
-- concierge agent's `request_refund` MCP tool. The owner approves or
-- denies via the TG card; on approve the linked order flips to
-- 'refunded' and we attempt a Square sandbox status update. On deny,
-- the order reverts to `prev_status` (stored on creation).
CREATE TABLE IF NOT EXISTS refund_requests (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL,
  thread_id     TEXT NOT NULL,
  channel       TEXT NOT NULL,
  reason        TEXT NOT NULL,
  -- Original order.status at request time, so deny can revert cleanly.
  prev_status   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  -- Free-text reason the owner gave when denying (or noted on approve).
  decision_note TEXT,
  created_at    INTEGER NOT NULL,
  decided_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refund_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refund_requests(status);

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

-- Audit log: every owner-initiated action through the cockpit. The chat
-- agents have their own log (agent_invocations); this is just for the
-- human, so the trail of "what did the owner do, when, on what" is
-- searchable from /admin/settings.
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  -- 'approval_approve', 'approval_reject', 'thread_reply',
  -- 'channel_register', 'channel_test', 'campaign_pause',
  -- 'campaign_resume', 'campaign_adjust', 'order_approve', 'order_reject'
  action      TEXT NOT NULL,
  -- The thing acted on. e.g. 'aprv_…', 'ord_…', 'whatsapp', 'cmp_…'
  target_id   TEXT,
  -- Optional channel scope so the audit page can filter / colour rows.
  channel     TEXT,
  -- Free-form result summary ("approved", "rejected: out of season",
  -- "registered + appId=fb_123"). Keep short — the cockpit shows it raw.
  result      TEXT,
  -- 'ok' | 'error' — separate from `result` so the UI can colour without parsing.
  outcome     TEXT NOT NULL DEFAULT 'ok' CHECK (outcome IN ('ok', 'error')),
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

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

-- ─── Content studio ─────────────────────────────────────────────────────
-- Owner-side content lifecycle: free-text intent → drafted caption →
-- brand-checked → approved → scheduled → published. Sandbox MCP
-- (`gb_simulate_post`, `marketing_create_campaign`) is the publish target
-- during the hackathon. Real Meta/GBP would be a swap of the adapter at
-- src/agent/mcp/adapters/* — this table is platform-agnostic.

CREATE TABLE IF NOT EXISTS content_drafts (
  id              TEXT PRIMARY KEY,
  -- post | reel | story | gbp_post | comment_reply | review_reply | wa_broadcast
  kind            TEXT NOT NULL,
  -- ig | fb | gbp | wa | multi
  channel         TEXT NOT NULL,
  -- draft | brand_pending | approved | scheduled | publishing
  -- | published | failed | discarded | expired
  status          TEXT NOT NULL DEFAULT 'draft',
  caption         TEXT,
  -- JSON: { hook, voiceover, b_roll[], thumbnail_idea } for reels
  brief_json      TEXT,
  -- Comma-separated DO Spaces URLs (or local /uploads paths)
  media_urls      TEXT,
  -- Comma-separated SKU ids — drives inventory awareness in posts
  sku_refs        TEXT,
  -- Brand-checker output JSON: { ok, score, issues:[{severity,code,msg,fix}] }
  brand_check_json TEXT,
  owner_note      TEXT,
  -- Epoch ms the owner wants this published. NULL = not yet scheduled.
  scheduled_for   INTEGER,
  -- Publish receipt JSON: { tool, tool_input, tool_output, remote_id, ts }
  publish_receipt_json TEXT,
  -- Telegram message id of the owner card so callbacks can update it in place
  tg_card_msg_id  INTEGER,
  -- Free-text intent that started this draft (audit trail)
  source_intent   TEXT,
  -- Linked plan slot (one slot ↔ at most one active draft)
  slot_id         TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON content_drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled ON content_drafts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_drafts_kind ON content_drafts(kind);

-- Weekly plan rhythm. One slot per (iso_week, day, hour, channel, kind).
-- Slots can be empty (suggestion) or filled by a draft (in-flight content).
CREATE TABLE IF NOT EXISTS content_plan_slots (
  id              TEXT PRIMARY KEY,
  iso_week        TEXT NOT NULL,                 -- e.g. "2026-W19"
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour            INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  channel         TEXT NOT NULL,
  kind            TEXT NOT NULL,
  topic_hint      TEXT,
  draft_id        TEXT,
  -- pending | drafted | approved | published | skipped
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_slots_week ON content_plan_slots(iso_week);
CREATE INDEX IF NOT EXISTS idx_slots_status ON content_plan_slots(status);

-- ─── Analytics: digital-presence snapshots ──────────────────────────────
-- Hourly snapshot of the brand's digital health. Cheap to rebuild; we cache
-- so /stats is instant even when the sandbox MCP is slow. One row per
-- ISO date is enough for the daily-delta line; intra-day rebuilds upsert.
--
-- payload_json schema is owned by src/domain/analytics/metrics.ts — keep
-- that file in sync with what's read here.
CREATE TABLE IF NOT EXISTS digital_presence_snapshots (
  iso_date        TEXT PRIMARY KEY,         -- "2026-05-09"
  payload_json    TEXT NOT NULL,
  built_at        INTEGER NOT NULL
);

-- ─── Careers / job applications ────────────────────────────────────────
-- Inbound applications submitted via /careers#apply on the website. Owner
-- gets a TG card on each submission; CRM-style admin page lists + transitions
-- through status. Resume/portfolio kept as a free-form URL field — we don't
-- accept file uploads on this surface (out of scope for the hackathon build).
CREATE TABLE IF NOT EXISTS applications (
  id            TEXT PRIMARY KEY,         -- "app_<ms>_<6char>"
  -- Role slug from web/src/lib/careers.ts (counter, baker, driver, other).
  -- "other" = "Don't see your role?" path; carries a free-text role hint.
  role          TEXT NOT NULL,
  role_hint     TEXT,                     -- only when role='other'
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  -- Free-text "why" + optional portfolio/resume link. Both capped client-side.
  pitch         TEXT NOT NULL,
  portfolio_url TEXT,
  -- Where we found them — referral channel, hourly availability — captured
  -- as a small JSON blob so we can extend without a migration.
  meta_json     TEXT,
  -- new → first time seen, owner gets the TG card
  -- reviewing → owner tapped "review" or marked from cockpit
  -- interview → scheduled / in conversation
  -- hired / rejected → terminal
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','reviewing','interview','hired','rejected')),
  -- Free-text owner annotations from the cockpit. Markdown allowed.
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_role ON applications(role);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at DESC);
