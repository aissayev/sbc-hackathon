# Webhook flows — inbound per channel

Every inbound message ends up in the same shape (`IncomingMessage`). What differs is how it arrives.

```ts
type IncomingMessage = {
  channel: 'web' | 'whatsapp' | 'instagram' | 'telegram' | 'world'
  threadId: string        // (channel, externalThreadId)
  senderId: string
  senderName?: string
  text: string
  timestamp: number
  meta?: Record<string, unknown>
}
```

---

## 1. WhatsApp — `POST /webhooks/whatsapp`

Both real Meta Cloud API and sandbox `whatsapp_inject_inbound` send the same shape.

```
Meta / sandbox WA simulator
   │ POST { entry:[{ changes:[{ value:{ messages:[{ from, text:{body}, id }] } }] }] }
   ▼
Cloudflare Tunnel / ngrok
   │
   ▼
Hono /webhooks/whatsapp
   1. Verify X-Hub-Signature-256 (HMAC over raw body, key = WA_APP_SECRET)
      → 401 on mismatch
   2. Verify the WA verify token (initial registration only)
   3. Idempotency: hash messages[0].id, skip if seen in last 10 min
   4. Normalize → IncomingMessage { channel: 'whatsapp', threadId: from, ... }
   5. Persist to threads table
   6. Ack 200 OK ← Meta requires <5s response
   │
   ▼ (async)
invokeAgent({ role: 'concierge', msg })
   │
   ▼
spawn claude -p ... → tool calls → reply text
   │
   ▼
Outbound: claude -p calls whatsapp_send via MCP, OR
          our wrapper calls the channel adapter directly
   │
   ▼
Customer's WA thread receives the reply
```

Real WA registration: send the public URL via `whatsapp_register_webhook` MCP after the tunnel is up.
Synthetic traffic: evaluator calls `whatsapp_inject_inbound` — same path.

## 2. Instagram — `POST /webhooks/instagram`

Same pattern as WhatsApp; signatures and idempotency identical. Inbound types include DMs, comments, and post-replies.

```
Meta IG / sandbox IG simulator
   │ POST { entry:[{ messaging:[{ sender:{id}, message:{text} }] }] }
   ▼
Hono /webhooks/instagram
   1. Verify HMAC
   2. Branch on type:
        - DM (entry[].messaging) → IncomingMessage { channel: 'instagram', threadId: sender.id }
        - Comment (entry[].changes) → IncomingMessage with meta.commentId for reply tool
        - Mention (entry[].changes.field=mentions) → same shape
   3. Ack 200
   │
   ▼ (async)
invokeAgent({ role: 'concierge', msg })
   │
   ▼
Outbound depends on type:
   - DM reply: instagram_send_dm
   - Comment reply: instagram_reply_to_comment
```

## 3. Telegram — long-polling per bot (no webhook)

Each bot runs a poller that calls `getUpdates` and yields events. Avoids needing a public URL for Telegram itself (we keep the tunnel for WA/IG).

```
src/channels/telegram-poller.ts (one per bot token)
   │
   ▼ every 1s while pendingOffset
   GET https://api.telegram.org/bot<token>/getUpdates?offset=<lastSeen>&timeout=25
   │
   ▼
Update events:
   - message → IncomingMessage { channel: 'telegram', threadId: chat.id, senderId: from.id }
   - callback_query → IncomingMessage { meta: { callback: data } } — used for approval taps
   │
   ▼
router.ts:
   - chat.id == TG_OWNER_CHAT_ID         → role='owner'
   - text.startsWith('/kitchen ')        → role='kitchen'
   - text.startsWith('/marketing ')      → role='marketing'
   - callback_query data == 'approve:*'  → role='owner', action='approve_order'
   - else                                 → role='concierge' (passive log)
   │
   ▼
invokeAgent → reply via sendMessage HTTP
```

Four bots = four poller processes (or one process with four pollers; current code does the latter).

## 4. Web — `POST /api/chat` (synchronous SSE)

Different from the others: this one streams.

```
Browser (assistant-ui island, useChat)
   │ POST /api/chat { threadId, messages:[...] }
   │ Accept: text/event-stream
   ▼
Hono /api/chat
   1. Validate body (Zod)
   2. Load history from threads table
   3. Open SSE response (Content-Type: text/event-stream)
   4. spawn claude -p ... --output-format stream-json
   5. Read child stdout line-by-line:
      - {type:'assistant', content:[{type:'text', text:'...'}]}    → SSE: 'data: {"type":"text-delta","delta":"..."}'
      - {type:'assistant', content:[{type:'tool_use', name, input}]} → SSE: 'data: {"type":"tool-call",...}'
      - {type:'user',     content:[{type:'tool_result', ...}]}      → SSE: 'data: {"type":"tool-result",...}'
      - {type:'result', result, total_cost_usd}                     → SSE: end
   6. Persist assistant turn to threads
   │
Browser sees streaming text + tool cards in real time.
```

## 5. World scenario — internal poller

No external HTTP. A worker drives the simulated business day.

```
bun run world:start { scenarioId: "launch-day-revenue-engine" }
   │
   ▼
World poller (in worker process):
   loop while scenario active:
     events = await mcp.world_next_event()  // returns 0..N events due now
     for event in events:
       msg = normalize(event)               // map to IncomingMessage
       persist to threads
       invokeAgent({ role: routeFor(event), msg })
     sleep 10s
   │
   ▼
At end:
   summary = await mcp.world_get_scenario_summary()
   score = await mcp.evaluator_score_world_scenario()
   write to evidence/scenario-<timestamp>.json
```

## Webhook registration script

`bun run register-webhooks` (TBD) idempotently calls:

```ts
await mcp.whatsapp_register_webhook({ url: `${PUBLIC_URL}/webhooks/whatsapp` })
await mcp.instagram_register_webhook({ url: `${PUBLIC_URL}/webhooks/instagram` })
```

Run after every tunnel start. Otherwise the simulator can't deliver inbound to us.

## Idempotency + replays

The evaluator may replay events to test idempotency.

- Hash `(channel, externalMessageId)` and store in SQLite for 30 min.
- On second arrival within that window: short-circuit with 200 OK + log a `replayed_idempotency` event.
- Tool calls on the agent side are not idempotent by default — only the inbound is. Side effects (orders, tickets) are guarded by `(thread, message_id)` locks in the `orders` table.

## Failure modes + mitigations

| Failure | Mitigation |
|---|---|
| Tunnel restarts, URL changes | Re-run `register-webhooks`; named tunnel for stability |
| `claude -p` exit non-zero | Caught in invoke.ts, logged, channel adapter returns brand-voice apology |
| `claude -p` exceeds 90s timeout | SIGTERM, error reply, `agent_invocations.error` populated |
| Sandbox MCP 5xx | Retry with backoff; if still failing, escalate to owner Telegram with raw error |
| SQLite locked | WAL mode is on; retry once after 50ms |
