# Architecture decisions

Seven choices that shaped this build. Each one names the alternative we considered, why we picked the one we did, and the date the decision landed. Code Reviewer judges asking *"why this and not that"* should find the answer here.

---

## D-001 — Two MCP servers (sandbox + local stdio), not one

**Date:** 2026-05-09
**Decision:** Run both the hackathon-provided sandbox MCP (HTTP, X-Team-Token authed) and a local stdio MCP we own. Wired side-by-side in `.mcp.json`.
**Alternative considered:** Single sandbox MCP only. Or: proxy everything through our own stdio MCP and call sandbox tools from inside it.
**Why two:** The sandbox owns the *world* (catalog, kitchen capacity, marketing, evaluator, simulated customers). We own *our state* (drafts pending owner approval, conversation threads, escalations queue, brand-RAG, daily reports). These are bounded contexts in the DDD sense. The agent calls both naturally; the seam is clear; the security blast-radius is well-defined (the team token only lives inside the agent subprocess, never exposed to the website or local MCP).
**Where:** [.mcp.json.template](../../.mcp.json.template), [src/agent/mcp/local-server.ts](../../src/agent/mcp/local-server.ts), [src/lib/sandbox-mcp.ts](../../src/lib/sandbox-mcp.ts).

---

## D-002 — Per-role tool allowlists, enforced via deny-list

**Date:** 2026-05-09 (allowlist), 2026-05-10 (deny-list enforcement)
**Decision:** Each agent role (concierge, kitchen, marketing, owner) gets a small explicit list of MCP tools it can use. The list is the rubric's per-role-decomposition signal. Specific dangerous tools (`mcp__happycake__square_create_order`) are in `DENY_ALWAYS` so they're enforced even if a role's allowlist tries to include them.
**Alternative considered:** Allowlist only, trusting the agent to honor it.
**Why deny-list:** `--allowedTools` in `claude -p` is a *permission* allowlist (auto-approves listed tools) — combined with `--dangerously-skip-permissions`, the MCP server still exposes ALL its tools and the agent can call any of them. `--disallowedTools` IS enforced. Verified live on 2026-05-10: e2e S04 showed the agent calling `square_create_order` even after we removed it from the concierge allowlist; adding it to `DENY_ALWAYS` fixed it.
**Where:** [src/agent/allowlists.ts](../../src/agent/allowlists.ts).

---

## D-003 — Owner approve/reject is deterministic, not LLM-gated

**Date:** 2026-05-09
**Decision:** Standard catalog orders auto-approve in the background (no LLM hop). Custom-cake / complaint / refund / allergen-critical drafts surface in Telegram with inline keyboards; tapping Approve runs `approveDraftAndPromote` ([src/domain/order-orchestration.ts](../../src/domain/order-orchestration.ts)) which calls sandbox `square_create_order` + `kitchen_create_ticket` directly via HTTP — no `claude -p` involvement.
**Alternative considered:** Route the approve callback through `claude -p` with the owner agent.
**Why deterministic:** "Press a button → cake is ordered" cannot depend on LLM variability. Atomic, idempotent, fast (no 5–30s reasoning latency on a tap). The agent never sees `square_create_order` in its trace. The tradeoff: owner approval has fewer judgment moments (no "review my reasoning"), but the brief explicitly asks for *clean* operator handoff, not chatty.
**Where:** [src/domain/order-orchestration.ts](../../src/domain/order-orchestration.ts), [src/bots/owner/callbacks.ts](../../src/bots/owner/callbacks.ts).

---

## D-004 — Multi-bot fan-out (one TG bot per role), not a single owner bot

