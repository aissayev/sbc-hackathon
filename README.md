# Happy Cake US — agentic multi-channel sales

Built for the **Steppe Business Club "Agentic AI for Real Business" hackathon** (May 9–10 2026, $4,500 prize, 100% AI-judged).

The product: a working sales engine for Happy Cake US — a real Sugar Land, TX bakery doing $15–20K/month walk-in only. We turn its WhatsApp + Instagram + website into 24/7 sales channels, with the owner (Askhat) running everything from Telegram.

## Hard runtime constraints (per brief)

- **Agent runtime:** Claude Code CLI with **Opus 4.7** only. No Claude Agent SDK, no LangGraph, no other LLM provider.
- **Owner UI:** Telegram bot(s) only. No web dashboard, no email.
- **Per-event pattern:** webhook → bot wrapper → `claude -p` (headless mode) → reply back to channel.

We comply with all three. See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Quick start (fresh clone)

```bash
# 1. install
bun install

# 2. configure
cp .env.example .env.local
# fill in: SBC_TEAM_TOKEN (from your team's sandbox dashboard),
#         TG bot tokens, WA/IG creds if exercising real channels

# 3. render MCP config from template (substitutes SBC_TEAM_TOKEN)
bun run setup:mcp

# 4. initialize SQLite + seed Happy Cake catalog
bun run db:seed

# 5. smoke-test the agent end-to-end
#    (spawns claude -p, calls MCP tools, returns reply)
bun run smoke:agent "do you have chocolate cake?"

# 6. start the server (Hono on :3000)
bun run dev

# 7. (canonical sandbox flow) start a tunnel + register your public URL
#    so the sandbox can POST WA/IG inbound to /webhooks/*
ngrok http 3000             # in a separate terminal — copy the https URL
bun run register-webhooks https://<your-ngrok>.ngrok-free.app
bun run webhooks:status     # confirm registration + see threads
```

The webhook registration step is what makes the sandbox push events to us — exactly the flow the brief specifies (*"Customer messages tunnel into the computer through ngrok or Cloudflare Tunnel, hits the agent's bot wrapper, which calls `claude -p`."*). Without it, sandbox-driven scenarios run in pull mode via `bun run world:run` (deterministic, useful for offline testing) but the eval's webhook-push path is dark.

Smoke output should look like:

```
[smoke] role=concierge thread=smoke_...
───────── reply ─────────
Yes — our Chocolate Layer Cake (8"), $52, needs 24h notice. Want one?
───────── trace ─────────
tools called: 1
  • mcp__local__list_products
duration: ~11s
cost: ~$0.40
```

If you see `(empty)` and `Invalid MCP configuration`, run `bun run setup:mcp` again.

## What's wired

| Surface | Status | How to verify |
|---|---|---|
| `claude -p` headless agent runtime | ✅ live | `bun run smoke:agent "..."` |
| Sandbox MCP (Square / WhatsApp / IG / Kitchen / Marketing / World / Evaluator / GoogleBusiness) | ✅ connected via `.mcp.json` (HTTP, X-Team-Token) | `claude mcp list` from repo root |
| Local stdio MCP (drafts, threads, escalations, daily report) | ✅ live | `bun run mcp:local` |
| Web `/api/chat` | ✅ live | `curl -X POST localhost:3000/api/chat -d '{"text":"hi"}'` |
| Public catalog: `/api/products`, `/api/products/:id`, `/llms.txt` | ✅ live | `curl localhost:3000/api/products` |
| `/test/incoming` evaluator entrypoint | ✅ live | accepts `IncomingMessage` shape, returns reply + tool trace |
| 4 role agents: concierge, kitchen, marketing, owner | ✅ prompts in `src/agent/prompts/` | role picked by `src/agent/router.ts` |
| WhatsApp / Instagram / Telegram webhooks | ⏳ porting | next step |
| Re-skinned website (HTML pages) | ⏳ pending | next step |

## Hypothesis: $500 → $5,000

