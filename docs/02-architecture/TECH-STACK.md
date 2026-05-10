# Tech stack

What we use, why, what we don't, and where each piece is in the repo.

---

## Runtime constraints (from brief — non-negotiable)

| Allowed | Disallowed |
|---|---|
| Claude Code CLI (`claude -p`) on Opus 4.7 | Claude Agent SDK |
| Local execution on operator's machine | LangGraph |
| Participant's own Claude Max subscription | CrewAI |
| Telegram for owner UI | n8n |
| ngrok / Cloudflare Tunnel for inbound webhooks | Other LLM providers |
| Hosted sandbox MCP | Real production credentials |

Penalty for violating: disqualification.

## Agent runtime — `claude -p` subprocess

The brain. Every reasoning call goes through `src/agent/invoke.ts:158` which spawns `claude -p` with `--output-format stream-json` and parses NDJSON events. **No SDK is installed.** See [AGENT-RUNTIME.md](./AGENT-RUNTIME.md).

## Server — Bun + Hono

- **Bun** — runtime. Fast cold-start, native TS, `Bun.spawn` for subprocess control.
- **Hono** — minimal HTTP framework. Routes in `src/server.ts`, channel webhooks in `src/routes/webhooks.ts`.

Why not NestJS/Next.js: 24h sprint; fewer abstractions; faster iteration. The team converged on this after evaluating both.

## Storage — SQLite (better-sqlite3-style via Bun)

`src/db/db.ts` opens `.data/happycake.db`. Schema in `src/db/schema.sql`. Single-writer is fine for our QPS. Tables:

- `products` — mirror of MCP catalog (sync hourly)
- `threads` — per-(channel, threadId) conversation history
- `orders` — drafts → approved → kitchen → ready → completed
- `escalations` — owner queue
- `leads`, `campaigns` — marketing
- `agent_invocations` — every `claude -p` call (audit trail)

Why not Postgres: SQLite is single-binary, zero setup, fits the laptop deployment in the brief. Postgres comes post-hackathon.

## MCP — sandbox + local

Two servers configured in `.mcp.json`:

| Server | Transport | Purpose |
|---|---|---|
| `happycake` | HTTP, X-Team-Token header | Sandbox: square_*, whatsapp_*, instagram_*, gb_*, marketing_*, kitchen_*, world_*, evaluator_* (55 tools) |
| `local` | stdio (subprocess) | Our state: list_products, create_draft_order, escalate_to_owner, approve_order, daily_report (10 tools) |

`.mcp.json.template` is committed; `.mcp.json` is gitignored. `bun run setup:mcp` renders the template with the team token from `.env.local`.

## Channels

| Channel | Adapter | Inbound | Outbound |
|---|---|---|---|
| Web | `src/channels/web.ts` | `POST /api/chat` (SSE) | response stream |
| WhatsApp | `src/channels/whatsapp.ts` | `POST /webhooks/whatsapp` | `whatsapp_send` MCP |
| Instagram | `src/channels/instagram.ts` | `POST /webhooks/instagram` | `instagram_send_dm` MCP |
| Telegram | `src/channels/telegram.ts` + `telegram-poller.ts` | long-poll `getUpdates` per bot | `sendMessage` HTTP |
| World | scenario poller (TBD) | `world_next_event` cron | router-dispatched as the simulated channel |

Real WA/IG creds are kept live as a demo bonus; the evaluator drives synthetic traffic via `*_inject_*` MCP tools.

## Web frontend

**Next.js 15** (App Router, Turbopack dev) + **React 19**, in `web/`. Talks to the Hono backend over HTTP. Served on its own port (3001) so the backend can stay headless.

- **Tailwind CSS 3** — styling (cream + happy-blue palette from the brand book).
- **Radix UI primitives** — `@radix-ui/react-dialog`, `react-popover`, `react-select`, `react-label`, `react-slot`. Accessible chrome under shadcn-style wrappers.
- **react-hook-form + Zod resolver** — order-form validation with shared schemas.
- **TanStack Query** — client-side fetching for the chat widget and order-status polling.
- **lucide-react** — icon set.
- **react-day-picker** + **date-fns** — pickup-date selection.

Agent-facing surfaces baked into the same app: Schema.org JSON-LD per page (Bakery, Product/Offer, FAQPage, ItemList), `/llms.txt`, `/sitemap.xml`, `/robots.txt`, `/api/products`, `/api/products/[id]`. The owner Mini App lives at `/admin/*` (Telegram WebApp init-data validated server-side).

