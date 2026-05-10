# How `invokeAgent` works — step-by-step for the team

The single most-asked question: *"how does running `claude -p` actually do agentic stuff?"* This walks through it concretely, end to end, with code references.

---

## The picture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  WE OWN THIS PROCESS (Hono server, Bun)                  │
│                                                                          │
│   webhook arrives → onMessage() → invokeAgent({role, msg})               │
│                                          │                               │
│                                          │ spawn child process           │
│                                          ▼                               │
│                       ┌──────────────────────────────┐                   │
│                       │  claude -p ...               │ ◄── stdout (json) │
│                       │  (Claude Code CLI runtime)   │                   │
│                       │                              │                   │
│                       │  ┌────────────────────────┐  │                   │
│                       │  │ Opus 4.7 reasoning loop │  │                   │
│                       │  │  ├ tool call           │  │                   │
│                       │  │  ├ tool result         │  │                   │
│                       │  │  └ next decision...    │  │                   │
│                       │  └────────────────────────┘  │                   │
│                       └────┬─────────────────┬───────┘                   │
│                            │ stdio MCP       │ HTTP MCP                  │
│                            ▼                 ▼                           │
│             ┌─────────────────────┐  ┌──────────────────────┐            │
│             │ src/agent/mcp/      │  │ Sandbox HTTP MCP     │            │
│             │   local-server.ts   │  │ (Steppe Business     │            │
│             │ (child process WE   │  │  Club, X-Team-Token) │            │
│             │  spawn from claude) │  │                      │            │
│             └─────────┬───────────┘  └──────────────────────┘            │
│                       │ SQLite                                           │
│                       ▼                                                  │
│              .data/happycake.db                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Three processes total:
1. **Our server** (`bun src/server.ts`) — Hono, holds webhooks + DB
2. **`claude -p`** — Claude Code CLI, runs the reasoning loop
3. **`local-server.ts`** — our stdio MCP, spawned by Claude Code as a child of itself

The arrows show data flow per request: a webhook fires our server → server spawns `claude -p` → Claude Code spawns `local-server.ts` → both MCPs are reachable → Claude reasons + calls tools → JSON streams back to our server → reply goes to channel.

---

## What a single invocation actually does

This is what happens when [`invokeAgent()`](../src/agent/invoke.ts) is called for a customer message:

### 1. Build the prompt and arg list (microseconds)

```ts
// inside invokeAgent({ role, msg })
const history = trimHistory(loadHistory(msg.threadId))   // last ~12 turns from SQLite
const systemPrompt = readFileSync(`src/agent/prompts/${role}.md`)
const userPrompt = buildPrompt(msg, history)              // wraps history + new msg in tags

const args = [
  '-p', userPrompt,
  '--model', 'claude-opus-4-7',
  '--output-format', 'stream-json', '--verbose',
  '--append-system-prompt', systemPrompt,
  '--allowedTools', 'mcp__local__list_products mcp__happycake__square_list_catalog ...',
  '--disallowedTools', 'Bash Edit Write Read Glob Grep WebFetch WebSearch ...',
  '--max-budget-usd', '2.50',
  '--dangerously-skip-permissions',  // server context — no human to click "allow"
  '--no-session-persistence',         // each call is independent; we manage state
  '--mcp-config', '.mcp.json',
]
```

Why these flags:
- `-p` (`--print`) — non-interactive, prints result and exits. The headless mode the hackathon requires.
- `--model claude-opus-4-7` — pinned per the brief.
- `--output-format stream-json` — we get one JSON event per line as Claude reasons. Without this, we only see the final reply (no tool trace).
- `--append-system-prompt` — adds our role prompt on top of Claude Code's default. Drives behavior.
- `--allowedTools` — whitelist; everything else is denied. Per-role surface containment.
- `--mcp-config .mcp.json` — points at our two MCPs. Without this, Claude has no domain tools.
- `--dangerously-skip-permissions` — necessary because server-side has no human to click allow buttons. Safe because the deny-list keeps the agent away from filesystem/shell.

### 2. Spawn the subprocess (~1 second cold start)

```ts
const child = spawn(config.agent.bin, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    SBC_TEAM_TOKEN: config.sandbox.teamToken,
    SBC_MCP_URL: config.sandbox.mcpUrl,
  },
})
```

