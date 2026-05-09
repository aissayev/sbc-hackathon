# AGENTS.md — entry point for AI assistants working in this repo

If you're a Claude Code session (or any agent) opening this repo cold, **read this first**. It's calibrated for one-shot orientation: where things live, what's running, what's changing.

---

## What this repo is

Hackathon entry: Happy Cake US multi-channel agentic sales system. Built on Bun + Hono + TypeScript. The agent runtime is `claude -p` (Claude Code CLI, Opus 4.7) — **not** the Claude Agent SDK (banned by the hackathon rules).

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

## Hard rules you must respect

1. **No Claude Agent SDK.** No `@anthropic-ai/claude-agent-sdk`, no `langgraph`, no `crewai`, no other LLM provider. The agent runtime is `src/agent/invoke.ts` which spawns `claude -p`. If you find yourself reaching for an SDK, you're solving the wrong problem.
2. **Owner UI is Telegram only.** No web admin pages, no email digests. Customer-facing web (catalog, `/api/chat`) is fine — that's not owner-facing.
3. **No secrets in git.** `.env.local`, `.mcp.json` are gitignored. The committed `.mcp.json.template` uses `${SBC_TEAM_TOKEN}` placeholders. If you write a feature that needs a token, route it through `src/config.ts` and document the var in `.env.example`.
4. **No hardcoded test answers.** -10 points and a public note. If you're writing scenarios for evals, the agent's reply must be agent-generated, not pattern-matched on scenario tags.

---

## Quick map

| If you want to... | Open |
|---|---|
| Understand the runtime pattern | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Change the agent's behavior in a role | `src/agent/prompts/<role>.md` (concierge / kitchen / marketing / owner) |
| Add a new domain tool the agent can call | `src/domain/tools.ts` (logic) → register in `src/agent/mcp/local-server.ts` (MCP wrapper) → add to role allowlist in `src/agent/invoke.ts` |
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
- Agent calls `ToolSearch` instead of the tool we want → tool isn't in the role allowlist OR it's not properly registered. Check `src/agent/invoke.ts` `ROLE_TOOL_ALLOWLIST` and the matching MCP registration.
- Type errors with `bun:sqlite` `.all(...params)` — use literal arg arrays, not `unknown[]` spreads. See examples in `src/domain/tools.ts`.
