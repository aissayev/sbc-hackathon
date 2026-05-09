# Agent SDK retrofit — post-hackathon migration path

## Why we're not using the SDK today

The hackathon brief ([docs/HACKATHON_BRIEF.md](./HACKATHON_BRIEF.md)) explicitly disqualifies submissions that use the Claude Agent SDK:

> *"Submissions that route through Claude Agent SDK, a different LLM provider, a different framework, or expose any non-Telegram owner UI are disqualified."*

So today, the agent runtime is `claude -p` (Claude Code CLI in headless mode), invoked as a subprocess for every event. See [HOW-INVOKE-WORKS.md](./HOW-INVOKE-WORKS.md).

## What changes after the hackathon

For real production, **the Agent SDK is what you'd reach for.** It gives you:

- **In-process execution.** No subprocess spawn cost (~1s per call).
- **Streaming responses** that we can pipe directly into HTTP / Telegram.
- **Tighter integration with our TypeScript types** — tool schemas come from Zod, results come back as typed objects.
- **Lower per-call cost** — no Claude Code overhead.
- **Production deployability** — runs as a Node/Bun service, scales horizontally.

## The migration is small

The seam we built is designed to make this easy. Concretely:

1. **`src/agent/invoke.ts`** is the only file that does process-spawning. Replace `spawn('claude', [...])` with the SDK's `query({ prompt, options })`. Everything that calls `invokeAgent()` keeps working.
2. **`src/agent/mcp/local-server.ts`** stays the same — it's just an MCP server. The SDK can mount it via `mcpServers: { local: { command: 'bun', args: [...] } }`.
3. **`.mcp.json`** structure for HTTP MCPs remains compatible; the SDK's `mcpServers.<name>.url + headers` config maps 1:1.
4. **Role prompts and tool allowlists** stay in the same shape (`src/agent/prompts/*.md`, `ROLE_TOOL_ALLOWLIST` map).

Estimated migration time: **2–3 hours**, including re-running the smoke + eval suites.

## What does NOT change

- The architecture. The 4-agent decomposition (concierge / kitchen / marketing / owner) is identical.
- The data model. SQLite tables don't move.
- Channel adapters. WA / IG / TG / Web stay as-is.
- Routes. `/api/chat`, `/test/incoming`, `/webhooks/*` — unchanged.

## Auth model after migration

`claude -p` uses Claude Max (interactive login). The Agent SDK uses `ANTHROPIC_API_KEY` directly. To migrate cleanly:

1. Provision an org-scoped API key in the Anthropic Console.
2. Set `ANTHROPIC_API_KEY` in the deployment env.
3. Remove the `--max-budget-usd` flag (SDK has its own cost-cap mechanism).
4. Optionally adopt the `prompt_caching: true` option to amortize the system prompt across calls — meaningful savings at production volume.

## Practical cutover sequence

1. Branch `main` → `feat/sdk-migration`.
2. Replace `src/agent/invoke.ts` body with SDK call. Keep the same `AgentResult` return shape.
3. Run `bun run smoke:agent "..."` — should pass with same brand-voiced output.
4. Run `bun run evidence` — should produce same evaluator scores (give or take small variance).
5. Deploy to staging; run scenarios for a day; promote.

That's it. The seam protects us; the rest is just swapping engines.
