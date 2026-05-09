# Telegram libraries + Mini App primer

Two questions answered here:

1. Which Telegram library should we use? (vs. aiogram which is Python-only)
2. Can our existing website become a Telegram Mini App, or do we need a separate one?

---

## 1. Telegram libraries — TypeScript / Bun

### What we use today: native `fetch`

`src/channels/telegram.ts` and `src/channels/telegram-poller.ts` use plain `fetch()` against `https://api.telegram.org/bot<TOKEN>/<method>`. This is enough for:

- `sendMessage` (with inline keyboards)
- `getUpdates` (long-poll)
- `answerCallbackQuery` (inline-button taps)
- `editMessageText` (updating a message in place)

That covers everything we need for the **owner cockpit + 4-bot fan-out** pattern. About 100 lines of code total.

### When we'd want a library

Libraries help when:
- You have **multi-step conversations** ("scenes" or "wizards" — first ask flavor, then size, then date)
- You need **middleware** (auth, rate limiting, error handling layered cleanly)
- You're building a **commercial SaaS bot** with hundreds of commands

We have none of those needs today. The agent does the conversation reasoning; the bot wrapper just shuttles messages.

### If we DO want one — the 2026 landscape

| Library | Stack | Status | Verdict |
|---|---|---|---|
| **grammY** | TypeScript, ESM-first, Bun-compatible | Most actively maintained TS bot framework as of late 2025. Modular plugins (sessions, conversations, payments, runner, parse-mode, ratelimit). Excellent type inference. | **Best choice if we adopt one.** |
| **Telegraf** | Node, CommonJS legacy | Battle-tested, used in many production bots. Type defs are decent but the API patterns predate modern TS. v4 maintained but development slowed. | OK fallback. Avoid v3. |
| **node-telegram-bot-api** | Node, callback-style | Oldest, still updated. API is clunky by 2026 standards. No native scenes. | Avoid. |
| **Telegraf-derived (Telegrambots, etc.)** | Various | Forks; few are well-maintained. | Skip. |
| **aiogram** | **Python only** | The user's question — yes, aiogram is the Python equivalent of grammY. Not usable from a TS/Bun stack. | N/A |

**Recommendation for this hackathon:** stay with `fetch`. If we need scenes for the customer-side Telegram Mini App, add **grammY** at that point — it works under Bun and won't conflict with our existing code. Migration cost: ~30 minutes.

---

## 2. Telegram Mini Apps — what they are, what's possible

A **Mini App** (formerly "Web App") is a regular website that opens **inside the Telegram client's webview**, not in a browser. The user taps a button or visits a `t.me/<bot>?startapp=...` link, and Telegram launches our website inside its UI.

### The key facts

- It's a normal HTML/JS website. Same codebase as a regular browser site.
- Telegram injects `window.Telegram.WebApp` at runtime — a JS API for: identifying the user, showing the native MainButton, theming with the user's Telegram colors, sending data back to the bot, closing the webview.
- The user's identity is delivered as `initData` — a signed payload we verify server-side using `HMAC-SHA256(bot_token, initData)`. Trustless on the client; verified on our server.
- Mini Apps can do **payments** via Telegram's built-in checkout (Stripe, etc.) — tap-to-pay UX without leaving Telegram.

### Can our existing website work as a Mini App?

**Yes — with minor additions.** Specifically:

1. **Add the Telegram Web App SDK** to the page that's the entry point. One line:
   ```html
   <script src="https://telegram.org/js/telegram-web-app.js"></script>
   ```
2. **Detect Mini App context** at runtime:
   ```ts
   const tg = (window as any).Telegram?.WebApp
   if (tg) {
     tg.expand()                // make webview full-height
     tg.ready()                 // tell Telegram we're loaded
     const userId = tg.initDataUnsafe?.user?.id
     // ... use userId to skip thread creation
   }
   ```
3. **Verify `initData` server-side** before trusting any user identity in API calls:
   ```ts
   import { createHmac } from 'node:crypto'
   function verify(initData: string, botToken: string): boolean {
     const params = new URLSearchParams(initData)
     const hash = params.get('hash'); params.delete('hash')
     const dataCheckString = [...params.entries()].sort().map(([k,v]) => `${k}=${v}`).join('\n')
     const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
     const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
     return computed === hash
   }
   ```
4. **Style for the dark/light theme** Telegram passes in (`tg.themeParams`). Map their colors to our cream/Happy Blue palette. ~20 minutes of CSS.
5. **Optional but slick: use `MainButton`** for "Confirm Order" instead of an in-page button. It sticks to the bottom and matches Telegram's UI.

### Same site, two modes

Our existing `/chat`, `/menu`, `/menu/:id` pages can serve **both** the regular web AND Mini App. The detection happens client-side — if `window.Telegram.WebApp` exists, render with Mini App affordances. Otherwise normal web.

This is the cleanest path. No second codebase, no separate routes, no duplicate brand work.

### What we'd add

| File | Change |
|---|---|
| `src/web/layout.ts` | Add `<script src="https://telegram.org/js/telegram-web-app.js"></script>` (1 line) |
| `src/web/pages.ts` | Detect `Telegram.WebApp` in the chat page's inline script; expand + theme |
| `src/lib/telegram-init-data.ts` | New: HMAC verification helper |
| `src/routes/api.ts` | New endpoint or middleware: verify `initData` before trusting user id |
| `src/bots/owner.ts` | Send the customer a Mini App button via `reply_markup: { inline_keyboard: [[{ text: '🎂 Order on HappyCake', web_app: { url: 'https://<our-tunnel>/chat' } }]] }` |

Total time, including testing on a real Telegram account: ~2 hours.

### When to do this

**After the core is solid.** The brief judges working channels, not Mini App. So:

1. T0 → T+8h: Customer chat works on website + WA + IG. Owner bot works in Telegram. (this is most of what's done.)
2. T+8h → T+18h: Marketing loop, kitchen handoff, scenarios.
3. T+18h → T+22h: If green, add Mini App. ~+5 to +10 Innovation points if it works smoothly. Skip if anything else is shaky.

---

## 3. Telegram tooling — concrete next steps

**For owner-side teammate (P2)**: implementing the 4-bot fan-out:

1. Create 4 bots in BotFather: `@hc_owner_bot`, `@hc_concierge_bot`, `@hc_kitchen_bot`, `@hc_marketing_bot`. Save the tokens to `.env.local`.
2. Get your own user id (DM `@userinfobot` on Telegram). Save as `TG_OWNER_CHAT_ID`.
3. The pollers auto-start when tokens are present (`src/server.ts` calls `startTelegramPollers`).
4. To send the owner a notification with inline buttons:
   ```ts
   import { sendTelegram } from '../channels/telegram.ts'
   await sendTelegram(
     config.telegram.owner.token!,
     config.telegram.owner.chatId!,
     `New draft order #${id} — $${(total/100).toFixed(2)} for ${customer}.`,
     [[{ text: '✓ Approve', data: `approve:${id}` }, { text: '✗ Reject', data: `reject:${id}` }]],
   )
   ```
5. The callback handler in `src/server.ts` already routes the tap to the owner role agent with the data string. The owner role agent can then call `approve_order` or `reject_order` (local MCP tools).

**Reject-with-reason flow** (TODO):
- On `reject:<id>` callback, send a follow-up `sendMessage` with `force_reply: true` asking "Reason?"
- Capture the next message in that chat as the reason; then call `reject_order`.
- This is the only multi-step UX we need, and it doesn't justify pulling in grammY.