**Date:** 2026-05-09
**Decision:** Four Telegram bots — `@hc_owner_bot`, `@hc_concierge_bot`, `@hc_kitchen_bot`, `@hc_marketing_bot`. The owner-bot has slash commands + free-text owner agent; the others are passive role logs (the kitchen bot shows ticket lifecycle; marketing bot shows campaign launches).
**Alternative considered:** Single owner bot with internal role routing — owner picks "talk to kitchen" / "talk to marketing" via inline buttons. Cleaner UX, fewer tokens to manage.
**Why multi-bot:** (a) Telegram threading does the cognitive grouping for the operator — kitchen notifications stay in the kitchen chat, marketing in marketing. (b) The brief explicitly mentions "one bot per agent" as a valid pattern; multiple bots make the per-role decomposition visible to the Code Reviewer judge without reading code. (c) Single-bot fallback works: if only `TG_OWNER_BOT_TOKEN` is set, all four agents log into the owner bot (the role-routing UX still works internally).
**Where:** [src/channels/telegram.ts](../../src/channels/telegram.ts), [src/bots/owner/](../../src/bots/owner/).

---

## D-005 — Bun + Hono + Next.js 15, not NestJS / Fastify / Koa

**Date:** 2026-05-09
**Decision:** Bun runtime, Hono for the HTTP backend (`:3000`), Next.js 15 App Router for the public website + admin Mini App (`:3001`). Two processes, two `bun install`s. Talk over HTTP.
**Alternative considered:** NestJS for an opinionated backend, or single Next.js app with API routes for everything.
**Why this:** Bun's cold-start is sub-second (matters for `claude -p` subprocess spin-up); Hono has the smallest API surface that does what we need (route groups + middleware); Next.js 15 SSR makes the agent-friendliness rubric easier (every page renders fully in one fetch, JSON-LD inline, no JS hydration required for crawlers). NestJS would add 100+ files of boilerplate for no rubric win; single-Next would muddle the agent-runtime backend with the marketing surface.
**Where:** [package.json](../../package.json), [web/package.json](../../web/package.json).

---

## D-006 — SQLite over Postgres for state

**Date:** 2026-05-09
**Decision:** `bun:sqlite` at `.data/happycake.db`. Schema in [src/db/schema.sql](../../src/db/schema.sql) + idempotent column-add migrations in [src/db/db.ts](../../src/db/db.ts). One file, no daemon, single-writer-fine for our QPS.
**Alternative considered:** Postgres (Supabase / Neon / local).
**Why SQLite:** The brief explicitly targets a laptop deploy ("local execution on the operator's machine"); SQLite is the only DB that works zero-config on a laptop. No connection pooling, no migration framework, no backup story for the hackathon scope. Postgres is the post-hackathon move when sustained traffic crosses ~1 req/s — documented in [docs/05-deploy/PRODUCTION.md](../05-deploy/PRODUCTION.md).
**Where:** [src/db/db.ts](../../src/db/db.ts).

---

## D-007 — Web admin pages are a Telegram Mini App, not a parallel dashboard

**Date:** 2026-05-09
**Decision:** Pages under `web/src/app/admin/*` render inside Telegram's WebApp browser, gated by HMAC-verified `Telegram.WebApp.initData`. The owner reaches them only by tapping the bot's menu button. `/admin` is disallowed in `robots.txt` and the API endpoints return 401 without a valid initData header.
**Alternative considered:** No admin web at all (everything in Telegram bot text), or a standalone admin web.
**Why Mini App:** Standalone admin would violate the brief's "owner UI is Telegram only" rule. Pure-text Telegram is fine but slow for table-shaped data (orders, escalations, content queue). Mini App keeps the surface "inside Telegram" while letting us render a real admin grid. This is the same pattern Telegram itself uses for in-bot games, payments, and dashboards. Explicitly framed as compliant in [README.md](../../README.md) and [ARCHITECTURE.md](../../ARCHITECTURE.md).
**Where:** [web/src/app/admin/layout.tsx](../../web/src/app/admin/layout.tsx), [web/src/components/admin/tg-app-provider.tsx](../../web/src/components/admin/tg-app-provider.tsx), [src/middleware/admin-auth.ts](../../src/middleware/admin-auth.ts).
