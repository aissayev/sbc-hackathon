# `src/bots/` — Telegram bot surfaces (currently lives elsewhere)

This directory is reserved for per-role Telegram bot wrappers. **It is intentionally empty today.**

The current bot wiring lives in:

- [`src/channels/telegram.ts`](../channels/telegram.ts) — `configuredBots()` enumerates 1 bot per role; `sendTelegram(token, chatId, text, keyboard)` is the outbound primitive.
- [`src/channels/telegram-poller.ts`](../channels/telegram-poller.ts) — one long-poll loop per bot, with role hint stamped on each `IncomingMessage`.
- [`src/server.ts`](../server.ts) — the `startTelegramPollers({ onMessage, onCallback })` call. The callback handler turns inline-button taps (`approve:<id>`, `reject:<id>`) into another `onMessage` call with `roleHint: 'owner'`.

When per-bot logic gets complex enough that it doesn't fit in a callback, split it out here:

- `owner.ts` — approve / reject / today / orders / help (the operator cockpit)
- `kitchen.ts` — capacity warnings, ready-pickup pings (mostly receives, doesn't reason)
- `marketing.ts` — daily report, campaign approval requests
- `concierge.ts` — log-only bot for the team to watch customer convos

Until then, the agent prompts (`src/agent/prompts/<role>.md`) carry the per-role behavior, and the bot is just a transport.

## Naming clarification

We use **agent** for the role/persona (concierge / kitchen / marketing / owner — defined by prompt + tool allowlist). We use **bot** for the Telegram surface (one bot token per role). One agent → one bot. The agent does the reasoning; the bot is just the channel.
