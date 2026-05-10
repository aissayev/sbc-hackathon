# Owner bot — setup + run

The operator's Telegram bot. Three lanes, one chat:

| Input | Path | Cost | Latency |
|---|---|---|---|
| Slash command (`/today`, `/orders`, `/escalations`, `/reset`, `/help`) | `handleOwnerCommand` → SQLite read → reply | $0 | ~50ms |
| Inline-keyboard tap (`approve:`, `reject:`, `view_esc:`) | `handleOwnerCallback` → `approveDraftAndPromote` → Square + Kitchen | $0 | ~1–2s |
| Free text ("how's the kitchen tomorrow?") | `claude -p` with owner role + tools, live "🤔 thinking…" placeholder edited with reply + tool footer | Claude Max | ~8–15s |

Free-text turns feel like Claude Code in chat: typing indicator, live placeholder, tool/cost trace beneath the reply.

## 1. Create the bot

1. Open Telegram → message `@BotFather`
2. `/newbot` → display name `HappyCake Operator` → username ending in `bot` (e.g. `happycake_operator_bot`)
3. BotFather returns a token like `123456789:ABC...`. Keep it private — never commit, never paste in screenshots.
4. (Optional, recommended) `/setdescription`, `/setabouttext`, `/setuserpic` so the bot looks real.
5. (Recommended) `/setcommands` and paste:
   ```
   today - today's numbers
   orders - last 10 orders + approve
   escalations - open escalations
   reset - clear conversation context
   help - show commands
   ```
6. Repeat for kitchen / marketing / concierge bots if you want the multi-bot fan-out.

## 2. Get your chat id

Message `@userinfobot` on Telegram. It replies with your numeric id (e.g. `987654321`). That's `TG_OWNER_CHAT_ID`. The bot only listens to this chat — strangers messaging the bot are dropped server-side.

## 3. Paste tokens into `.env.local`

```
TG_OWNER_BOT_TOKEN=123456789:ABC...
TG_OWNER_CHAT_ID=987654321
TG_KITCHEN_BOT_TOKEN=...        # optional
TG_MARKETING_BOT_TOKEN=...      # optional
TG_CONCIERGE_BOT_TOKEN=...      # optional, log-only
```

## 4. Start the server

```bash
bun run dev
```

That's it. The Hono server boots, starts a long-poll per configured TG bot, and routes:

- slash commands → `handleOwnerCommand` → instant DB-backed reply
- inline-keyboard taps → `handleOwnerCallback` → deterministic orchestration
- everything else → owner agent via `claude -p`

⚠ Don't run `bun run dev` AND `bun src/scripts/owner-bot.ts` (the legacy standalone) at the same time — Telegram allows one consumer per token, they'll fight for updates. The server-integrated path is the canonical one now; the standalone exists for iteration only.

## 5. Smoke

In Telegram, message your owner bot:

| You type | Bot replies |
|---|---|
| `/help` | command menu |
| `/today` | today's orders, revenue, pending approvals, escalations + `[📋 Orders] [⚠ Escalations]` buttons |
| `/orders` | last 10 orders + one-tap approve for the most recent draft |
| `/escalations` | open escalations as inline-keyboard cards |
| `/reset` | clears conversation history (next free-text turn starts fresh) |
| (tap "✓ Approve") | draft promoted to sandbox Square + Kitchen, confirm message |
| (tap "✗ Reject") | order marked rejected |
| `how's the kitchen tomorrow?` | "🤔 thinking…" placeholder, then full agent reply with `— used: kitchen_summary, list_orders · 12.3s · $0.18` footer |

Then trigger an auto-card by creating a draft from the customer side:

```bash
bun run agent:concierge "I want a whole honey cake for tomorrow at 4pm pickup, my name is Maria"
```

The TG owner chat should immediately receive:

```
New draft order ord_abc123…
Total: $52.00
Customer: Maria
Pickup: 2026-05-10T16:00
[✓ Approve]  [✗ Reject]
```

Tap Approve → confirmation with `Square: sq_…` + `Kitchen: tkt_…`.

## 6. Mini App menu button (optional but nice)

Telegram bots can have a button next to the message input that opens a
Web App inside the chat. Ours opens the `/admin` cockpit (orders, threads,
posts queue, reviews) — same UI a customer would never see.

### One-time setup

You need a public HTTPS URL that serves the web frontend. In dev that's
typically an ngrok tunnel pointing at the Next.js port; in prod it's
whatever domain you've put the site on. Then:

```bash
bun run tg:menu https://your-tunnel.ngrok-free.app
# or
bun run tg:menu https://happycake.flowleads.dev
```

The script:
- Calls `setChatMenuButton` on each configured TG bot token, pointing at
  `<URL>/admin`. The button label is per-role (`🎂 HappyCake`, `🎂 Kitchen`,
  `🎂 Marketing`).
- Calls `setMyCommands` so the `/` autocomplete menu shows the right slash
  commands per role (no more BotFather pasting).

Idempotent. Re-run when the tunnel URL changes or you add a new bot.

### What the user sees

1. Open the bot in Telegram → there's a `🎂 HappyCake` button next to the
   message input (replacing the default `/` menu button).
2. Tap it → the Mini App opens inside Telegram, fills the screen, and
   loads `/admin`.
3. The Mini App SDK injects signed `initData`; our `TgAppProvider` patches
   `fetch` to attach `X-Telegram-Init-Data` to every `/api/admin/*` call
   so the backend can verify it without a separate login.

If the button doesn't appear in the bot chat, force-restart Telegram (it
caches the menu config aggressively) and pull-to-refresh the chat.

## 7. Failure modes