Claude Code starts up. It:
1. Reads `~/.claude/` config (the user's Claude Max session — that's where auth comes from, not an env var on our side).
2. Reads our `.mcp.json` (passed via `--mcp-config`).
3. Opens an HTTP connection to the sandbox MCP. Sends the X-Team-Token header.
4. Spawns `bun src/agent/mcp/local-server.ts` as a child of itself, opens stdio.
5. Calls `tools/list` JSON-RPC on both MCPs to learn what tools are available.
6. Builds its system prompt: default Claude Code prompt + our `--append-system-prompt` text.

### 3. Reasoning loop (5-30s typically)

Claude reads the user prompt + system prompt. It decides whether to call a tool or reply directly. If a tool:

```
Claude → "I'll call mcp__local__list_products"
       → emits tool_use block on stdout (JSON)
       → blocks on the MCP's tool_result

local-server.ts reads tool_use over stdin
       → executes listProducts() against SQLite
       → returns { content: [{ type: 'text', text: '[{...}, ...]' }] } over stdout

Claude reads tool_result
       → continues reasoning ("$8.50 for a slice, $55 for whole, ...")
       → either calls another tool or generates a final reply
```

This loop happens INSIDE Claude Code. We don't orchestrate it. We just see the events as they stream out:

```json
{"type":"system","subtype":"init","tools":[...],"mcp_servers":[...]}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"mcp__local__list_products","input":{}}]}}
{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"...","content":[{"type":"text","text":"[{...}]"}]}]}}
{"type":"assistant","message":{"content":[{"type":"text","text":"Yes — honey cake is our signature..."}]}}
{"type":"result","result":"Yes — honey cake is our signature...","total_cost_usd":0.40,"num_turns":2}
```

Every line is one decision. We parse them in our wrapper to extract the final reply text + the tool trace.

### 3a. Brand voice — prompt-prepend for customer-facing roles

The hackathon brand book (`docs/00-source/BRANDBOOK.md` v1.0) mandates a specific voice for customer-facing replies: *HappyCake* (one word, two capitals), *cake "Honey"* format for products, soft CTA close, three-emoji cap, no fabrication, English-only.

We enforce this by prepending `src/agent/prompts/brand.md` (a condensed, runtime-shaped subset of the brand book) to the system prompt for **customer-facing roles only**:

```ts
// src/agent/invoke.ts loadPrompt
const BRAND_ROLES: AgentRole[] = ['concierge', 'marketing']
const role_md = readFileSync(`src/agent/prompts/${role}.md`)
if (!BRAND_ROLES.includes(role)) return role_md
const brand_md = readFileSync('src/agent/prompts/brand.md')
return `${brand_md}\n\n---\n\n${role_md}`
```

Internal roles (`kitchen`, `owner`) skip the prepend — operator surfaces are exempt. This keeps the customer voice consistent across web/WA/IG without polluting the owner cockpit's terse, numerate voice.

`brand.md` is condensed from the canonical `BRANDBOOK.md`. **Refresh both together** when brand rules change.

### 3b. Streaming — `onStream` callback for live UX

`claude -p --output-format stream-json` emits one JSON event per assistant turn or tool round-trip — not per token, but real-time-ish per step. We expose those events via an optional `onStream` callback in `InvokeOptions`:

```ts
export type StreamEvent =
  | { kind: 'text'; chunk: string; running: string }
  | { kind: 'tool_start'; name: string }
  | { kind: 'tool_end'; name: string }
  | { kind: 'done'; final: string }

interface InvokeOptions {
  role: AgentRole
  msg: IncomingMessage
  mcpConfigPath?: string
  timeoutMs?: number
  onStream?: (event: StreamEvent) => void  // ← new
}
```

`invoke.ts` is line-buffered (was full-buffered until close), so each stdout line is parsed and dispatched as it arrives. The owner Telegram bot uses this to live-edit a "🤔 thinking…" placeholder via `editMessageText`:

```
🤔 thinking…              ← initial placeholder
🛠 calling kitchen_get_capacity…
🤔 Tomorrow looks tight on whole honey
🛠 calling list_orders…
Tomorrow looks tight — already at 9/12 with 3 drafts pending. Pistachio open.

— used: kitchen_get_capacity, list_orders · 12.3s · $0.18
```

Throttled to ≤ 1 edit / 800ms (TG soft per-chat limit ~1/sec). Identical-text edits skipped (TG rejects). This is the "Streaming Text for Bots" UX from Telegram's May 2026 update — no new API method required.

See [src/bots/owner/live.ts](../../src/bots/owner/live.ts) `makeOwnerStreamSink` for the throttle implementation.

### 4. Process exit + persistence

