# Architecture

How Happy Cake US's multi-channel agent system is decomposed, why we chose the patterns we did, and where each rubric line is satisfied.

---

## One paragraph

Webhooks (WhatsApp, Instagram, Telegram) and the website chat funnel customer messages into a single Hono server (TypeScript on Bun). The server normalizes each event into an `IncomingMessage` shape, picks a **role** (concierge / kitchen / marketing / owner) via `src/agent/router.ts`, and spawns `claude -p` as a subprocess with that role's system prompt + a tool allowlist scoped to that role. `claude -p` connects to two MCP servers: the **sandbox** (`https://www.steppebusinessclub.com/api/mcp`, hosted, X-Team-Token authed — provides Square POS, WhatsApp/Instagram I/O, Kitchen, Marketing, World, Evaluator, Google Business) and a **local stdio MCP** (`src/agent/mcp/local-server.ts` — owns our drafts, threads, escalations, daily reports). The agent reads catalog/inventory/capacity from sandbox, does reasoning, calls tools, returns a reply. The wrapper streams the reply back via the originating channel adapter and persists thread history to SQLite. The owner (Askhat) is in Telegram with one bot per role; he gets approval requests with inline keyboards and replies with `/approve <id>`, `/reject <id> <reason>`, `/today`.

---

## The hard runtime rule we comply with

> *"Agents must run on Claude Code CLI with Opus 4.7. Submissions that route through Claude Agent SDK, a different LLM provider, a different framework, or expose any non-Telegram owner UI are disqualified."* — hackathon brief

Every reasoning call in this codebase goes through `src/agent/invoke.ts`, which spawns `claude -p` and parses its `--output-format stream-json` output. There is no `@anthropic-ai/claude-agent-sdk`, no `langgraph`, no `crewai`, no `n8n`, no other LLM provider import anywhere in `package.json`. The owner-facing UI is Telegram-only.

---

## Component map

```
                              CUSTOMERS                          OWNER (Askhat)
                                  │                                   │
            ┌─────────┬───────────┴───────┐                            │
            ▼         ▼                   ▼                            ▼
      WhatsApp     Instagram           Website                     Telegram
       webhook       webhook         /api/chat                    bot fan-out
            \         │                   │                            │
             \        │                   │                            ├── @hc_owner_bot
              \       │                   │                            ├── @hc_concierge_bot
               \      │                   │                            ├── @hc_kitchen_bot
                \     │                   │                            └── @hc_marketing_bot
                 \    │                   │                            │
                  ▼   ▼                   ▼                            ▼
                ┌──────────────────────────────────────────────────────────┐
                │             src/server.ts (Hono on Bun)                  │
                │   - normalize → IncomingMessage                          │
                │   - persist thread row in SQLite                         │
                │   - router.ts picks role (concierge|kitchen|marketing|   │
                │     owner) by channel + senderId + slash command         │
                │   - spawn claude -p with role prompt + tool allowlist    │
                │   - stream reply back to channel adapter                 │
                └──────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │   claude -p         │
                            │   Opus 4.7 headless │
                            │   --mcp-config      │
                            └──────────┬──────────┘
                                       │ MCP
                ┌──────────────────────┴────────────────────────────────┐
                ▼                                                        ▼
    ┌────────────────────────────────┐                   ┌────────────────────────────────┐
    │  happycake (HTTP, X-Team-Token)│                   │  local (stdio, our process)    │
    │  https://...steppebusinessclub │                   │  src/agent/mcp/local-server.ts │
    │                                │                   │                                │
    │  - square_*                    │                   │  - list_products               │
    │  - whatsapp_*                  │                   │  - check_constraints           │
    │  - instagram_*                 │                   │  - create_draft_order          │
    │  - kitchen_*                   │                   │  - escalate_to_owner           │
    │  - marketing_*                 │                   │  - approve_order / reject      │
    │  - world_*                     │                   │  - daily_report                │
    │  - evaluator_*                 │                   │  - queue_owner_approval        │
    │  - gb_* (Google Business)      │                   │                                │
    └────────────────────────────────┘                   └────────────────────────────────┘
                │                                                        │
                ▼                                                        ▼
        sandbox source-of-truth                                  our durable state
        (real catalog, kitchen capacity,                         (drafts, threads, escalations,
         marketing, simulated customers, world)                   agent invocation log)
```

---

## Naming clarification

We use **agent** to mean a *role/persona* — defined by a system prompt + tool allowlist. We have 4 agents: concierge, kitchen, marketing, owner.

We use **bot** for a Telegram surface — a `@<name>_bot` token from BotFather that delivers messages. One agent maps to one bot when present.

So "the kitchen agent" is the reasoning persona; `@hc_kitchen_bot` is its Telegram inbox. The agent does the thinking; the bot is just transport. Earlier drafts used "bot" loosely to mean both — fixed here.

