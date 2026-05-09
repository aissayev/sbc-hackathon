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

Server-rendered HTML from Hono (`src/web/pages.ts`). For the on-site assistant chat (`/chat` page), we add a single React island:

- **Vercel AI SDK** (`ai`, `@ai-sdk/react`) — transport + state via `useChat`.
- **assistant-ui** (`@assistant-ui/react`) — chat chrome with tool-call cards, reasoning panel, mobile-friendly.

Bundled as `chat.bundle.js` via esbuild, served from `/static/`.

Why not Next.js: rest of the site is static and server-rendered for top agent-friendliness; only one page needs React. Saves bundle size and complexity.

## Telegram bots

`telegraf` library, one bot per agent role. Four bot tokens in `.env.local`. Each bot is a NestJS-free standalone module under `src/bots/`.

## Tunnels

Quick path: `ngrok http 3000` → register the URL via `bun run register-webhooks`. Stable path: named Cloudflare Tunnel post-hackathon. See [05-deploy/DEPLOY.md](../05-deploy/DEPLOY.md).

## Dependencies (production)

```
hono                              — HTTP framework
zod                               — schema validation
@modelcontextprotocol/sdk         — local MCP server
ai + @ai-sdk/react                — chat transport (frontend)
@assistant-ui/react               — chat UI primitives (frontend)
telegraf                          — Telegram bots
```

## Dev dependencies

```
@types/bun                        — Bun TS types
typescript                        — typecheck only (Bun runs TS directly)
esbuild                           — bundle the chat island
```

Bun handles the rest: native test runner, watch mode, package install.

## What the codebase explicitly does NOT depend on

- `@anthropic-ai/sdk` — would imply direct API calls; we route through claude -p only.
- `@anthropic-ai/claude-agent-sdk` — banned.
- `langchain`, `langgraph`, `crewai-js` — banned.
- `prisma`, `pg`, `mysql2` — single-file SQLite is enough.
- `next`, `react-dom/server` — static HTML from Hono is enough.
- `redis`, `bullmq` — in-process queue suffices for laptop QPS.
- `openai`, `@google/generative-ai` — disallowed.

A `git grep` of these in `package.json` returns clean.

## Repo layout (canonical)

```
sbc-hackathon/
├── README.md, ARCHITECTURE.md, AGENTS.md
├── .env.example, .env.local (gitignored)
├── .mcp.json.template, .mcp.json (gitignored)
├── package.json, tsconfig.json, bun.lock
├── data/                       — committed seed data (photos, brandbook copy)
├── .data/                      — runtime SQLite (gitignored)
├── docs/                       — this docs tree
├── evals/scenarios/            — YAML customer scenarios
├── evidence/                   — evaluator preview outputs (gitignored)
└── src/
    ├── server.ts               — Hono entrypoint
    ├── config.ts               — env access seam
    ├── lib/env.ts              — .env loader
    ├── routes/webhooks.ts      — WA/IG/TG webhook handlers
    ├── channels/               — per-channel adapters
    ├── domain/tools.ts         — typed wrappers around MCP tools
    ├── agent/
    │   ├── invoke.ts           — claude -p subprocess wrapper
    │   ├── router.ts           — channel/sender → role
    │   ├── prompts/<role>.md   — system prompts per role
    │   └── mcp/local-server.ts — stdio MCP for our state
    ├── bots/                   — telegraf bots (one per role)
    ├── db/                     — SQLite schema + queries
    ├── web/                    — server-rendered HTML pages
    └── scripts/                — db-init, smoke-agent, world-start, evidence, setup-mcp
```
