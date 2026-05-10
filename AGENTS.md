# AGENTS.md — entry point for AI assistants working in this repo

If you're a Claude Code session (or any agent) opening this repo cold, **read this first**. It's a one-shot orientation: where things live, what's running, what's changing.

---

## What this repo is

A multi-channel agentic sales system for HappyCake, a family-owned bakery in Sugar Land, TX. Customers reach the bakery on WhatsApp, Instagram, and the website; the owner runs the business from Telegram. One agent — `claude -p` with Opus 4.7 — handles every inbound message. Built on Bun + Hono + TypeScript. No SDKs (`@anthropic-ai/claude-agent-sdk`, LangGraph, CrewAI, etc.) — the runtime is the CLI directly.

If you want full context: read [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md). Brief is in [docs/00-source/BRIEF.md](./docs/00-source/BRIEF.md). Doc tree entry point: [docs/INDEX.md](./docs/INDEX.md).

**For the team's juniors, read in this order:**
1. [docs/02-architecture/MCP.md](./docs/02-architecture/MCP.md) — what each of the 55 sandbox tools does, source-of-truth rules, when to read vs write
2. [docs/02-architecture/DATA-MODEL.md](./docs/02-architecture/DATA-MODEL.md) — what's in our 6 SQLite tables and what's NOT (and why)
3. [docs/02-architecture/AGENT-RUNTIME.md](./docs/02-architecture/AGENT-RUNTIME.md) — the `claude -p` subprocess flow, end-to-end
4. [docs/02-architecture/SECURITY.md](./docs/02-architecture/SECURITY.md) — what the agent can and cannot touch; out-of-scope handling
5. [docs/02-architecture/WEBHOOKS.md](./docs/02-architecture/WEBHOOKS.md) — inbound flows per channel
6. [docs/02-architecture/TECH-STACK.md](./docs/02-architecture/TECH-STACK.md) — what we use and why
7. [docs/05-deploy/DEPLOY.md](./docs/05-deploy/DEPLOY.md) — laptop+ngrok vs droplet tradeoffs
8. [docs/01-product/FEATURES.md](./docs/01-product/FEATURES.md) — what's built / what's left (the matrix)
9. [docs/03-build/BUILD-PLAN.md](./docs/03-build/BUILD-PLAN.md) — T+0 → T+22h critical path

---

## Hard rules

1. **`claude -p` is the agent runtime.** Not the Claude Agent SDK, not LangGraph, not CrewAI. `src/agent/invoke.ts` spawns the CLI subprocess; if you find yourself reaching for an SDK, you're solving the wrong problem.
2. **Owner UI is Telegram, not the website.** The agent surface for the operator is the bot. The website's `/admin/*` pages are an owner Mini-App for shoulder-of-the-road glances; they're not where the agent lives.
3. **Secrets stay out of git.** `.env.local` and `.mcp.json` are gitignored. The committed `.mcp.json.template` uses `${SBC_TEAM_TOKEN}` placeholders. New token? Route it through `src/config.ts` and document it in `.env.example`.
4. **The agent doesn't memorise facts.** Prices, hours, capacity, lead times — every customer-facing fact comes from a tool call at request time. Hardcoded test answers cost the team ten rubric points and a public note in the score-card; `bun run audit:hardcodes` is the grep gate that catches them in CI.

---

## Quick map

| If you want to... | Open |
|---|---|
| Understand the runtime pattern | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Change the agent's behavior in a role | `src/agent/prompts/<role>.md` (concierge / kitchen / marketing / owner) |
| Add a new domain tool the agent can call | `src/domain/tools.ts` (logic) → register in `src/agent/mcp/local-server.ts` (MCP wrapper) → add to role allowlist in `src/agent/allowlists.ts` |
| Add a new channel | new file in `src/channels/`, implement `ChannelAdapter`; register adapter and webhook route in `src/server.ts` |
| Change how the router picks roles | `src/agent/router.ts` |
| Add a SQL table | `src/db/schema.sql`; new query helpers in `src/domain/tools.ts` |
| Run a smoke test | `bun run smoke:agent "your message"` |
| Reset the DB | `rm .data/happycake.db && bun run db:seed` |
| See what tools the sandbox MCP exposes | `claude mcp list` from repo root, or look at the system-init line of any `bun run smoke:agent` (with `--verbose`) |

---

## Working conventions

- **Edit, don't duplicate.** Prefer modifying existing files over creating parallel ones.
- **Trust the seam.** `IncomingMessage` is the contract between channels and the agent. Don't bypass it.
- **One in_progress todo at a time.** Use TodoWrite for non-trivial multi-step work.
- **Smoke before commit.** `bun run typecheck && bun run smoke:agent "..."` should pass.
- **Read [docs/00-source/BRIEF.md](./docs/00-source/BRIEF.md) before debating scope.** It's verbatim from the hackathon page.

## Slash commands available locally

In `.claude/commands/`. Add new ones for repeated workflows. Suggested next:
- `/eval` — runs evaluator MCP scoring across all rubric lines
- `/world-tick` — advances the world scenario one event
- `/scoreboard` — pulls evidence summary + prints diff vs last run

---

## What's the agent doing right now?

Latest agent invocations are in SQLite at `.data/happycake.db`, table `agent_invocations`. To see the last 10:

```bash
sqlite3 .data/happycake.db "SELECT role, thread_id, duration_ms, cost_usd, exit_code FROM agent_invocations ORDER BY created_at DESC LIMIT 10"
```

## When stuck

- `claude -p` errors → check `.mcp.json` exists (run `bun run setup:mcp`), check `SBC_TEAM_TOKEN` is set, check `claude --version` is ≥ 2.0.
- "Invalid MCP configuration: command: expected string" → you tried to use the old SDK-style config; we use `type: "http"` for the sandbox MCP. See [.mcp.json.template](./.mcp.json.template).
- Agent calls `ToolSearch` instead of the tool we want → tool isn't in the role allowlist OR it's not properly registered. Check `src/agent/allowlists.ts` `ROLE_TOOL_ALLOWLIST` and the matching MCP registration.
- Type errors with `bun:sqlite` `.all(...params)` — use literal arg arrays, not `unknown[]` spreads. See examples in `src/domain/tools.ts`.