- **`TG_OWNER_BOT_TOKEN not set`** — paste it into `.env.local`, restart `bun run dev`.
- **`getUpdates failed: Conflict: terminated by other getUpdates request`** — two pollers are running on the same token. Stop one (`bun run dev` or the standalone `bun src/scripts/owner-bot.ts`).
- **Approve fails at `square_create`** — `SBC_TEAM_TOKEN` missing or sandbox rate-limit. Check `.mcp.json`. Re-tap is idempotent.
- **`/today` shows zero data** — your local SQLite is fresh; run `bun run smoke:agent "test order"` or any flow that creates a draft.
- **Free-text reply never lands, "thinking…" stays forever** — check `bun run dev` logs for an `agent error`. The next message will work; the dead placeholder can be ignored.

## 8. Streaming behaviour (free-text turns)

Free-text owner turns feel like Claude Code in chat: a placeholder is posted immediately, then live-edited as the agent works. No separate Bot API method is involved — this is the "Streaming Text for Bots" UX from Telegram's May 2026 update, implemented over the existing `editMessageText` we already use.

### Lifecycle of one turn

```
You:  how's the kitchen tomorrow?
Bot:  🤔 thinking…                                  ← sent immediately, ~50ms
       ↓ (~2s — first tool call lands)
Bot:  🛠 calling kitchen_get_capacity…              ← edit in place
       ↓ (~6s — assistant text comes back)
Bot:  🤔 Tomorrow looks tight on whole honey        ← edit in place
       ↓ (next tool call)
Bot:  🛠 calling list_orders…                       ← edit in place
       ↓ (final, with footer)
Bot:  Tomorrow looks tight on whole honey cakes — already at 9/12 with
      3 drafts pending. Pistachio rolls open. Want me to redirect
      tomorrow's website asks toward pistachio?

      — used: kitchen_get_capacity, list_orders · 12.3s · $0.18
```

### Throttling

- ≤ 1 `editMessageText` per **800ms** (Telegram's soft per-chat rate limit is ~1/sec).
- Identical text edits are skipped (TG rejects them).
- If an edit fails, the next one falls back to a fresh `sendMessage`.

### Where it lives

- [src/agent/invoke.ts](../../src/agent/invoke.ts) — line-buffered `stream-json` parser; emits `StreamEvent` per turn/tool call via `opts.onStream` callback.
- [src/bots/owner/live.ts](../../src/bots/owner/live.ts) — `makeOwnerStreamSink(threadId, messageId)` returns a throttled `(StreamEvent) => void` closure.
- [src/server.ts](../../src/server.ts) `onMessage` — passes `onStream` only when `role === 'owner'`. Customer channels still use a single send-on-completion (no streaming).

Grain note: `claude -p stream-json` emits **one event per assistant turn or tool round-trip**, not per token. So "streaming" here is step-granular — which lines up naturally with TG's edit cadence and avoids rate-limit errors.

## 9. Owner event log — emoji legend + verbosity

When the bot is configured, every customer-facing turn posts a one-line entry to the owner's TG chat. This is the "live tape" the brief asks for (*"System leaves evidence in logs/state so the evaluator can verify what happened"*).

### Emoji prefixes

| Prefix | Category | Example |
|---|---|---|
| 📨 | inbound — customer message arrived | `📨 [wa] +12815559001 → concierge: "do you have honey today?"` |
| ✓ | outbound — agent reply sent | `✓ [wa] +12815559001 ← 2 tools · 12.3s · $0.18` |
| ⚠ | error — agent failed or timed out | `⚠ [wa] +12815559001 agent error: timeout after 90s` |
| 🔧 | system — server boot, scheduled job, config change | `🔧 server up · channels: wa,ig,web,telegram · agent: claude-opus-4-7` |

Owner-role turns (you talking to the bot) don't echo to the log — you ARE the source.

### Verbosity dial — `TG_OWNER_LOG_LEVEL`

Set in `.env.local` or omit (defaults to `normal`):

| Level | Emits |
|---|---|
| `verbose` | All four prefixes including `🔧` system events |
| `normal` (default) | `📨` inbound + `✓` outbound + `⚠` errors. Skips `🔧` system. |
| `quiet` | `⚠` errors only |
| `off` | Nothing — logger is a no-op |

Pick `quiet` if your sandbox traffic is high and the `📨/✓` lines are noisy. Pick `verbose` during a demo so the boot ping is visible.

## 10. What this costs

Slash commands and callback taps cost **$0** — pure DB reads + sandbox HTTP (covered by team token, not Max).

Free text falls through to `claude -p` (~$0.05–0.40 per turn) and burns Claude Max budget. Use `/reset` to drop accumulated context if conversation history is making turns expensive.

## 11. Architecture notes

```
src/
├── channels/telegram.ts            transport: send/edit/typing + parse
├── channels/telegram-poller.ts     long-poll loop, one per bot token
├── bots/owner/
│   ├── commands.ts                 /today /orders /escalations /reset /help
│   ├── callbacks.ts                approve: reject: view_esc:
│   ├── cards.ts                    postDraftOrderCard, postEscalationCard
│   ├── live.ts                     sendOwnerThinking, finalizeOwnerThinking, makeOwnerStreamSink
│   ├── log.ts                      logInbound / logOutbound / logError / logSystem
│   └── format.ts                   shared fmtMoney/shortId/hhmm
├── server.ts                       three-lane router (slash / callback / agent w/ stream)
├── agent/invoke.ts                 claude -p subprocess + stream-json onStream callback
└── agent/prompts/owner.md          owner system prompt (no brand-voice prepend)
```

The owner role's tool allowlist is in `src/agent/allowlists.ts` (`ROLE_TOOL_ALLOWLIST.owner`). Add a tool there to make it available to free-text owner turns.
