// Diagnostic for "the Mini App button isn't showing up in Telegram".
//
// Hits the Bot API for each configured TG bot and prints:
//   - the current menu button (default = no Mini App)
//   - the registered slash command list
//   - the bot's username + a deep link you can paste into Telegram
//
// Usage:
//   bun run tg:menu:status
//   bun run tg:menu:status https://your-tunnel.example.com    (also probes /admin)

import { config } from '../config.ts'

const TG_API = 'https://api.telegram.org'

interface Bot {
  role: 'owner' | 'kitchen' | 'marketing' | 'concierge'
  token: string
}

function configuredBots(): Bot[] {
  const out: Bot[] = []
  if (config.telegram.owner.token) out.push({ role: 'owner', token: config.telegram.owner.token })
  if (config.telegram.kitchen.token)
    out.push({ role: 'kitchen', token: config.telegram.kitchen.token })
  if (config.telegram.marketing.token)
    out.push({ role: 'marketing', token: config.telegram.marketing.token })
  if (config.telegram.concierge.token)
    out.push({ role: 'concierge', token: config.telegram.concierge.token })
  return out
}

async function tg<T>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok: boolean; description?: string; result?: T }
  if (!data.ok) throw new Error(`${method}: ${data.description}`)
  return data.result as T
}

const probeUrl = process.argv[2]
const bots = configuredBots()

if (bots.length === 0) {
  console.error('✗ No TG bot tokens configured in .env.local')
  process.exit(1)
}

console.log(`Inspecting ${bots.length} bot(s)…\n`)

for (const bot of bots) {
  console.log(`── [${bot.role}] ──────────────────────────────`)
  try {
    const me = await tg<{ id: number; username: string; first_name: string; is_bot: boolean }>(
      bot.token,
      'getMe',
    )
    console.log(`  bot: @${me.username} (${me.first_name})`)
    console.log(`  link: https://t.me/${me.username}`)

    const menu = await tg<{ type: string; text?: string; web_app?: { url: string } }>(
      bot.token,
      'getChatMenuButton',
    )
    if (menu.type === 'web_app' && menu.web_app) {
      console.log(`  ✓ menu button: web_app "${menu.text}" → ${menu.web_app.url}`)
    } else if (menu.type === 'commands') {
      console.log(`  ✗ menu button: default "/" — NOT a Mini App. Run: bun run tg:menu <https-url>`)
    } else {
      console.log(`  ? menu button: type=${menu.type}`)
    }

    const cmds = await tg<Array<{ command: string; description: string }>>(bot.token, 'getMyCommands')
    if (cmds.length === 0) {
      console.log('  ✗ commands: none registered. Run: bun run tg:menu <https-url>')
    } else {
      console.log(`  ✓ commands: ${cmds.length} registered`)
    }
  } catch (err) {
    console.log(`  ✗ Bot API error: ${(err as Error).message}`)
  }

  console.log()
}

if (probeUrl) {
  console.log(`Probing ${probeUrl}/admin reachability…`)
  try {
    const res = await fetch(`${probeUrl}/admin`, { redirect: 'manual' })
    console.log(`  HTTP ${res.status}`)
    const ct = res.headers.get('content-type') ?? ''
    console.log(`  Content-Type: ${ct}`)
    if (!probeUrl.startsWith('https://')) {
      console.log('  ✗ URL is NOT https — Telegram rejects http for Mini Apps.')
    } else if (res.status >= 400) {
      console.log("  ✗ /admin returned an error — Telegram won't load it.")
    } else if (!ct.includes('text/html')) {
      console.log('  ✗ /admin did not return HTML — likely a proxy / rewrite issue.')
    } else {
      console.log('  ✓ /admin reachable + serving HTML.')
    }
  } catch (err) {
    console.log(`  ✗ fetch failed: ${(err as Error).message}`)
  }
  console.log()
}

console.log('Common reasons the button doesn\'t show in Telegram:')
console.log('  1. You haven\'t run `bun run tg:menu <https-url>` yet')
console.log('  2. URL was http (must be https). Use ngrok or your real domain.')
console.log('  3. Telegram cached the old menu config — force-restart the app:')
console.log('     • iOS: swipe the app away in the app switcher, reopen')
console.log('     • Android: long-press app icon → App Info → Force stop')
console.log('     • Desktop: ⌘Q (Mac) / quit from tray, reopen')
console.log('  4. You\'ve never sent /start to the bot — the menu only shows after first contact')
console.log('  5. The web frontend at <URL>/admin returns an error (proxy / 404 / wrong port)')
console.log('  6. You\'re looking at a chat with a different bot — verify @username above')
