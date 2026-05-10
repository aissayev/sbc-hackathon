// Configure each TG bot's menu button + slash command list.
//
// Why a script: BotFather lets you set commands manually but not the
// "Mini App" menu button — that has to come through the Bot API
// (`setChatMenuButton`). Setting it once per token is enough; Telegram
// remembers it.
//
// Usage:
//   bun run tg:menu <https-public-url>
//   bun run tg:menu https://happycake.flowleads.dev
//
// What it does, per configured bot (owner / kitchen / marketing / concierge):
//   1. setChatMenuButton → "🎂 HappyCake" button next to the message
//      input. Tapping it opens the /admin Mini App inside Telegram.
//   2. setMyCommands → the "/" autocomplete menu shows the right slash
//      commands for that role.
//
// Idempotent — re-running with the same URL is a no-op. Re-run if you
// change tunnels (ngrok URL flipped) or deploy to a new host.
//
// Requirements:
//   - The URL must be HTTPS (Telegram rejects http and self-signed). Ngrok
//     gives you one for free; in prod use whatever your real domain is.
//   - The URL must serve the /admin route (the Next.js web app at web/).

import { config } from '../config.ts'

const TG_API = 'https://api.telegram.org'

interface TgBotSpec {
  role: 'owner' | 'kitchen' | 'marketing' | 'concierge'
  token?: string
}

// Slash command lists per role. Telegram caps each command at 32 chars name
// + 256 chars description; we stay well under both.
const COMMANDS: Record<TgBotSpec['role'], Array<{ command: string; description: string }>> = {
  owner: [
    { command: 'today', description: "today's orders, revenue, pending approvals" },
    { command: 'orders', description: 'last 10 orders + one-tap approve' },
    { command: 'escalations', description: 'open escalations' },
    { command: 'campaigns', description: 'pick a marketing strategy + approve/launch' },
    { command: 'brief', description: 'live MCP brief — sales, margins, demand' },
    { command: 'inbox', description: 'open WA + IG threads, 1-tap reply' },
    { command: 'reviews', description: 'Google Business reviews, 1-tap reply' },
    { command: 'spend', description: 'marketing budget MTD' },
    { command: 'gb', description: 'Google Business profile metrics' },
    { command: 'score', description: 'rubric coverage from the sandbox evaluator' },
    { command: 'reset', description: 'clear conversation context' },
    { command: 'help', description: 'show commands' },
  ],
  kitchen: [
    { command: 'tickets', description: 'today’s open kitchen tickets' },
    { command: 'capacity', description: "today's remaining capacity" },
    { command: 'reset', description: 'clear conversation context' },
    { command: 'help', description: 'show commands' },
  ],
  marketing: [
    { command: 'campaigns', description: 'list strategies' },
    { command: 'brief', description: 'live MCP brief' },
    { command: 'spend', description: 'budget MTD' },
    { command: 'help', description: 'show commands' },
  ],
  concierge: [
    { command: 'help', description: 'show commands' },
    { command: 'reset', description: 'clear conversation context' },
  ],
}

// Per-role label on the menu button. Keep short — Telegram truncates at
// ~14 chars on narrow screens.
const MENU_LABEL: Record<TgBotSpec['role'], string> = {
  owner: 'HappyCake',
  kitchen: 'Kitchen',
  marketing: 'Marketing',
  concierge: 'Order a cake',
}

// Per-role Mini App landing path. Owner / kitchen / marketing all open
// the cockpit (which routes them to /admin/today by default). Concierge
// is the *customer-facing* bot — its Mini App should open the order
// page, NOT the admin cockpit. Previously this script registered the
// same /admin URL for every bot, which is why the customer Mini App
// was opening the admin login screen instead of the order form.
const MENU_PATH: Record<TgBotSpec['role'], string> = {
  owner: '/admin',
  kitchen: '/admin',
  marketing: '/admin',
  concierge: '/order',
}

function configuredBots(): Array<TgBotSpec & { token: string }> {
  const candidates: TgBotSpec[] = [
    { role: 'owner', token: config.telegram.owner.token },
    { role: 'kitchen', token: config.telegram.kitchen.token },
    { role: 'marketing', token: config.telegram.marketing.token },
    { role: 'concierge', token: config.telegram.concierge.token },
  ]
  return candidates.filter((b): b is TgBotSpec & { token: string } => Boolean(b.token))
}

async function tgRequest<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok: boolean; description?: string; result?: T }
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? 'unknown'}`)
  return data.result as T
}

const url = process.argv[2]
if (!url || !url.startsWith('https://')) {
  console.error('Usage: bun run tg:menu <https-public-url>')
  console.error('Example: bun run tg:menu https://happycake.flowleads.dev')
  console.error('Note: must be HTTPS. Telegram rejects http and self-signed.')
  process.exit(2)
}

const base = url.replace(/\/$/, '')

const bots = configuredBots()
if (bots.length === 0) {
  console.error('✗ No TG bot tokens configured. Add TG_*_BOT_TOKEN to .env.local first.')
  process.exit(1)
}

console.log(`Configuring ${bots.length} bot(s) → ${base}{/admin or /order}`)
console.log()

for (const bot of bots) {
  const label = MENU_LABEL[bot.role]
  const commands = COMMANDS[bot.role]
  // Per-role landing path — owner cockpit for staff bots, customer
  // order form for the concierge (customer-facing) bot.
  const miniAppUrl = `${base}${MENU_PATH[bot.role]}`
  console.log(`[${bot.role}]  → ${miniAppUrl}`)
  try {
    await tgRequest(bot.token, 'setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: `🎂 ${label}`,
        web_app: { url: miniAppUrl },
      },
    })
    console.log(`  ✓ menu button → 🎂 ${label}`)
  } catch (err) {
    console.error(`  ✗ menu button: ${(err as Error).message}`)
  }
  try {
    await tgRequest(bot.token, 'setMyCommands', { commands })
    console.log(`  ✓ commands set (${commands.length})`)
  } catch (err) {
    console.error(`  ✗ commands: ${(err as Error).message}`)
  }
}

console.log()
console.log('Done. In Telegram:')
console.log('  - Open any chat with the bot')
console.log('  - The "/" menu now shows the slash command list')
console.log("  - The button next to the message input opens the Mini App")
console.log()
console.log('If the menu button does NOT show up:')
console.log('  - Force-restart Telegram (it caches menu buttons aggressively)')
console.log(`  - Verify the URLs are reachable: curl -sI ${base}/admin and ${base}/order`)