Filled at T+0 after reading sandbox sales CSV via `marketing_get_sales_history`. Lives in [docs/01-product/HYPOTHESIS.md](./docs/01-product/HYPOTHESIS.md). Spec:
- Margin per SKU computed from POS catalog + cost basis
- $500/month allocated across Meta / Google / boosted / organic with margin-backed expected return per dollar
- Loop: read campaign metrics → kill underperformers → reinvest

## Submission checklist progress

- [x] Public Git repo skeleton
- [x] Fresh-clone setup instructions (this README)
- [x] [ARCHITECTURE.md](./ARCHITECTURE.md) (agents, routing, MCP usage)
- [x] `.env.example` with placeholders, no secrets
- [x] Agent runtime is `claude -p` only — no banned SDKs
- [x] Owner UI is Telegram only — no web admin
- [ ] Marketing $500→$5,000 hypothesis from real CSV
- [ ] On-site assistant test script (consultation, custom, complaint, status, escalation)
- [ ] Marketing/channel/POS/kitchen scenarios documented
- [ ] Evidence of tests / smoke checks / scripted demos
- [ ] Production-deploy notes for the website
- [ ] Real-adapter path documented (no creds in repo)

## Repo layout

```
src/
├── server.ts                 ← Hono entrypoint, route registration
├── config.ts                 ← single env-access seam
├── lib/env.ts                ← .env.local loader
├── routes/                   ← /api, /webhooks, /test (mounted by server)
├── channels/                 ← whatsapp/instagram/telegram/web adapters
├── agent/
│   ├── invoke.ts             ← claude -p subprocess wrapper (the agent runtime)
│   ├── router.ts             ← picks role from incoming message
│   ├── prompts/              ← per-role system prompts
│   └── mcp/local-server.ts   ← stdio MCP exposing our domain
├── domain/tools.ts           ← pure business logic (orders, constraints, escalations)
├── bots/                     ← Telegram bot wrappers (one per role)
├── db/                       ← SQLite + schema + thread/order persistence
└── scripts/                  ← setup:mcp, db-init, smoke-agent, world:start, evidence
data/
├── catalog/                  ← Happy Cake US seed catalog (until sandbox sync)
└── photos/                   ← asset pack
.mcp.json.template            ← MCP config template (committed, no secrets)
.mcp.json                     ← rendered config (gitignored, includes token)
.env.example                  ← all env vars documented
.env.local                    ← local secrets (gitignored)
```

## Security

- `.env.local` gitignored, never logged.
- `SBC_TEAM_TOKEN` injected only into the `claude -p` subprocess env.
- `.mcp.json` rendered from template at setup time and gitignored. Only the template ships.
- Pre-commit grep gates planned (`bun run preflight`).

## Documentation

Full doc tree at [docs/INDEX.md](./docs/INDEX.md). Key entry points:

- [docs/01-product/FEATURES.md](./docs/01-product/FEATURES.md) — feature × status × owner matrix
- [docs/01-product/RUBRIC.md](./docs/01-product/RUBRIC.md) — 100-pt judging coverage
- [docs/03-build/BUILD-PLAN.md](./docs/03-build/BUILD-PLAN.md) — T+0 → T+22h critical path
- [docs/03-build/CHECKLIST.md](./docs/03-build/CHECKLIST.md) — submission checklist
- [docs/05-deploy/DEPLOY.md](./docs/05-deploy/DEPLOY.md) — laptop + ngrok (canonical)

## Post-hackathon production path

The 24-hour build runs on the operator's laptop with `claude -p` against the team's Claude Max subscription, exactly as the brief prescribes. When this becomes the real Happy Cake system, the path is a dedicated droplet, named Cloudflare Tunnel, real WA/IG/Square credentials in place of the simulator MCP, and a SQLite→Postgres migration once sustained traffic exceeds ~1 req/s. See [docs/05-deploy/PRODUCTION.md](./docs/05-deploy/PRODUCTION.md). Out of scope for the hackathon submission.

## Team

- **Adilet** — architecture, agent runtime, MCP wiring
- **Owner-side teammate** — Telegram bots, operator UX, kitchen handoff
- **Customer-side teammate** — scenarios, conversation testing, marketing creatives

## License

Per hackathon agreement: full IP transfers to Steppe Business Club; team retains portfolio-use license. Repo will be public after May 10 16:00 CT.