When `claude -p` finishes (or hits `--max-budget-usd`, or our 90s timeout), it exits. Our wrapper:

```ts
child.on('close', (code) => {
  // stdout has accumulated all the JSON events
  // parse them line-by-line, extract reply + tool_calls + cost
  // save:
  saveHistory(msg.threadId, msg.channel, [...history, {role:'user', content:msg.text}, {role:'assistant', content:reply}])
  logInvocation({ role, thread_id, duration_ms, cost_usd, exit_code })
  // return AgentResult to onMessage caller
})
```

Total round trip: typically 10–15s for a single tool call, 20–40s if the agent needs 3-4 tools.

---

## Why this satisfies the brief

The hackathon rule:
> *"Agents must run on Claude Code CLI with Opus 4.7. Submissions that route through Claude Agent SDK ... are disqualified."*

We literally `spawn('claude', ['-p', ...])` with `--model claude-opus-4-7`. There is no SDK import. The reasoning loop runs **inside** Claude Code, not in our process. Our process is a thin shell that:

- Decides which role to invoke
- Builds the prompt
- Spawns the subprocess
- Parses the JSON output
- Persists to SQLite

The "agentic" part — multi-turn reasoning, tool calls, retries — is entirely inside Claude Code. That's exactly the pattern the brief prescribes.

---

## Auth — where the API key actually lives

We do **not** pass an API key when spawning `claude -p`. Claude Code uses the user's Claude Max session, which is stored in `~/.claude/` after one-time interactive login (`claude` command, OAuth flow). When `claude -p` runs, it reads that session and authenticates Anthropic API calls under the hood.

This is why the brief says "Active Claude Max subscription" — the entire 24h spend goes against the team's Max plan. We never touch `ANTHROPIC_API_KEY`.

If we wanted to switch to API key (e.g., for CI), we'd set `ANTHROPIC_API_KEY` in the env and Claude Code would use it instead. But for this hackathon, Max is the model.

---

## Cost & latency budget

Per smoke test: ~10-15s, ~$0.40 for a simple "what cakes do you have" → 1 tool call → reply.

Multi-turn order flow (list_products → check_constraints → create_draft_order → escalate): ~30-40s, ~$1.00.

Owner approval flow with sandbox writes (square_create_order + kitchen_create_ticket): ~25s, ~$0.80.

**24-hour budget at moderate volume:** $30-60. The team's Claude Max covers it.

---

## What we did NOT have to write

This is the magic of running on Claude Code:

- ❌ No reasoning loop (Opus 4.7 owns it)
- ❌ No tool dispatcher (Claude Code owns it)
- ❌ No streaming JSON parser at protocol level (we just split on newlines)
- ❌ No retry logic (Claude Code retries internally on transient errors)
- ❌ No prompt-caching layer (Claude Code uses it automatically per session)
- ❌ No model-fallback (we pin Opus, no fallback wanted)

We wrote: ~200 lines of `invoke.ts` + ~150 lines of MCP server + 4 prompt files. Everything else is Claude Code doing its job.

---

## Frequently asked debugging questions

**"It's slow."** First call is always cold (Opus warmup + MCP handshake). Steady-state is faster. If consistently >30s for simple cases, check `--max-budget-usd` isn't capping mid-reasoning.

**"It said `(empty)` and exited 0."** Usually means Claude reached a turn limit without producing text. Inspect the stream-json: if the last event is a `tool_use` not followed by `assistant text`, the agent ran out of budget mid-reasoning. Bump `--max-budget-usd`.

**"It's calling `ToolSearch` instead of my tool."** ToolSearch is a Claude Code internal that hydrates deferred MCP tool schemas. It's used when there are too many tools. It's harmless — the actual tool gets called next turn. Filter it out of the trace (we already do).

**"My MCP tool isn't being seen."** Check three things:
1. The tool is registered in `local-server.ts` with `server.registerTool('name', ...)` (or in the sandbox tool list).
2. The full name `mcp__<server>__<tool>` is in the role's `ROLE_TOOL_ALLOWLIST` in `src/agent/allowlists.ts`.
3. `bun run setup:mcp` was run after the last template change.

**"It exited with `Invalid MCP configuration`."** `.mcp.json` is missing or has a wrong shape. Run `bun run setup:mcp`. Check the `_doc` field has been stripped (the rendered JSON shouldn't have it).

**"The cost number is missing."** Stream-json emits `total_cost_usd` only on the final `result` event. If the process timed out, you won't see it. Cost stays `null` in `agent_invocations`.