(See [docs/02-architecture/AGENT-RUNTIME.md](./docs/02-architecture/AGENT-RUNTIME.md) for the subprocess design, and [docs/_archive/AGENT-SDK-RETROFIT.md](./docs/_archive/AGENT-SDK-RETROFIT.md) for the historical retrofit note. The Agent SDK itself is banned by the hackathon brief.)

## Agent decomposition: 4 roles, 1 router, N invocations

The brief explicitly allows any decomposition ("one super-agent ... or seven micro-agents with a router"). We chose **one agent per concern** because:

1. **Operator legibility (rubric #5).** Askhat reads "kitchen" notifications in `@hc_kitchen_bot` and "marketing" in `@hc_marketing_bot`. Telegram threading does the cognitive grouping for him.
2. **Code Reviewer (rubric #4).** Per-role prompt files (`src/agent/prompts/<role>.md`) make the decomposition visible in the repo, not buried in a single mega-prompt.
3. **Tool blast-radius.** The marketing agent can spend money via `marketing_create_campaign`. The concierge cannot. We enforce that with `--allowedTools` per role, not with prayers.
4. **Parallel team work.** Customer scenarios and operator UX iterate independently — the per-role prompt is the seam.

| Role | Bot | Spawned by | Owns | Tool allowlist |
|---|---|---|---|---|
| `concierge` | `@hc_concierge_bot` (passive log) | every customer inbound (WA / IG / web) | menu Q&A, order intake, complaints, escalation | `square_list_catalog`, `kitchen_get_capacity`, local `list_products`/`check_constraints`/`create_draft_order`/`escalate_to_owner`, `whatsapp_send`, `instagram_send_dm` |
| `kitchen` | `@hc_kitchen_bot` | order approved by owner | capacity check, ticket creation, ready-pickup ping | `kitchen_create_ticket`, `kitchen_get_capacity`, `kitchen_accept_ticket`/`mark_ready`, local `notify_customer` |
| `marketing` | `@hc_marketing_bot` | cron + `world_next_event` | $500/mo plan, creative briefs, launch, measure, adjust | `marketing_*` (full surface), `square_get_pos_summary`, `gb_simulate_post`, local `queue_owner_approval` |
| `owner` | `@hc_owner_bot` | always | approvals, daily report, anomalies | local `approve_order`/`reject_order`/`daily_report`/`list_orders`/`list_escalations`, `evaluator_*`, `square_get_pos_summary` |

Routing logic ([src/agent/router.ts](src/agent/router.ts)):
- Telegram message from `TG_OWNER_CHAT_ID` → owner role.
- Telegram message starting with `/kitchen`, `/marketing`, `/owner`, `/approve`, `/reject` → that role.
- Everything else → concierge.

---

## Why two MCP servers

The brief provides a hosted MCP simulator covering Square, WhatsApp, Instagram, Google Business, kitchen, marketing, world events, and evaluator evidence — addressed by us as `mcp__happycake__*`. That covers **the world** (real catalog, capacity, ad campaigns, simulated customers).

We add a **local stdio MCP** (`src/agent/mcp/local-server.ts`) for **our own state**:
- Conversation threads (per-channel history)
- Drafted orders awaiting owner approval (a state the sandbox kitchen MCP doesn't track)
- Escalations (the owner-side queue)
- Daily reports rendered from our SQLite

Both MCPs are configured in `.mcp.json` at the repo root. The token for the hosted MCP is *not* in the file — `.mcp.json` is rendered from `.mcp.json.template` by `bun run setup:mcp` after the user fills `SBC_TEAM_TOKEN` in `.env.local`.

---

## Tool-call hygiene

`claude -p` running with hundreds of tools (sandbox + local + Claude Code's own MCP-ecosystem inheritance) can default to using `ToolSearch` to discover tools at invocation time. Two countermeasures:

1. **Per-role allowlist** via `--allowedTools` — the agent sees only the tools it's supposed to use.
2. **Deny-list** via `--disallowedTools` — Bash, Read, Edit, Write, WebFetch, WebSearch, TodoWrite, Agent, NotebookEdit are off. (`ToolSearch` is permitted because Claude Code uses it to hydrate deferred MCP tool schemas; we filter it out of the trace.)

The allowlist + denylist combo means each role has a small, stable surface — easier to reason about, easier to audit for the Code Reviewer, and harder to accidentally have the marketing agent send a customer reply.

---

## Channels

Each channel is a small adapter implementing two functions: parse-inbound and send-outbound.

- **WhatsApp** (`src/channels/whatsapp.ts`, ported from prior repo): Cloud API webhook → `IncomingMessage`; `send` POSTs to `graph.facebook.com/v25.0/<phone-id>/messages`.
- **Instagram** (`src/channels/instagram.ts`): Graph API webhook (IG-direct, not Page-level) → `IncomingMessage`; `send` POSTs to `graph.instagram.com/v25.0/<ig-id>/messages`.
- **Telegram** (`src/channels/telegram.ts`, `telegram-poller.ts`): long-poll `getUpdates` → `IncomingMessage`; `send` POSTs to `api.telegram.org/bot<token>/sendMessage`. One poller per bot.
- **Web** (`src/channels/web.ts`): in-process queue. `/api/chat` POSTs trigger `onMessage`, then drain the per-thread reply queue.

Real WA/IG channels are kept live as a *demo + leverage* surface (we set them up before the hackathon — most teams don't have working Meta integrations). The eval likely drives synthetic customers via `whatsapp_inject_inbound` and `instagram_inject_dm` on the sandbox MCP.

---

## State and persistence

Local SQLite ([src/db/schema.sql](src/db/schema.sql)) holds:
- `products` — mirror of catalog (sandbox `square_list_catalog` is source of truth, we sync periodically)
- `threads` — per-(channel, threadId) conversation history
- `orders` — drafted/approved/in-kitchen/ready/picked-up/cancelled with kitchen + Square cross-references
- `escalations` — owner queue
- `leads`, `campaigns` — marketing data
- `agent_invocations` — every `claude -p` call: role, duration, cost, exit, error (audit trail for Code Reviewer)

We deliberately don't mirror sandbox tables we don't need to render — kitchen capacity, ad campaigns, world events live remotely.

---

## Evaluator preview loop

The sandbox MCP provides `evaluator_get_evidence_summary` and `evaluator_generate_team_report` — we can preview what the judges will see. Our `bun run evidence` script runs these against our submission state and writes the latest snapshot to `docs/04-test/EVIDENCE.md` so we iterate on weak rubric lines before submission. Current baseline: 400/400 across the four sandbox rubric dimensions.

`evaluator_score_*` (channel response, marketing loop, POS+kitchen flow, world scenario) gives per-rubric scoring. We invoke each before tightening anything.

---

## Security posture

- Secrets live in `.env.local` only. `.env.local` is gitignored.
- `SBC_TEAM_TOKEN` is rendered into `.mcp.json` at setup time. `.mcp.json` is gitignored. Only `.mcp.json.template` (with `${SBC_TEAM_TOKEN}` placeholder) is committed.
- `claude -p` is invoked with `--dangerously-skip-permissions` — required for headless server use. The denylist on every invocation prevents shell access and filesystem mutation. The agent cannot spawn other agents.
- The webhook handlers verify Meta's `X-Hub-Signature-256` (when `APP_SECRET` is set) and the WA/IG verify token.
- No telemetry, no third-party logging.

---

## Where each rubric line is addressed

| Rubric | Score weight | Where |
|---|---|---|
| Functional Tester (multi-channel customer scenarios) | 20 | Channel adapters → `onMessage` → role-routed agent. `/test/incoming` lets the eval drive scenarios programmatically with the agent's tool trace returned for evidence. |
| Agent-Friendliness (AI customer reads our site) | 15 | `/api/products`, `/api/products/:id`, `/api/policies`, `/llms.txt`, JSON-LD per product page (Product + Offer + FAQPage + Bakery), `/openapi.json`, dynamic sitemap, robots.txt allowing GPTBot/ClaudeBot/PerplexityBot/OAI-SearchBot. |
| On-Site Assistant (website chat) | 15 | Same agent on `/api/chat`. Concierge prompt explicitly handles consultation, custom orders, complaints, status, escalation. |
| Code Reviewer (architecture, decomposition, MCP usage, README, secrets) | 10 | Decomposition-by-role-prompt. Two MCPs (hosted + local). README has fresh-clone steps. Setup script enforces no committed secrets. This file. |
| Operator Simulator (Telegram-only owner UX) | 15 | 4 bots (concierge/kitchen/marketing/owner). Inline keyboards for approve/reject/reason. `/today`, `/orders`, `/help`. |
| Business Analyst ($500→$5,000 hypothesis vs sales CSV) | 15 | Marketing role reads `marketing_get_sales_history` + `marketing_get_margin_by_product`. Hypothesis written to `docs/01-product/HYPOTHESIS.md` with the math. |
| Innovation & Depth | 10 | Multi-bot fan-out. Owner cockpit pulling `evaluator_get_evidence_summary` so Askhat can ask "how are we scoring?". Pre-submit eval-preview loop. |

---

## Submission state

Submission baseline as of 2026-05-10:

- `bun run evidence` → 400/400 (channel response 100, marketing loop 100, POS+kitchen 100, world scenario 100)
- `bun run repro` → 8/8 fresh-clone reproducibility checks
- `bun run audit:hardcodes` → 0 findings across 78 source files
- `bun run e2e` → 10 functional scenarios end-to-end with cited tool traces
- `bun run typecheck` → backend + web both clean

The submission checklist is in [docs/03-build/CHECKLIST.md](./docs/03-build/CHECKLIST.md). The latest evaluator snapshot lives at [docs/04-test/EVIDENCE.md](./docs/04-test/EVIDENCE.md).