Why Next.js: SSR on every page is the rubric's Agent-Friendliness signal — AI crawlers and the on-site assistant both read fully-rendered HTML, no JS hydration required. App Router gets us metadata, JSON-LD, and route-level revalidation for free.

## Telegram bots

Raw `fetch` to `api.telegram.org/bot<token>/<method>`, no library. Multi-bot fan-out: one bot per role (`@hc_owner_bot`, `@hc_concierge_bot`, `@hc_kitchen_bot`, `@hc_marketing_bot`) defined in [src/channels/telegram.ts](../../src/channels/telegram.ts), driven by [src/channels/telegram-poller.ts](../../src/channels/telegram-poller.ts) (long-poll `getUpdates`). Owner-bot slash-command router and inline-keyboard callbacks in [src/bots/owner/](../../src/bots/owner/).

Why not telegraf/grammy: ~80 lines of `fetch` covers everything we need (sendMessage, editMessageText, answerCallbackQuery, sendChatAction); pulling a framework would add type-friction without saving meaningful code.

## Tunnels

Quick path: `ngrok http 3000` → register the URL via `bun run register-webhooks`. Stable path: named Cloudflare Tunnel post-hackathon. See [05-deploy/DEPLOY.md](../05-deploy/DEPLOY.md).

## Dependencies (production)

Backend ([package.json](../../package.json)):
```
hono                              — HTTP framework
zod                               — schema validation
@modelcontextprotocol/sdk         — local stdio MCP server
@aws-sdk/client-s3                — image uploads to DO Spaces
@aws-sdk/s3-request-presigner     — pre-signed upload URLs
```

Web ([web/package.json](../../web/package.json)):
```
next, react, react-dom            — framework
zod, @hookform/resolvers          — form validation
react-hook-form                   — form state
@tanstack/react-query             — client fetching
@radix-ui/* (5 primitives)        — accessible UI primitives
class-variance-authority, clsx,
  tailwind-merge                  — variant + class helpers
lucide-react                      — icons
react-day-picker, date-fns        — date picker
tailwindcss-animate               — utility animations
```

## Dev dependencies

```
@types/bun                        — Bun TS types
typescript                        — typecheck only (Bun runs TS directly)
tailwindcss, postcss, autoprefixer (web only)
```

Bun handles the rest: native test runner, watch mode, package install.

## What the codebase explicitly does NOT depend on

- `@anthropic-ai/sdk` — would imply direct API calls; we route through claude -p only.
- `@anthropic-ai/claude-agent-sdk` — banned.
- `langchain`, `langgraph`, `crewai-js` — banned.
- `prisma`, `pg`, `mysql2` — single-file SQLite is enough.
- `telegraf`, `grammy`, `node-telegram-bot-api` — raw fetch is enough.
- `redis`, `bullmq` — in-process queue suffices for laptop QPS.
- `openai`, `@google/generative-ai` — disallowed.

A `git grep` of these in `package.json` returns clean.

## Repo layout (canonical)

```
sbc-hackathon/
├── README.md, ARCHITECTURE.md, AGENTS.md, CLAUDE.md
├── .env.example, .env.local (gitignored)
├── .mcp.json.template, .mcp.json (gitignored)
├── package.json, tsconfig.json, bun.lock
├── data/                       — committed seed data (catalog, campaign plans)
├── .data/                      — runtime SQLite (gitignored)
├── docs/                       — this docs tree
├── evidence/                   — evaluator preview outputs (gitignored)
├── web/                        — Next.js 15 customer site + owner Mini App
└── src/                        — Bun + Hono backend
    ├── server.ts               — Hono entrypoint, composition root
    ├── config.ts               — single env access seam
    ├── lib/                    — env, sandbox-mcp client, event-log, spaces
    ├── routes/                 — webhooks.ts, catalog, orders, admin, leads, meta
    ├── channels/               — per-channel adapters (WA/IG/TG/web)
    ├── domain/                 — pure ops: tools, policies, campaigns, orchestration
    ├── agent/
    │   ├── invoke.ts           — claude -p subprocess wrapper
    │   ├── router.ts           — channel/sender → role
    │   ├── allowlists.ts       — per-role tool allowlists + global denylist
    │   ├── prompts/<role>.md   — system prompts per role (when present)
    │   └── mcp/local-server.ts — stdio MCP for our state
    ├── bots/owner/             — owner-bot slash commands + cards + callbacks
    ├── db/                     — SQLite schema + queries
    └── scripts/                — db-init, smoke-agent, world, evidence, setup-mcp
```
