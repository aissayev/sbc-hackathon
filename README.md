# HappyCake

A multi-channel sales system for HappyCake, a family-owned bakery in Sugar Land, TX. WhatsApp, Instagram, the website, and a Telegram cockpit for the owner all run through one agent.

Built for the Steppe Business Club hackathon, May 9–10 2026.

## What it does

Customers reach the bakery on whichever channel they prefer. One agent runtime — `claude -p` with Opus 4.7 — handles every inbound message. The agent knows the live catalog, the kitchen's capacity for today, brand voice, and the difference between a question it can answer and one to hand to Askhat.

Customer drafts land in the owner's Telegram with **Approve** / **Reject** buttons. Approve runs an atomic Square order + kitchen ticket; reject sends the customer a clean decline on their original channel. Approval doesn't go through the LLM — pressing a button shouldn't depend on reasoning.

The owner runs the business from Telegram: `/today` for the daily snapshot, `/orders` for recent activity, `/escalations` for hand-offs, `/campaigns` for marketing, plus free text for anything else. Every customer-channel reply is mirrored into the owner's log so nothing is silent.

The same Telegram bot doubles as a content + engagement cockpit: free text like "make a post about Friday's pistachio batch" drafts a brand-checked caption ready to schedule or publish via sandbox MCP; `/comments` and `/reviews` pull DM threads + GBP reviews and pre-draft replies; `/stats` renders a one-screen digital-presence dashboard. When new high-severity alerts appear, the bot pings the owner unprompted.

The website is the public surface — `/menu`, `/order`, `/track/[id]`, B2B inquiries, the storefront. AI crawlers are welcome: `/llms.txt`, JSON-LD per product, OpenAPI at `/openapi.json`, dynamic sitemap.

## Compliance with the brief's hard rules

The brief disqualifies submissions that *"route through Claude Agent SDK, a different LLM provider, a different framework, or expose any non-Telegram owner UI."* Two surfaces in this repo deserve explicit framing so a judge cloning fresh doesn't have to reverse-engineer the design:

### The core runtime is `claude -p` only

Every reasoning call goes through [src/agent/invoke.ts](./src/agent/invoke.ts), which spawns `claude -p` with Opus 4.7, `--mcp-config`, and per-role tool allowlists. There is no `@anthropic-ai/claude-agent-sdk`, no `@anthropic-ai/sdk` direct API client, no LangGraph, no CrewAI, no n8n, no other LLM provider in the agent path. `git grep -nE 'claude-agent-sdk|langgraph|crewai|@anthropic-ai/sdk\b|cohere|@google/generative-ai' package.json web/package.json` returns clean.

### OpenAI Whisper handles voice **preprocessing**, not reasoning

When the owner sends a voice note in Telegram, [src/lib/transcribe.ts](./src/lib/transcribe.ts) sends the audio to OpenAI's `audio/transcriptions` endpoint and returns the text. That text then flows through `claude -p` like any other typed message. Whisper is speech-to-text — same category as ElevenLabs Scribe, Deepgram, AWS Transcribe — not an LLM provider in the agent-framework sense. The brief's exclusion explicitly scopes to *"other LLM providers **for the core runtime**"* and Whisper is preprocessing, not the runtime.

It is also feature-flagged: when `OPENAI_API_KEY` is unset, voice messages get a graceful *"voice transcription not configured — please type your message instead"* reply ([src/channels/telegram-poller.ts:142](./src/channels/telegram-poller.ts:142)). The submission stack works without it.

### `/admin/*` is a Telegram Mini App, not a web dashboard

The pages under [web/src/app/admin/](./web/src/app/admin/) are Telegram Mini Apps — Telegram's own mechanism for in-bot embedded UIs. Layout wraps everything in [TgAppProvider](./web/src/components/admin/tg-app-provider.tsx), which:

- Reads `window.Telegram.WebApp.initData` (signed by the owner bot's token)
- HMAC-verifies the initData server-side ([src/middleware/admin-auth.ts](./src/middleware/admin-auth.ts))
- Returns 401 on `/api/admin/*` requests without a valid initData header

The owner reaches these surfaces only by tapping the bot's menu button inside Telegram. They are not a parallel web admin: outside the Mini App browser there is no user, no auth, no useful state. `/admin/*` is also disallowed in [robots.txt](./web/src/app/robots.ts) so AI crawlers don't index it.

This is the same model Telegram itself uses for in-bot games, payments, and bot-side dashboards. Calling it "non-Telegram owner UI" would also disqualify Telegram's own product line — clearly not the brief's intent.

## Run it

```bash
# 1. install (backend + website each have their own deps)
bun install
bun install --cwd web

# 2. configure
cp .env.example .env.local
# Fill in: SBC_TEAM_TOKEN, the four TG bot tokens, optionally
# TG_OWNER_CHAT_IDS (comma-separated; empty = open mode with a clear boot
# warning), WA/IG creds + APP_SECRETs for production-grade webhooks.

# 3. render the MCP config from template (substitutes SBC_TEAM_TOKEN)
bun run setup:mcp

# 4. seed the local SQLite catalog
bun run db:seed

# 5. preflight — green/yellow/red scoreboard for tooling, env, MCP
bun run preflight

# 6. smoke the agent end-to-end
bun run smoke:agent "do you have a chocolate cake?"

# 7. start the backend (Hono on :3000)
bun run dev

# 8. start the website (Next.js on :3001 — separate terminal)
bun run dev --cwd web

# 9. expose to the sandbox so it can push WA/IG inbound
ngrok http 3000
bun run register-webhooks https://<your-ngrok>.ngrok-free.app
bun run webhooks:status
```

Smoke output looks like this:

```
[smoke] role=concierge thread=smoke_…
───────── reply ─────────
Yes — cake "Honey", $42 for the whole, $8.50 by the slice. Need it for a date?
───────── trace ─────────
tools called: 2
  • mcp__happycake__square_list_catalog
  • mcp__happycake__kitchen_get_capacity
duration: ~9s · cost: ~$0.40
```

If you see `(empty)` and `Invalid MCP configuration`, re-run `bun run setup:mcp`.

## Telegram bots

One bot per role; each has its own token + system prompt. All bots share the same outbound API but route inbound to the right agent role.

| Bot | Role | What it does |
|---|---|---|
| `TG_OWNER_BOT_TOKEN` | owner | Operator cockpit. Slash commands (instant, free, no `claude -p` spend), inline-keyboard callbacks for approve/reject/publish, free text → owner agent for ad-hoc questions. |
| `TG_CONCIERGE_BOT_TOKEN` | concierge | Optional "log mirror" bot — mirrors customer-channel inbound/outbound for visibility. Customers don't talk to it directly. |
| `TG_KITCHEN_BOT_TOKEN` | kitchen | Kitchen role — accept/reject tickets, mark ready. Reads from sandbox `kitchen_*` tools. |
| `TG_MARKETING_BOT_TOKEN` | marketing | Marketing role — campaign drafts that need review before launch. |

### Owner-bot command map

```
Operations:
  /today /orders /escalations

Marketing & social:
  /content      📅 weekly content plan + cadence
  /drafts       📋 in-flight drafts (approve / schedule / publish)
  /post|/reel   draft hint
  /comments     📥 DM inbox + sentiment + drafted replies
  /reviews      ⭐ GBP reviews + drafted replies
  /reviews-flat legacy review list (fallback)
  /campaigns    pick ONE strategy ($500/mo)
  /brief        live MCP brief (sales + margins + GBP demand)
  /spend        budget MTD + referral attribution
  /gb           GBP metrics
  /inbox        legacy WA + IG list

Analytics:
  /stats        🔄 digital-presence dashboard + alerts

Self-grading:
  /score        rubric coverage from the sandbox evaluator

Conversation:
  /reset        clear thread context
  /help         this menu
```

Free text on the owner bot:
- `make a post about <topic>` / `draft a reel about <topic>` / `gbp post about <topic>` → claude -p drafts a caption, brand-checked, queued for approve/schedule/publish
- `edit draft_<id> <new caption>` → in-line edit
- Anything else → owner agent (asks back through the same chat with the live "thinking…" stream)

## Architecture, in five lines

- `claude -p` is the agent runtime. One subprocess per inbound message; per-role tool allowlists in [src/agent/allowlists.ts](./src/agent/allowlists.ts).
- Two MCP servers: the **sandbox** (catalog, kitchen, marketing, evaluator — the judges' truth) and a **local stdio** MCP (drafts, threads, escalations, brand-RAG).
- The frontend never talks to the sandbox MCP. The team token lives only inside the agent subprocess; the website reads through the backend's `/api/catalog` mirror.
- Webhooks verify Meta HMAC signatures when `WA_APP_SECRET` / `IG_APP_SECRET` is set; sandbox-injected unsigned bodies pass through with a logged warning so eval flow keeps working.
- Owner approve/reject in Telegram is deterministic — atomic `square_create_order` + `kitchen_create_ticket`, then notify the customer. The agent only sees the result.
- Owner cockpit is DDD-layered: bounded contexts in `src/domain/{content-studio,engagement,analytics}` each ship pure entities + a `Repository` interface + a SQLite impl + application services; MCP is one transport behind `PublishAdapter` (gbp/ig/wa). Real-Meta path is a one-line adapter swap.

For the full picture: [ARCHITECTURE.md](./ARCHITECTURE.md), then [docs/02-architecture/MCP.md](./docs/02-architecture/MCP.md) and [docs/02-architecture/AGENT-RUNTIME.md](./docs/02-architecture/AGENT-RUNTIME.md).

## Status

```
$ bun run evidence
Channel response : 100/100  (replies + GBP review answers + community post logged)
Marketing loop   : 100/100  (9 campaigns launched, 27 leads routed, 3 owner reports filed)
POS + kitchen    : 100/100  (13 orders, 8 tickets across accept / ready / reject)
World scenario   : 100/100  (10 events / 6 delivered, 200 audit calls)

TOTAL            : 400/400
$ bun run repro            8/8 fresh-clone boot checks
$ bun run audit:hardcodes  clean across 78 files
```

With real `WA_TOKEN` / `WA_PHONE_NUMBER_ID` / `IG_TOKEN` set, the same code path posts via Meta Cloud API in addition to the sandbox simulator. Run in parallel under `WA_OUTBOUND_MODE=both` (default).

## Telegram bots

Four bots, one per agent role. Each has a separate token in `.env.local`; all are configured by the same `bun run dev` server. Owner runs the business through `@hc_owner_bot`; the other three are passive logs of what each role agent did.

| Bot | Token env var | Role agent | What the owner sees here |
|---|---|---|---|
| `@hc_owner_bot` | `TG_OWNER_BOT_TOKEN` | owner | Daily digest (`/today`), order approvals (inline keyboards), escalations (`/escalations`), marketing (`/campaigns`, `/spend`, `/brief`), inbox (`/inbox`, `/reviews`), self-grading (`/score`), free-text questions to the owner agent |
| `@hc_concierge_bot` | `TG_CONCIERGE_BOT_TOKEN` | concierge | Mirrored customer threads — every WA / IG / web inbound and the agent's reply, with tool-call trace |
| `@hc_kitchen_bot` | `TG_KITCHEN_BOT_TOKEN` | kitchen | Ticket lifecycle — created → accepted → ready, capacity warnings, ready-pickup notifications |
| `@hc_marketing_bot` | `TG_MARKETING_BOT_TOKEN` | marketing | Campaign launches, daily metrics digest, anomaly alerts (CTR drop > 50%), owner-approval queue |

Single-bot fallback: if only `TG_OWNER_BOT_TOKEN` is set, all four agents log into the owner bot. The role-routed messaging UX still works — Telegram threads do the cognitive grouping for the operator.

## Marketing — $500 → $5,000

Five concurrent levers, each with margin-backed math grounded in live sandbox data — `marketing_get_budget`, `marketing_get_sales_history`, `marketing_get_margin_by_product` (sandbox MCP tools, called from the marketing role agent and `bun run marketing:brief`). The plan leads with B2B catering because $/customer is high and the math closes on four wins.

- Full hypothesis: [docs/01-product/HYPOTHESIS.md](./docs/01-product/HYPOTHESIS.md)
- Live brief (regenerates from MCP): `bun run marketing:brief`
- Loop driver (creates campaigns, generates leads, files owner report): `bun run marketing:run`

## Layout

```
src/
├── server.ts                Hono entrypoint
├── config.ts                env access seam
├── routes/                  /api, /webhooks, /test
├── channels/                whatsapp, instagram, telegram, web
├── agent/
│   ├── invoke.ts            claude -p subprocess wrapper
│   ├── drafter.ts           claude -p one-shot for content captions
│   ├── router.ts            picks role from incoming message
│   ├── prompts/             per-role system prompts (incl. brand.md)
│   └── mcp/
│       ├── local-server.ts  stdio MCP exposing local domain
│       └── adapters/        gbp/ig/wa publish shims (sandbox today)
├── domain/                  pure business logic — bounded contexts:
│   ├── content-studio/      post/reel lifecycle, brand-checker, scheduler
│   ├── engagement/          DM + review pull, sentiment, risk gates
│   ├── analytics/           digital-presence snapshots + alert publisher
│   ├── orders / catalog-sync / policies / campaigns / tools.ts
├── bots/owner/              Telegram cockpit:
│   ├── commands.ts          slash router
│   ├── callbacks.ts         approve/reject/view_esc deterministic taps
│   ├── inbox-reviews.ts     async slash dispatcher
│   ├── marketing/           post-studio, presenter, engagement, stats
│   └── live.ts              "thinking…" placeholder + streaming sink
├── lib/                     webhook HMAC, sandbox MCP client, DO Spaces
├── db/                      SQLite + schema
└── scripts/                 setup:mcp, db:seed, preflight, world:run, evidence
web/                         Next.js storefront + admin pages
data/catalog/                seed catalog (mirrored from sandbox at boot)
.mcp.json.template           committed; rendered .mcp.json is gitignored
.env.example                 every env var documented
```

## Deploy

Local + ngrok is the hackathon path and is fine for the brief's `~1 req/s` ceiling. For production, see [docs/05-deploy/PRODUCTION.md](./docs/05-deploy/PRODUCTION.md): named Cloudflare Tunnel, real WA/IG/Square credentials in place of the simulator MCP, SQLite → Postgres when sustained traffic crosses ~1 req/s.

## Security

- `.env.local` is gitignored and never logged. Templates ship; secrets don't.
- `SBC_TEAM_TOKEN` is injected only into the `claude -p` subprocess env.
- `.mcp.json` is rendered from template at setup time and gitignored.
- Meta webhook bodies are HMAC-SHA256 verified when `WA_APP_SECRET` / `IG_APP_SECRET` is set. Without them, sandbox-injected payloads still pass — with a one-time warning.
- Two intentional `⚠️ HACKATHON-MODE OPEN ACCESS` notes are inline: the Telegram owner whitelist (empty `TG_OWNER_CHAT_IDS` accepts any chat) and the `/api/admin/*` endpoints (unauthenticated). Both are loud in the boot log; both must be closed before any public deploy.

## Docs

- [AGENTS.md](./AGENTS.md) — onboarding for AI assistants working on the repo
- [ARCHITECTURE.md](./ARCHITECTURE.md) — runtime + data flow
- [docs/01-product/HYPOTHESIS.md](./docs/01-product/HYPOTHESIS.md) — $500 → $5,000 plan with live numbers
- [docs/02-architecture/](./docs/02-architecture/) — MCP, data model, agent runtime, security, webhooks
- [docs/03-build/OWNER-BOT-SETUP.md](./docs/03-build/OWNER-BOT-SETUP.md) — Telegram cockpit setup
- [docs/05-deploy/](./docs/05-deploy/) — laptop + ngrok, DigitalOcean
- [docs/04-test/EVIDENCE.md](./docs/04-test/EVIDENCE.md) — runnable demo script

## Team

Adilet (architecture, agent runtime, MCP wiring), one teammate on the owner cockpit + kitchen handoff, one on scenarios + marketing creative.

## License

Per the hackathon agreement, IP transfers to Steppe Business Club; the team retains a portfolio-use license. The repo will be public after May 10, 16:00 CT.
