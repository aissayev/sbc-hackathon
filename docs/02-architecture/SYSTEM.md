# System diagram

One picture + a paragraph per box. The full prose lives in [`/ARCHITECTURE.md`](../../ARCHITECTURE.md); this is the cheat sheet.

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

## Boxes (one paragraph each)

**Channels (top row).** Five inbound surfaces normalize to `IncomingMessage` (`src/channels/types.ts`). WA, IG, Telegram are real or simulator-driven; Web is in-process; World scenario events arrive via a poller that calls `world_next_event` and dispatches them as if they were a real channel.

**Hono server (middle box).** Single process. Normalizes inbound, writes to SQLite, runs `router.ts` to stamp the role, then awaits `invokeAgent()`. For web chat this is synchronous (streams SSE back). For other channels it returns 200 immediately and resolves outbound via the channel adapter.

**`router.ts`.** Pure function. `(channel, senderId, body) → role`. Telegram message from `TG_OWNER_CHAT_ID` → `owner`. Telegram body starting with `/kitchen|/marketing|/owner|/approve|/reject` → that role. Everything else → `concierge`.

**`invokeAgent()` (`src/agent/invoke.ts`).** Spawns `claude -p` as a Node child process with role-scoped `--allowedTools`, `--mcp-config`, `--append-system-prompt` (the role prompt file), `--output-format stream-json`. Reads NDJSON events line-by-line, parses tool_use/tool_result/result events, returns `{ reply, tool_calls, duration_ms, cost_usd }`. Logs every invocation to the `agent_invocations` table.

**`claude -p` (the agent runtime).** Connects to both MCPs configured in `.mcp.json`, sends the prompt to Opus 4.7, executes tool calls, returns the final text. Stateless per call; we feed history via the prompt.

**Sandbox MCP (`happycake`).** Hosted at `https://www.steppebusinessclub.com/api/mcp`. Per-team isolated state via `X-Team-Token` header. Provides 55 tools across 8 namespaces. Source of truth for catalog, kitchen state, marketing actions, and simulated customer traffic.

**Local MCP (`local`).** Stdio subprocess (`src/agent/mcp/local-server.ts`). Owns our durable state that the sandbox doesn't track: drafts pending owner approval, conversation threads with full history, the owner-side escalation queue, the daily-report renderer.

**SQLite (`.data/happycake.db`).** Bottom-right of the diagram. Tables: `products` (mirror), `threads`, `orders`, `escalations`, `leads`, `campaigns`, `agent_invocations`. Schema in `src/db/schema.sql`; details in [DATA-MODEL.md](./DATA-MODEL.md).

## Data flow — one customer message

1. Customer sends "honey cake?" on WhatsApp.
2. Sandbox WA webhook POSTs to our public URL.
3. Hono `/webhooks/whatsapp` verifies HMAC, normalizes, persists thread, returns 200.
4. Inline (or via in-process queue) the message goes to `invokeAgent({ role: 'concierge', msg })`.
5. `claude -p` spawns. Reads catalog via `square_list_catalog`. Checks capacity via `kitchen_get_capacity`. Crafts brand-voice reply.
6. `claude -p` calls `whatsapp_send` to the simulator with the reply.
7. We also save the assistant turn to `threads` and write an `agent_invocations` row.
8. Subprocess exits. Hono logs the run to stdout for tail-debugging.

## Data flow — owner approval

1. Concierge tool call: `escalate_to_owner` (local MCP).
2. Local MCP writes an `escalations` row + posts to `@hc_owner_bot` via Telegram HTTP.
3. Owner taps `[Approve]`. Telegram poller picks up the callback_query.
4. `router.ts` sees the inline button payload → role=`owner`, action=`approve_order`.
5. `invokeAgent` runs the owner role with the approval context.
6. Owner agent calls local MCP `approve_order` → updates `orders.status`. Calls `kitchen_create_ticket`.
7. Reply posts back to the customer on the original channel.
